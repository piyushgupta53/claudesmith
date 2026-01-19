import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentConfig } from '../types/agent';
import type { ProgressState, ProgressPhase } from '../types/execution';
import { agentConfigToSDKOptions } from '../utils/agentConfigConverter';
import { dockerService } from './dockerService';
import path from 'path';

// Progress file path inside container
const PROGRESS_FILE_PATH = '/scratch/claude-progress.json';

/**
 * Agent Executor Service
 * Wraps the Claude Agent SDK's query() function
 * Manages Docker container for sandboxed execution
 */
export class AgentExecutor {
  private queryInstance: any = null;
  private sessionId: string;
  private agentConfig: AgentConfig;
  private containerId: string | null = null;
  private containerInitialized: boolean = false;
  private questionResolvers: Map<string, (answers: Record<string, string>) => void> = new Map();

  // Progress tracking
  private progressState: ProgressState | null = null;
  private progressCallbacks: ((progress: ProgressState) => void)[] = [];

  constructor(sessionId: string, agentConfig: AgentConfig) {
    this.sessionId = sessionId;
    this.agentConfig = agentConfig;
  }

  /**
   * Read progress file from container at session start
   * Returns null if no progress file exists
   */
  private async readProgressFile(): Promise<ProgressState | null> {
    if (!this.containerId) return null;

    try {
      const content = await dockerService.readFile(this.containerId, PROGRESS_FILE_PATH);
      const progress = JSON.parse(content);
      console.log('[AgentExecutor] Found existing progress file:', progress.currentPhase);
      return progress;
    } catch {
      // No progress file exists yet
      return null;
    }
  }

  /**
   * Write progress file to container after significant actions
   */
  private async writeProgressFile(progress: ProgressState): Promise<void> {
    if (!this.containerId) return;

    try {
      await dockerService.writeFile(
        this.containerId,
        PROGRESS_FILE_PATH,
        JSON.stringify(progress, null, 2)
      );
      console.log('[AgentExecutor] Updated progress file:', progress.currentPhase);
    } catch (error) {
      console.error('[AgentExecutor] Failed to write progress file:', error);
    }
  }

  /**
   * Initialize or resume progress tracking
   */
  private async initializeProgress(taskDescription: string): Promise<ProgressState> {
    // Try to read existing progress
    const existingProgress = await this.readProgressFile();

    if (existingProgress) {
      // Resume from existing progress
      existingProgress.lastUpdatedAt = new Date().toISOString();
      this.progressState = existingProgress;
      return existingProgress;
    }

    // Create new progress state
    const now = new Date().toISOString();
    this.progressState = {
      sessionId: this.sessionId,
      taskDescription,
      startedAt: now,
      lastUpdatedAt: now,
      currentPhase: 'gathering_context',
      completedSteps: [],
      pendingSteps: [],
    };

    await this.writeProgressFile(this.progressState);
    return this.progressState;
  }

  /**
   * Update progress state and notify listeners
   */
  public async updateProgress(updates: Partial<ProgressState>): Promise<void> {
    if (!this.progressState) return;

    this.progressState = {
      ...this.progressState,
      ...updates,
      lastUpdatedAt: new Date().toISOString(),
    };

    await this.writeProgressFile(this.progressState);

    // Notify listeners
    for (const callback of this.progressCallbacks) {
      callback(this.progressState);
    }
  }

  /**
   * Add a completed step to progress
   */
  public async addCompletedStep(step: string, result: 'success' | 'failure' = 'success'): Promise<void> {
    if (!this.progressState) return;

    this.progressState.completedSteps.push({
      step,
      completedAt: new Date().toISOString(),
      result,
    });
    this.progressState.lastUpdatedAt = new Date().toISOString();

    await this.writeProgressFile(this.progressState);

    // Notify listeners
    for (const callback of this.progressCallbacks) {
      callback(this.progressState);
    }
  }

  /**
   * Register a callback for progress updates
   */
  public onProgressUpdate(callback: (progress: ProgressState) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Get current progress state
   */
  public getProgressState(): ProgressState | null {
    return this.progressState;
  }

  /**
   * Initialize Docker container for sandboxed execution
   * Only creates container if sandbox tools are enabled
   * Includes timeout to prevent hanging
   */
  private async initializeContainer(): Promise<void> {
    if (this.containerInitialized) {
      console.log('[AgentExecutor] Container already initialized, skipping');
      return; // Already initialized
    }

    // Check if agent uses sandbox tools (Read, Write, Bash)
    // Note: Grep and Glob are NOT fully implemented yet, so don't require Docker for them
    const sandboxTools = ['Read', 'Write', 'Bash', 'Edit', 'Glob', 'Grep'];
    const parentUsesSandboxTools = this.agentConfig.tools.enabled.some(tool =>
      sandboxTools.includes(tool)
    );

    // IMPORTANT: For orchestrators, check if ANY subagent needs sandbox tools
    // Subagents inherit Docker MCP access from parent, so container must be created
    let subagentNeedsSandboxTools = false;
    if (this.agentConfig.subagents && Object.keys(this.agentConfig.subagents).length > 0) {
      // Orchestrators with subagents always need Docker for FileManager and other subagents
      // that perform file operations (Read, Write, Bash, Glob, Grep)
      subagentNeedsSandboxTools = true;
      console.log('[AgentExecutor] Orchestrator mode: Subagents need Docker container for file operations');
    }

    const usesSandboxTools = parentUsesSandboxTools || subagentNeedsSandboxTools;

    console.log('[AgentExecutor] Enabled tools:', this.agentConfig.tools.enabled);
    console.log('[AgentExecutor] Uses sandbox tools:', usesSandboxTools,
      `(parent: ${parentUsesSandboxTools}, subagents: ${subagentNeedsSandboxTools})`);

    if (!usesSandboxTools) {
      // No sandbox tools needed
      console.log('[AgentExecutor] No sandbox tools needed, skipping container');
      this.containerInitialized = true;
      return;
    }

    const startTime = Date.now();
    const INIT_TIMEOUT_MS = 120000; // 2 minute timeout for initialization

    try {
      // Check if Docker is available
      console.log('[AgentExecutor] Checking Docker availability...');
      const dockerAvailable = await dockerService.isDockerAvailable();
      if (!dockerAvailable) {
        throw new Error(
          'Docker is required for sandbox tools but is not running. Please start Docker Desktop.'
        );
      }
      console.log('[AgentExecutor] Docker is available');

      // Ensure Ubuntu image is available (with timeout)
      console.log('[AgentExecutor] Ensuring Ubuntu image (may take a few minutes on first run)...');
      await Promise.race([
        dockerService.ensureImage(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Docker image pull timed out after 5 minutes')), 300000)
        )
      ]);
      const imageTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[AgentExecutor] Ubuntu image ready (${imageTime}s)`);

      // Define mounts
      // Note: /project mount removed for security - agents access files via:
      // - GitHub MCP Server (clone/read repos)
      // - File uploads to /scratch
      // - Custom MCP servers
      // - WebFetch for remote content
      const mounts = [
        // Scratch workspace (read-write)
        {
          source: path.resolve(process.cwd(), '.scratch', this.sessionId),
          target: '/scratch',
          readonly: false
        }
      ];

      const fs = await import('fs/promises');
      const os = await import('os');

      // Add ONLY this project's cache directory for SDK tool result files
      // SECURITY: ~/.claude/projects/ contains cache folders for ALL projects!
      // We must only mount THIS project's subfolder, not expose other projects' data
      //
      // Cache folder naming convention: /Users/foo/bar -> -Users-foo-bar
      const projectPath = path.resolve(process.cwd());
      const projectCacheName = projectPath.replace(/\//g, '-'); // Replace all / with -
      const projectCacheDir = path.join(os.homedir(), '.claude', 'projects', projectCacheName);

      try {
        await fs.access(projectCacheDir);
        mounts.push({
          source: projectCacheDir,
          target: `/claude-cache/projects/${projectCacheName}`,
          readonly: true
        });
        console.log(`[AgentExecutor] Project cache mounted: ${projectCacheName} (read-only)`);
      } catch {
        // Project cache doesn't exist yet - that's fine, SDK will create it when needed
        console.log('[AgentExecutor] Project cache directory not found, skipping mount');
      }

      // Only add skills mount if the directory exists
      const skillsDir = path.resolve(process.cwd(), '.claude', 'skills');
      try {
        await fs.access(skillsDir);
        mounts.push({
          source: skillsDir,
          target: '/skills',
          readonly: true
        });
      } catch {
        // Skills directory doesn't exist, skip mount
        console.log('[AgentExecutor] Skills directory not found, skipping mount');
      }

      // Create scratch directory if it doesn't exist
      const scratchDir = path.resolve(process.cwd(), '.scratch', this.sessionId);
      console.log('[AgentExecutor] Creating scratch directory:', scratchDir);
      await fs.mkdir(scratchDir, { recursive: true });

      // Create container with timeout
      console.log('[AgentExecutor] Creating Docker container...');
      const remainingTimeout = INIT_TIMEOUT_MS - (Date.now() - startTime);
      if (remainingTimeout <= 0) {
        throw new Error('Container initialization timed out');
      }

      this.containerId = await Promise.race([
        dockerService.createContainer(this.sessionId, mounts),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Container creation timed out')), remainingTimeout)
        )
      ]);

      this.containerInitialized = true;

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[AgentExecutor] Container ready in ${totalTime}s: ${this.containerId?.substring(0, 12)}`);
    } catch (error: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[AgentExecutor] Container initialization failed after ${elapsed}s:`, error.message);
      throw new Error(`Container initialization failed: ${error.message}`);
    }
  }

  /**
   * Cleanup container and resources
   */
  private async cleanup(): Promise<void> {
    if (this.containerId) {
      try {
        await dockerService.destroyContainer(this.containerId);
        console.log(`Container destroyed for session ${this.sessionId}`);
      } catch (error) {
        console.error('Failed to destroy container:', error);
      }
    }
  }

  /**
   * Handle AskUserQuestion tool call
   * This waits for user response and returns answers
   * Note: The question is displayed via SSE stream, not server-side store
   */
  private async handleAskUserQuestion(input: any): Promise<{
    behavior: 'allow';
    updatedInput: Record<string, any>;
  }> {
    // Wait for user to answer
    // The stream route will emit question_request event to client
    // Client will call /api/chat/[sessionId]/question with answers
    // which will resolve this promise
    const answers = await new Promise<Record<string, string>>((resolve) => {
      // Use session-based key since only one question can be pending per session
      // The question API will use any requestId, we just need to resolve it
      this.questionResolvers.set('pending', resolve);
    });

    // Return in SDK format
    return {
      behavior: 'allow',
      updatedInput: {
        questions: input.questions,
        answers,
      },
    };
  }

  /**
   * Resolve a question request with user's answers
   * Called from API when user submits their answers
   */
  public resolveQuestion(requestId: string, answers: Record<string, string>): void {
    // Always resolve the 'pending' question since we only have one at a time
    const resolver = this.questionResolvers.get('pending');
    if (resolver) {
      resolver(answers);
      this.questionResolvers.delete('pending');
    } else {
      console.warn(`[AgentExecutor] No pending question to resolve for requestId: ${requestId}`);
    }
  }

  /**
   * Start agent execution with a prompt
   */
  async *execute(prompt: string) {
    try {
      console.log('[AgentExecutor] Starting execution for session:', this.sessionId);
      console.log('[AgentExecutor] Prompt:', prompt.substring(0, 100) + '...');

      // Initialize container if needed
      console.log('[AgentExecutor] Initializing container...');
      await this.initializeContainer();
      console.log('[AgentExecutor] Container initialized:', this.containerId);

      // Initialize progress tracking (if container is available)
      if (this.containerId) {
        const progress = await this.initializeProgress(prompt.substring(0, 200));

        // If resuming, add progress context to system prompt
        if (progress.completedSteps.length > 0) {
          console.log('[AgentExecutor] Resuming with', progress.completedSteps.length, 'completed steps');
        }
      }

      // Convert agent config to SDK options (pass container ID for tool handlers)
      // Note: This is now async to load skill content
      console.log('[AgentExecutor] Converting agent config to SDK options...');
      console.log('[AgentExecutor] MCP connections:', this.agentConfig.mcpConnections);
      const options = await agentConfigToSDKOptions(this.agentConfig, this.containerId || undefined);

      // Inject progress state into system prompt if resuming
      if (this.progressState && this.progressState.completedSteps.length > 0) {
        const progressContext = `\n\n## Session Progress (Resuming)\nYou are resuming a previous session. Here is your progress:\n- Phase: ${this.progressState.currentPhase}\n- Completed Steps:\n${this.progressState.completedSteps.map(s => `  - ${s.step} (${s.result})`).join('\n')}\n- Pending Steps: ${this.progressState.pendingSteps.join(', ') || 'None specified'}\n${this.progressState.notes ? `- Notes: ${this.progressState.notes}` : ''}\n\nContinue from where you left off.`;
        options.systemPrompt = (options.systemPrompt || '') + progressContext;
      }
      console.log('[AgentExecutor] SDK options created, MCP servers:', Object.keys(options.mcpServers || {}));

      // Log agents parameter for debugging subagent delegation
      if (options.agents) {
        console.log('[AgentExecutor] ═══════════════════════════════════════════════════════');
        console.log('[AgentExecutor] SDK options.agents:', Object.keys(options.agents));
        Object.entries(options.agents).forEach(([name, config]: [string, any]) => {
          console.log(`[AgentExecutor]   └─ ${name}: ${config.description?.substring(0, 50)}...`);
          console.log(`[AgentExecutor]      tools: ${config.tools?.join(', ') || 'inherited'}`);
        });
        console.log('[AgentExecutor] ═══════════════════════════════════════════════════════');
      } else {
        console.log('[AgentExecutor] SDK options.agents: none (not an orchestrator)');
      }

      // Extract orchestrator metadata and remove from options (SDK doesn't need these)
      const orchestratorBlockedTools: string[] = options._orchestratorBlockedTools || [];
      const isOrchestrator: boolean = options._isOrchestrator || false;
      delete options._orchestratorBlockedTools;
      delete options._isOrchestrator;

      if (isOrchestrator) {
        console.log(`[AgentExecutor] Orchestrator mode: ${orchestratorBlockedTools.length} tools blocked for parent, allowed for subagents`);
      }

      // Add canUseTool handler
      const originalCanUseTool = options.canUseTool;
      options.canUseTool = async (toolName: string, input: Record<string, unknown>, context: any) => {
        // DEBUG: Log context to verify agentID is present for subagent calls
        console.log(`[canUseTool] tool=${toolName}, agentID=${context?.agentID}, keys=${Object.keys(context || {}).join(',')}`);

        // Handle AskUserQuestion
        if (toolName === 'AskUserQuestion') {
          return await this.handleAskUserQuestion(input);
        }

        // ORCHESTRATOR ENFORCEMENT: Block MCP tools when called by the orchestrator directly
        // MCP servers are registered at parent level for subagent inheritance, but the
        // orchestrator should NOT use them directly - it must delegate to subagents
        if (isOrchestrator && orchestratorBlockedTools.length > 0) {
          // Check if this tool is in the blocked list
          if (orchestratorBlockedTools.includes(toolName)) {
            // KEY FIX: Check if this call is from a subagent
            // SDK provides agentID in context when a subagent makes the call
            if (context?.agentID) {
              // Subagent is calling - ALLOW IT
              console.log(`[AgentExecutor] ✅ Subagent "${context.agentID}" using ${toolName}`);
              return { behavior: 'allow', updatedInput: input };
            }

            // No agentID means parent orchestrator is calling - BLOCK IT
            console.log(`[AgentExecutor] 🚫 BLOCKED: Orchestrator tried to use ${toolName} directly. Must delegate to subagents.`);
            return {
              behavior: 'deny',
              message: `Tool "${toolName}" is not available to the orchestrator. You MUST delegate this operation to a subagent using the Task tool. Available subagents: FileManager (for file operations), SecurityAnalyzer (for analysis).`,
            };
          }
        }

        // Delegate to original canUseTool if it exists
        if (originalCanUseTool) {
          return await originalCanUseTool(toolName, input, context);
        }

        // Default: allow all tools
        return {
          behavior: 'allow',
          updatedInput: input,
        };
      };

      // Create query instance
      console.log('[AgentExecutor] Creating SDK query instance...');
      this.queryInstance = query({
        prompt,
        options
      });
      console.log('[AgentExecutor] Query instance created, starting iteration...');

      // Stream messages from the SDK
      let messageCount = 0;
      let toolCallCount = 0;
      const startTime = Date.now();

      for await (const message of this.queryInstance) {
        messageCount++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // Skip verbose logging for stream_event - these flood the console
        if (message?.type === 'stream_event') {
          yield message;
          continue;
        }

        // Enhanced logging based on message type
        if (message?.type === 'assistant') {
          const content = message.message?.content || [];
          const toolUses = Array.isArray(content)
            ? content.filter((b: any) => b.type === 'tool_use')
            : [];
          const textBlocks = Array.isArray(content)
            ? content.filter((b: any) => b.type === 'text')
            : [];

          if (toolUses.length > 0) {
            toolCallCount += toolUses.length;
            for (const tool of toolUses) {
              console.log(`[AgentExecutor] [${elapsed}s] Tool call: ${tool.name}`,
                JSON.stringify(tool.input).substring(0, 80));
            }
          }
          if (textBlocks.length > 0) {
            const textPreview = textBlocks.map((b: any) => b.text).join('').substring(0, 60);
            console.log(`[AgentExecutor] [${elapsed}s] Assistant text: "${textPreview}..."`);
          }
        } else if (message?.type === 'user') {
          const content = message.message?.content;
          const toolResults = Array.isArray(content)
            ? content.filter((b: any) => b.type === 'tool_result')
            : [];
          if (toolResults.length > 0) {
            for (const result of toolResults) {
              const preview = typeof result.content === 'string'
                ? result.content.substring(0, 50)
                : JSON.stringify(result.content).substring(0, 50);
              console.log(`[AgentExecutor] [${elapsed}s] Tool result (${result.is_error ? 'ERROR' : 'OK'}): "${preview}..."`);
            }
          }
        } else if (message?.type === 'result') {
          // Check for explicit failure (success === false), not just falsy
          // success can be: true (explicit success), false (explicit failure), or undefined (normal completion)
          const status = message.success === false ? 'FAILED' : 'SUCCESS';
          const tokens = message.usage ? `tokens: ${message.usage.input_tokens}/${message.usage.output_tokens}` : '';
          const errorInfo = message.error ? `error: ${message.error}` : '';
          console.log(`[AgentExecutor] [${elapsed}s] Result: ${status} ${tokens} ${errorInfo}`);
          if (message.success === false && message.error) {
            console.error(`[AgentExecutor] Execution error details:`, message.error);
          }
        } else {
          console.log(`[AgentExecutor] [${elapsed}s] Message #${messageCount}: ${message?.type}`);
        }

        yield message;
      }

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[AgentExecutor] Execution complete: ${messageCount} messages, ${toolCallCount} tool calls, ${totalTime}s`);

      // Cleanup container after successful execution
      // Note: Container will be kept alive for the session
      // and cleaned up when the session ends
    } catch (error) {
      console.error('Agent execution error:', error);

      // Cleanup container on error
      await this.cleanup();

      throw error;
    }
  }

  /**
   * Interrupt the current execution
   */
  async interrupt(): Promise<void> {
    if (this.queryInstance && this.queryInstance.interrupt) {
      await this.queryInstance.interrupt();
    }
  }

  /**
   * Change permission mode mid-execution
   */
  async setPermissionMode(mode: string): Promise<void> {
    if (this.queryInstance && this.queryInstance.setPermissionMode) {
      await this.queryInstance.setPermissionMode(mode);
    }
  }

  /**
   * Change model mid-execution
   */
  async setModel(model: string): Promise<void> {
    if (this.queryInstance && this.queryInstance.setModel) {
      await this.queryInstance.setModel(model);
    }
  }

  /**
   * Rewind files to a previous checkpoint
   * Requires enableFileCheckpointing to be true in agent config
   */
  async rewindFiles(
    messageUuid: string,
    options?: { dryRun?: boolean }
  ): Promise<{
    canRewind: boolean;
    error?: string;
    filesChanged?: string[];
    insertions?: number;
    deletions?: number;
  }> {
    if (this.queryInstance?.rewindFiles) {
      return await this.queryInstance.rewindFiles(messageUuid, options);
    }
    return { canRewind: false, error: 'No active query instance' };
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get agent config
   */
  getAgentConfig(): AgentConfig {
    return this.agentConfig;
  }

  /**
   * Get container ID (for tool handlers)
   */
  getContainerId(): string | null {
    return this.containerId;
  }

  /**
   * Manually cleanup resources (call when session ends)
   */
  async destroy(): Promise<void> {
    await this.cleanup();
  }
}

/**
 * Parse SDK message and extract useful information
 */
export function parseSDKMessage(message: any) {
  const parsed: any = {
    type: message.type,
    timestamp: new Date().toISOString(),
    // Preserve UUID and session_id for checkpoint tracking
    uuid: message.uuid,
    sessionId: message.session_id,
  };

  switch (message.type) {
    case 'assistant':
      parsed.content = message.message?.content || [];

      // Extract tool calls
      if (Array.isArray(parsed.content)) {
        parsed.toolCalls = parsed.content
          .filter((block: any) => block.type === 'tool_use')
          .map((block: any) => ({
            id: block.id,
            name: block.name,
            input: block.input,
          }));

        // Extract text content
        parsed.text = parsed.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n');
      }
      break;

    case 'user':
      parsed.content = message.message?.content || '';
      // Check if this is a replay message (for checkpoint identification)
      parsed.isReplay = message.isReplay === true;
      break;

    case 'result':
      parsed.success = message.success;
      parsed.error = message.error;
      parsed.usage = message.usage;
      break;

    case 'system':
      parsed.info = message.info;
      break;

    case 'partial':
      parsed.delta = message.delta;
      break;
  }

  return parsed;
}

/**
 * Detect if a tool call is a subagent invocation
 */
export function isSubagentCall(toolCall: any): boolean {
  return toolCall.name === 'Task' || toolCall.name === 'task';
}

/**
 * Extract subagent information from tool call
 */
export function extractSubagentInfo(toolCall: any) {
  if (!isSubagentCall(toolCall)) return null;

  return {
    agentType: toolCall.input?.subagent_type || toolCall.input?.agent_type || 'unknown',
    description: toolCall.input?.description || '',
    prompt: toolCall.input?.prompt || '',
  };
}
