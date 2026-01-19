import type { AgentConfig, JSONSchema, SettingSource, ResourceLimits } from '../types/agent';
import { isSandboxTool, SANDBOX_TOOLS, migrateHookEvents, getResourceLimitsWithDefaults } from '../types/agent';
import { getToolHandler, getToolSchema, isToolRegistered } from '../tools/toolRegistry';
import { useMcpStore } from '../stores/mcpStore';
import { useConnectorStore } from '../stores/connectorStore';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';
import { createDockerMcpServer } from '../tools/dockerMcpServer';
import { createConnectorMcpServer, getConnectorToolNames } from '../tools/connectorMcpServer';
import {
  createSafeHookHandler,
  createSafeToolHandler,
  createSafeContextLoader,
  createSafeCanUseToolCallback,
  validateCode
} from './safeCodeExecutor';
import type { OAuthProvider } from '../types/connector';
import { decryptTokens } from '../connectors/tokenEncryption';

/**
 * =============================================================================
 * MULTI-AGENT ORCHESTRATION ARCHITECTURE
 * =============================================================================
 *
 * This platform enforces industry-standard multi-agent patterns:
 *
 * 1. ORCHESTRATOR AGENTS (agents with subagents defined):
 *    - Get ONLY orchestration tools: Task, TodoWrite, AskUserQuestion
 *    - CANNOT directly use custom tools, Docker tools, connector tools, OR research tools
 *    - MUST delegate ALL specialized work to subagents via Task tool
 *    - This includes web research - delegate to a subagent with WebSearch
 *
 * 2. WORKER AGENTS (subagents / agents without subagents):
 *    - Get specialized tools: Custom tools, Docker tools, Connector tools, WebSearch
 *    - Can perform actual work: file operations, API calls, analysis, research
 *    - Cannot spawn further subagents (no Task tool)
 *
 * This pattern follows CrewAI, AutoGen, and LangGraph best practices:
 * - "Tools for specialists only, keeping the manager focused on orchestration"
 * - "The project manager never does the specialized work itself"
 * - Prevents "Jack of all trades, master of none" anti-pattern
 *
 * Reference: https://docs.crewai.com/en/concepts/collaboration
 * =============================================================================
 */

/**
 * Tools available to ORCHESTRATOR agents (agents with subagents).
 * These are coordination/planning tools only - no specialized execution.
 * NOTE: WebSearch and WebFetch are intentionally excluded to prevent orchestrators
 * from doing research themselves - they should delegate to subagents.
 */
const ORCHESTRATOR_TOOLS = [
  'Task',           // Spawn and delegate to subagents
  'TodoWrite',      // Track progress and plan work
  'AskUserQuestion', // Get clarification from user
  // NO WebSearch - orchestrators must delegate research to subagents
];

/**
 * Tools that should ONLY be available to WORKER agents (subagents).
 * Orchestrators should NOT have direct access to these.
 */
const WORKER_ONLY_TOOLS = [
  // Docker/Sandbox tools - file operations
  'Read', 'Write', 'Bash', 'Glob', 'Grep', 'Edit', 'MultiEdit', 'NotebookEdit',
  // Note: Custom tools and Connector tools are also worker-only (handled separately)
];

/**
 * Check if an agent is an orchestrator (has subagents defined)
 */
function isOrchestratorAgent(config: AgentConfig): boolean {
  return !!(config.subagents && Object.keys(config.subagents).length > 0);
}

/**
 * Validate agent configuration
 * Checks that all enabled tools are valid and available
 */
export function validateAgentConfig(config: AgentConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Tools that are not yet implemented
  const COMING_SOON_TOOLS = ['Edit', 'MultiEdit', 'NotebookEdit'];

  // Tools provided by Docker MCP server (all implemented)
  const DOCKER_MCP_TOOLS = ['Read', 'Write', 'Bash', 'Glob', 'Grep'];

  // MVP tools handled by the SDK
  const MVP_TOOLS = ['WebSearch', 'WebFetch', 'AskUserQuestion', 'TodoWrite', 'Task', 'Skill'];

  // Helper to check if a tool is valid
  const isValidTool = (tool: string): boolean => {
    // Coming soon tools - skip validation (not implemented yet)
    if (COMING_SOON_TOOLS.includes(tool)) return true;
    // Docker MCP tools - all implemented
    if (DOCKER_MCP_TOOLS.includes(tool)) return true;
    // MVP tools - handled by SDK
    if (MVP_TOOLS.includes(tool)) return true;
    // Custom tools - validated separately
    if (config.customTools?.some(ct => ct.name === tool)) return true;
    // Check tool registry for other sandbox tools
    if (isSandboxTool(tool)) return isToolRegistered(tool);
    // Unknown tools - assume valid (could be from MCP servers)
    return true;
  };

  // Check enabled tools are valid
  const invalidTools = config.tools.enabled.filter(tool => !isValidTool(tool));
  if (invalidTools.length > 0) {
    errors.push(`The following tools are not available: ${invalidTools.join(', ')}`);
  }

  // Check subagent tools
  if (config.subagents) {
    Object.entries(config.subagents).forEach(([name, subagent]) => {
      if (subagent.tools) {
        const invalidSubagentTools = subagent.tools.filter(tool => !isValidTool(tool));
        if (invalidSubagentTools.length > 0) {
          errors.push(`Subagent "${name}" uses unavailable tools: ${invalidSubagentTools.join(', ')}`);
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Determine settingSources based on skills configuration
 * SDK-native skills require 'project' to be included in settingSources
 * to load SKILL.md files from .claude/skills/
 */
function getSettingSourcesForSkills(
  hasSkillsEnabled: boolean,
  existingSettingSources?: SettingSource[]
): SettingSource[] | undefined {
  // If skills are enabled, ensure 'project' is in settingSources for SDK skill discovery
  if (hasSkillsEnabled) {
    const sources = new Set<SettingSource>(existingSettingSources || []);
    sources.add('project'); // Required for .claude/skills/ discovery
    sources.add('user');    // Also load user skills from ~/.claude/skills/
    return Array.from(sources);
  }

  // Return existing sources or undefined (SDK default is no settings loaded)
  return existingSettingSources && existingSettingSources.length > 0
    ? existingSettingSources
    : undefined;
}

/**
 * Convert output format to SDK format
 */
function convertOutputFormat(format?: AgentConfig['outputFormat']): any {
  if (!format) return undefined;

  return {
    type: format.type,
    schema: format.schema,
  };
}

/**
 * Create built-in hooks for orchestrator agents.
 * These hooks enforce the orchestrator/worker architecture:
 * - Validate Task calls have a valid subagent_type
 * - Reject Task calls with host paths instead of /scratch
 */
function createOrchestratorHooks(subagentNames: string[]): any {
  const validSubagentTypes = new Set(subagentNames);

  // SDK PreToolUseHookInput structure (from docs):
  // {
  //   hook_event_name: 'PreToolUse',
  //   tool_name: string,
  //   tool_input: unknown  // <-- Tool arguments are HERE
  // }
  // Reference: https://platform.claude.com/docs/en/agent-sdk/hooks
  return {
    PreToolUse: [
      {
        matcher: 'Task',
        hooks: [async (input: any, toolUseID?: string, context?: any) => {
          // Extract tool_input from the PreToolUseHookInput structure
          // The actual Task tool arguments are in input.tool_input, NOT directly in input
          const toolInput = input?.tool_input || {};

          const subagentType = toolInput.subagent_type;
          const prompt = toolInput.prompt || '';
          const description = toolInput.description || '';

          console.log(`[OrchestratorHook] Task call: subagent_type="${subagentType}", description="${description?.substring(0, 50)}..."`);

          // Check if subagent_type is specified
          if (!subagentType) {
            console.log('[OrchestratorHook] REJECTED: Task call missing subagent_type');
            return {
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: `Task call rejected: You MUST specify subagent_type. Valid options: ${Array.from(validSubagentTypes).join(', ')}. Example: {"subagent_type": "FileManager", "description": "Clone repo", "prompt": "Clone to /scratch/repo"}`
              }
            };
          }

          // Check if subagent_type is valid
          if (!validSubagentTypes.has(subagentType)) {
            console.log(`[OrchestratorHook] REJECTED: Invalid subagent_type "${subagentType}"`);
            return {
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: `Task call rejected: "${subagentType}" is not a valid subagent. Valid options: ${Array.from(validSubagentTypes).join(', ')}`
              }
            };
          }

          // Check for host paths in prompt (common mistake)
          if (prompt.includes('/Users/') || prompt.includes('/home/') || prompt.includes('C:\\')) {
            console.log('[OrchestratorHook] REJECTED: Task prompt contains host path');
            return {
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'Task call rejected: Your prompt contains a host path (/Users/... or /home/...). Subagents run in Docker and can ONLY access /scratch. Use /scratch paths instead.'
              }
            };
          }

          console.log(`[OrchestratorHook] ALLOWED: Task call to ${subagentType}`);
          return {
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'allow'
            }
          };
        }]
      }
    ]
  };
}

/**
 * Convert hooks to SDK format
 * Hook callbacks receive (input, toolUseID, options) and return Promise<HookJSONOutput>
 * Uses sandboxed execution to prevent code injection attacks
 */
function convertHooks(hooks?: AgentConfig['hooks'], orchestratorHooks?: any): any {
  const sdkHooks: any = {};

  // Add orchestrator hooks first (if provided)
  if (orchestratorHooks) {
    console.log('[ConvertHooks] Adding orchestrator hooks:', Object.keys(orchestratorHooks));
    Object.entries(orchestratorHooks).forEach(([event, hooksList]) => {
      if (!sdkHooks[event]) sdkHooks[event] = [];
      sdkHooks[event].push(...(hooksList as any[]));
      console.log(`[ConvertHooks] Added ${(hooksList as any[]).length} orchestrator hook(s) for event: ${event}`);
    });
  }

  if (!hooks || Object.keys(hooks).length === 0) {
    const result = Object.keys(sdkHooks).length > 0 ? sdkHooks : undefined;
    console.log('[ConvertHooks] No user hooks, returning:', result ? Object.keys(result) : 'undefined');
    return result;
  }

  // Process user hooks and merge with orchestrator hooks (append, don't overwrite!)
  // SDK expects: { PreToolUse: [{ matcher: 'Tool', hooks: [callback] }] }
  Object.entries(hooks).forEach(([event, hooksList]) => {
    if (hooksList && hooksList.length > 0) {
      // Initialize array if not exists (preserves orchestrator hooks)
      if (!sdkHooks[event]) sdkHooks[event] = [];

      const processedHooks = hooksList.map(hook => {
        // Validate hook code before creating handler
        const validation = validateCode(hook.code);
        if (!validation.valid) {
          console.error(`[Hooks] Invalid hook code for event '${event}': ${validation.error}`);
          // Return a no-op hook that logs the error
          return {
            matcher: hook.matcher,
            hooks: [async () => {
              console.error(`[Hooks] Skipping invalid hook for '${event}'`);
              return { hookSpecificOutput: { hookEventName: event } };
            }],
          };
        }

        return {
          matcher: hook.matcher,
          // SDK expects "hooks" array, not "handler"
          hooks: [createSafeHookHandler(hook.code)],
        };
      });

      // Append user hooks to existing array (preserves orchestrator hooks)
      sdkHooks[event].push(...processedHooks);
    }
  });

  return Object.keys(sdkHooks).length > 0 ? sdkHooks : undefined;
}

/**
 * Convert a GlobalMcpConnection to SDK McpServerConfig format
 * Supports all transport types: stdio, sse, http
 */
function connectionToSdkConfig(connection: ReturnType<typeof useMcpStore.getState>['getConnection'] extends (id: string) => infer R ? NonNullable<R> : never): any {
  switch (connection.type) {
    case 'stdio':
      return {
        type: 'stdio',
        command: connection.command,
        args: connection.args,
        env: connection.env,
      };
    case 'sse':
      return {
        type: 'sse',
        url: connection.url,
        headers: connection.headers,
      };
    case 'http':
      return {
        type: 'http',
        url: connection.url,
        headers: connection.headers,
      };
    default:
      // Fallback for any legacy connections without type (treat as stdio)
      // Cast to any to handle legacy connections that may not have 'type' field
      const legacyConn = connection as any;
      if (legacyConn.command) {
        return {
          type: 'stdio',
          command: legacyConn.command,
          args: legacyConn.args,
          env: legacyConn.env,
        };
      }
      console.warn(`[MCP] Unknown connection type for "${legacyConn.name}"`);
      return null;
  }
}

/**
 * Resolve MCP connections
 * Uses pre-resolved MCP servers from client if available, otherwise falls back to store lookup
 */
function resolveMcpConnections(connectionIds?: string[], resolvedMcpServers?: Record<string, any>): any {
  // If client already resolved the MCP servers, use those directly
  if (resolvedMcpServers && Object.keys(resolvedMcpServers).length > 0) {
    console.log('[MCP] Using pre-resolved MCP servers from client:', Object.keys(resolvedMcpServers));
    return { mcpServers: resolvedMcpServers };
  }

  // Fall back to store lookup (may not work on server-side due to localStorage)
  if (!connectionIds || connectionIds.length === 0) return undefined;

  const mcpStore = useMcpStore.getState();
  const mcpServers: any = {};

  console.log('[MCP] Resolving connections from store:', connectionIds);
  console.log('[MCP] Store has connections:', mcpStore.listConnections().map(c => ({ id: c.id, name: c.name })));

  connectionIds.forEach(id => {
    const connection = mcpStore.getConnection(id);
    console.log(`[MCP] Looking up connection ${id}:`, connection ? connection.name : 'NOT FOUND');
    if (connection) {
      const config = connectionToSdkConfig(connection);
      if (config) {
        mcpServers[connection.name] = config;
        console.log(`[MCP] Added server "${connection.name}":`, config.type);
      }
    }
  });

  console.log('[MCP] Final mcpServers:', Object.keys(mcpServers));
  return Object.keys(mcpServers).length > 0 ? { mcpServers } : undefined;
}

/**
 * Convert JSON Schema to Zod schema for SDK tool definitions
 * Supports basic JSON Schema types used in custom tools
 */
function jsonSchemaToZod(schema: JSONSchema): z.ZodTypeAny {
  if (!schema || !schema.type) {
    return z.unknown();
  }

  switch (schema.type) {
    case 'string':
      let stringSchema = z.string();
      if (schema.description) {
        stringSchema = stringSchema.describe(schema.description);
      }
      if (schema.minLength !== undefined) {
        stringSchema = stringSchema.min(schema.minLength);
      }
      if (schema.maxLength !== undefined) {
        stringSchema = stringSchema.max(schema.maxLength);
      }
      if (schema.pattern) {
        stringSchema = stringSchema.regex(new RegExp(schema.pattern));
      }
      if (schema.enum) {
        return z.enum(schema.enum as [string, ...string[]]);
      }
      return stringSchema;

    case 'number':
    case 'integer':
      let numberSchema = schema.type === 'integer' ? z.number().int() : z.number();
      if (schema.description) {
        numberSchema = numberSchema.describe(schema.description);
      }
      if (schema.minimum !== undefined) {
        numberSchema = numberSchema.min(schema.minimum);
      }
      if (schema.maximum !== undefined) {
        numberSchema = numberSchema.max(schema.maximum);
      }
      return numberSchema;

    case 'boolean':
      let boolSchema = z.boolean();
      if (schema.description) {
        boolSchema = boolSchema.describe(schema.description);
      }
      return boolSchema;

    case 'array':
      const itemSchema = schema.items ? jsonSchemaToZod(schema.items) : z.unknown();
      let arraySchema = z.array(itemSchema);
      if (schema.description) {
        arraySchema = arraySchema.describe(schema.description);
      }
      return arraySchema;

    case 'object':
      if (!schema.properties) {
        return z.record(z.string(), z.unknown());
      }
      const shape: Record<string, z.ZodTypeAny> = {};
      const required = schema.required || [];

      for (const [key, propSchema] of Object.entries(schema.properties)) {
        let fieldSchema = jsonSchemaToZod(propSchema as JSONSchema);
        if (!required.includes(key)) {
          fieldSchema = fieldSchema.optional();
        }
        shape[key] = fieldSchema;
      }
      return z.object(shape);

    default:
      return z.unknown();
  }
}

/**
 * Convert custom tools to SDK MCP server format
 * Uses createSdkMcpServer and tool() for type-safe, SDK-compliant custom tools
 * Uses sandboxed execution to prevent code injection attacks
 */
function convertCustomToolsToMcpServer(
  tools: AgentConfig['customTools'],
  agentId: string
): ReturnType<typeof createSdkMcpServer> | null {
  if (!tools || tools.length === 0) return null;

  const sdkTools = tools.map(customTool => {
    // Convert JSON Schema to Zod schema for the SDK
    const zodSchema = jsonSchemaToZod(customTool.inputSchema);

    // Get the shape from the Zod schema if it's an object
    const inputShape = zodSchema instanceof z.ZodObject
      ? zodSchema.shape
      : { input: zodSchema };

    // Validate handler code before creating the tool
    const validation = validateCode(customTool.handler);
    if (!validation.valid) {
      console.error(`[CustomTools] Invalid handler for tool '${customTool.name}': ${validation.error}`);
      // Return a tool that returns an error
      return tool(
        customTool.name,
        customTool.description,
        inputShape,
        async () => ({
          content: [{
            type: 'text' as const,
            text: `Tool '${customTool.name}' has invalid handler code and cannot be executed`
          }],
          isError: true
        })
      );
    }

    // Create sandboxed handler function
    const safeHandler = createSafeToolHandler(customTool.handler, customTool.name);

    // The handler receives (args, extra) and must return CallToolResult
    const handlerFn = async (args: Record<string, unknown>, _extra: unknown) => {
      try {
        const result = await safeHandler(args, { agentId });

        // Normalize result to CallToolResult format
        if (result && typeof result === 'object' && 'content' in result) {
          return result as { content: Array<{ type: string; text: string }> };
        }

        // Wrap primitive results in CallToolResult format
        return {
          content: [{
            type: 'text' as const,
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error executing tool ${customTool.name}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    };

    return tool(
      customTool.name,
      customTool.description,
      inputShape,
      handlerFn
    );
  });

  return createSdkMcpServer({
    name: `custom-tools-${agentId}`,
    version: '1.0.0',
    tools: sdkTools
  });
}

/**
 * Apply error handling configuration
 */
function applyErrorHandling(errorHandling?: AgentConfig['errorHandling']): any {
  if (!errorHandling) return {};

  const config: any = {};

  if (errorHandling.retryOnFailure) {
    config.retry = {
      maxRetries: errorHandling.maxRetries || 3,
      retryDelay: errorHandling.retryDelay || 1000,
    };
  }

  if (errorHandling.fallbackModel) {
    config.fallbackModel = errorHandling.fallbackModel;
  }

  if (errorHandling.fallbackTools && errorHandling.fallbackTools.length > 0) {
    config.fallbackTools = errorHandling.fallbackTools;
  }

  return config;
}

/**
 * Inject context (static and dynamic)
 * Returns structured context data for system prompt injection
 * Uses sandboxed execution for dynamic loaders to prevent code injection
 */
async function injectContext(context?: AgentConfig['context']): Promise<Record<string, unknown>> {
  if (!context) return {};

  const contextData: Record<string, unknown> = {};

  // Add static context
  if (context.static) {
    Object.assign(contextData, context.static);
  }

  // Load dynamic context using sandboxed execution
  if (context.dynamicLoader) {
    try {
      // Validate and create safe loader
      const validation = validateCode(context.dynamicLoader);
      if (!validation.valid) {
        console.error(`[Context] Invalid dynamic loader code: ${validation.error}`);
      } else {
        const safeLoader = createSafeContextLoader(context.dynamicLoader);
        const dynamicData = await safeLoader();
        Object.assign(contextData, dynamicData);
      }
    } catch (error) {
      console.error('Failed to load dynamic context:', error);
    }
  }

  return contextData;
}

/**
 * Format context data for system prompt injection
 * Produces clean, structured text that's easy for the agent to parse and reference
 */
function formatContextForSystemPrompt(contextData: Record<string, unknown>): string {
  if (Object.keys(contextData).length === 0) return '';

  const sections: string[] = [];

  for (const [key, value] of Object.entries(contextData)) {
    // Format key as readable header (snake_case/camelCase → Title Case)
    const header = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();

    // Format value based on type
    let formattedValue: string;
    if (typeof value === 'string') {
      formattedValue = value;
    } else if (Array.isArray(value)) {
      formattedValue = value.map(item =>
        typeof item === 'string' ? `- ${item}` : `- ${JSON.stringify(item)}`
      ).join('\n');
    } else if (typeof value === 'object' && value !== null) {
      // For objects, use YAML-like format for readability
      formattedValue = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join('\n');
    } else {
      formattedValue = String(value);
    }

    sections.push(`### ${header}\n${formattedValue}`);
  }

  return `\n\n## Agent Context\n\nThe following context has been provided for this session:\n\n${sections.join('\n\n')}`;
}

/**
 * Platform-level guidelines automatically injected into all agent system prompts.
 * These ensure consistent best practices across all agents regardless of how they're created.
 *
 * Placed at the end of the system prompt so user instructions take priority.
 * Can be disabled via `advanced.disablePlatformGuidelines: true` in AgentConfig.
 */
export const PLATFORM_GUIDELINES = `

---

## Platform Guidelines

The following guidelines are automatically applied to optimize performance and reliability:

### Writing Files
- Write files incrementally when content exceeds 2-3KB
- For reports/analysis: write header first, then append sections
- Save intermediate findings to separate files before synthesizing
- Prefer structured output (JSON/YAML) over prose for data-heavy content

### Working with APIs & MCP Servers
- Use pagination: request 20-50 items per page, not 100+
- For large documents, retrieve specific sections rather than full content
- If a query fails due to size limits, retry with smaller scope
- Process results incrementally rather than fetching everything at once

### File Operations
- Files can only be written to /scratch directory
- Read access: /scratch, /skills, /claude-cache
- Use appropriate tools: Read for files, Grep for searching, Glob for finding
`;

/**
 * FileManager subagent definition - auto-injected for orchestrator agents.
 * Handles all file setup operations: cloning repos, downloading files, preparing workspace.
 */
const FILE_MANAGER_SUBAGENT = {
  description: 'Handles all file operations: cloning git repositories, downloading files, creating directories, and preparing the /scratch workspace. ALWAYS use this agent FIRST when you need to set up files for analysis.',
  prompt: `You are FileManager, the file operations specialist. Your job is to prepare the /scratch workspace for other agents.

## Your Capabilities
- Clone git repositories: \`git clone <url> /scratch/<name>\`
- Download files: \`curl -o /scratch/<filename> <url>\`
- Create directories: \`mkdir -p /scratch/<path>\`
- Move/copy files within /scratch
- List directory contents
- Read and write files

## Critical Rules
1. ALWAYS use /scratch as the base directory - you cannot write anywhere else
2. Use descriptive names for cloned repos and downloaded files
3. Report back the EXACT paths of files/directories you create
4. If a clone or download fails, report the error clearly

## Example Tasks
- "Clone https://github.com/user/repo" → \`git clone https://github.com/user/repo /scratch/repo\` → Report: "Cloned to /scratch/repo"
- "Download this JSON file" → \`curl -o /scratch/data.json <url>\` → Report: "Saved to /scratch/data.json"
- "Set up workspace for analyzing project X" → Clone repo, create output directories → Report all paths

Always confirm what you created and where.`,
  model: 'haiku' as const  // Fast and cheap for file operations
};

/**
 * Subagent collaboration guidelines - STRONG enforcement for orchestrators.
 * This ensures the model understands it MUST delegate and CANNOT perform analysis itself.
 */
function getSubagentCollaborationGuidelines(subagentNames: string[], hasFileManager: boolean = true): string {
  return `

---
## MANDATORY: YOU ARE AN ORCHESTRATOR - YOU MUST DELEGATE

**CRITICAL CONSTRAINT**: You are a COORDINATION-ONLY agent. You CANNOT perform analysis yourself.

### Your ONLY Available Tools:
- **Task** - to delegate work to subagents (THIS IS YOUR PRIMARY TOOL)
- **TodoWrite** - to track progress
- **AskUserQuestion** - to get user input

### Tools You DO NOT Have Access To (BLOCKED):
- **WebSearch** - delegate research to subagents with WebSearch capability
- Read, Write, Bash, Glob, Grep (file operations)
- Any custom analysis tools (check_owasp_top10, analyze_dependencies, etc.)
- Direct file inspection of any kind

**If you try to use WebSearch, Read, Write, Bash, Glob, Grep, or any analysis tool directly, the operation WILL BE BLOCKED.**
**You CANNOT do research yourself - delegate to a subagent that has WebSearch.**

---

## HOW TO USE THE TASK TOOL

### Task Tool Format (REQUIRED):
\`\`\`json
{
  "subagent_type": "SubagentName",
  "description": "Brief description of task",
  "prompt": "Detailed instructions for the subagent"
}
\`\`\`

### Available Subagents (subagent_type values):
${subagentNames.map(name => `- **"${name}"**`).join('\n')}

---

## MANDATORY WORKFLOW

### Step 1: ALWAYS Start with FileManager
Before ANY analysis can happen, files must be in /scratch:
\`\`\`json
{
  "subagent_type": "FileManager",
  "description": "Clone repository",
  "prompt": "Clone https://github.com/user/repo to /scratch/repo"
}
\`\`\`

### Step 2: Delegate Analysis to Specialized Subagents
After FileManager confirms files are ready, delegate to analysis subagents:
\`\`\`json
{
  "subagent_type": "VulnerabilityScanner",
  "description": "Scan for XSS vulnerabilities",
  "prompt": "Analyze /scratch/repo for XSS vulnerabilities in JavaScript files"
}
\`\`\`

### Step 3: Generate Final Report
After all analysis is complete:
\`\`\`json
{
  "subagent_type": "ReportGenerator",
  "description": "Create security report",
  "prompt": "Compile all findings into /scratch/security-report.md"
}
\`\`\`

---

## CRITICAL RULES

1. **ALWAYS include "subagent_type"** - Task calls without it will be REJECTED
2. **ALWAYS use /scratch paths** (e.g., /scratch/repo, /scratch/report.md)
3. **NEVER use host paths** like /Users/... or /home/... - they don't exist in the container
4. **NEVER try to read files yourself** - you will get an error, delegate to a subagent instead
5. **ALWAYS start with FileManager** to clone/download files before analysis
6. **Run independent subagents in PARALLEL** when possible for efficiency

---

## EXAMPLE: Security Audit Workflow

1. \`Task(FileManager)\` → "Clone https://github.com/user/repo to /scratch/repo"
2. Run IN PARALLEL:
   - \`Task(VulnerabilityScanner)\` → "Scan /scratch/repo for OWASP vulnerabilities"
   - \`Task(DependencyAuditor)\` → "Analyze dependencies in /scratch/repo"
   - \`Task(SecretsHunter)\` → "Find hardcoded secrets in /scratch/repo"
   - \`Task(ComplianceChecker)\` → "Check security configuration in /scratch/repo"
3. \`Task(ReportGenerator)\` → "Compile all findings into final report"

---
`;
}

/**
 * Build system prompt with context and platform guidelines injection
 * Appends formatted context and platform guidelines to the base system prompt
 *
 * @param basePrompt - The agent's custom system prompt
 * @param contextData - Dynamic context to inject
 * @param options - Additional options for prompt building
 */
function buildSystemPromptWithContext(
  basePrompt: string,
  contextData: Record<string, unknown>,
  options: {
    injectPlatformGuidelines?: boolean;
    subagentNames?: string[];
    hasFileManager?: boolean;
  } = {}
): string {
  const { injectPlatformGuidelines = true, subagentNames = [], hasFileManager = false } = options;

  let finalPrompt = basePrompt;

  // Add context section if provided
  const contextSection = formatContextForSystemPrompt(contextData);
  if (contextSection) {
    finalPrompt += contextSection;
  }

  // Add platform guidelines (unless explicitly disabled)
  if (injectPlatformGuidelines) {
    finalPrompt += PLATFORM_GUIDELINES;

    // Add subagent collaboration guidelines if agent has subagents
    if (subagentNames.length > 0) {
      finalPrompt += getSubagentCollaborationGuidelines(subagentNames, hasFileManager);
      console.log(`[AgentConfig] Injected subagent collaboration guidelines for: ${subagentNames.join(', ')} (FileManager: ${hasFileManager ? 'yes' : 'no'})`);
    }
  }

  return finalPrompt;
}


/**
 * Convert AgentConfig to Claude Agent SDK Options format
 * Adds custom tool handlers for sandbox tools and includes skill content
 */
export async function agentConfigToSDKOptions(config: AgentConfig, containerId?: string) {
  // Migrate legacy hook event names to SDK-compliant names
  const migratedConfig = migrateHookEvents(config);

  // Validate configuration first
  const validation = validateAgentConfig(migratedConfig);
  if (!validation.valid) {
    throw new Error(
      `Agent configuration is invalid:\n${validation.errors.join('\n')}`
    );
  }

  // Check if skills are enabled (SDK-native skills)
  const hasSkillsEnabled = !!(migratedConfig.skills?.enabled && migratedConfig.skills.enabled.length > 0);

  // Determine settingSources for SDK skill discovery
  // Skills require 'project' and 'user' to be in settingSources to load SKILL.md files
  const settingSources = getSettingSourcesForSkills(
    hasSkillsEnabled,
    migratedConfig.advanced?.settingSources
  );

  // Note: Subagent conversion moved below after MCP servers are created
  // This allows us to share MCP servers with subagents for container access

  // ==========================================================================
  // ORCHESTRATOR VS WORKER ARCHITECTURE ENFORCEMENT
  // ==========================================================================
  // Check if this agent is an orchestrator (has subagents defined)
  // Orchestrators can ONLY use orchestration tools and MUST delegate to subagents
  const isOrchestrator = isOrchestratorAgent(migratedConfig);
  const subagentCount = migratedConfig.subagents ? Object.keys(migratedConfig.subagents).length : 0;
  const customToolCount = migratedConfig.customTools?.length || 0;

  console.log(`[AgentConfig] Agent "${migratedConfig.name}" - isOrchestrator: ${isOrchestrator}, subagents: ${subagentCount}, customTools: ${customToolCount}`);

  if (isOrchestrator) {
    console.log('[AgentConfig] 🎯 ORCHESTRATOR MODE: Agent has subagents - enforcing delegation architecture');
    console.log('[AgentConfig] Orchestrator will only receive coordination tools (Task, TodoWrite, etc.)');
    console.log('[AgentConfig] Specialized tools (Docker, Custom, Connectors) will only go to subagents');
  }

  // Separate MVP tools from sandbox tools
  // Sandbox tools are handled via Docker MCP server to ensure proper isolation
  let mvpTools = migratedConfig.tools.enabled.filter(tool => !isSandboxTool(tool));
  const sandboxTools = migratedConfig.tools.enabled.filter(tool => isSandboxTool(tool));

  // ORCHESTRATOR ENFORCEMENT: Filter MVP tools to only orchestration tools
  // This prevents the orchestrator from using specialized tools directly
  if (isOrchestrator) {
    const originalMvpTools = [...mvpTools];
    mvpTools = mvpTools.filter(tool => ORCHESTRATOR_TOOLS.includes(tool));

    // Ensure Task tool is always available for orchestrators
    if (!mvpTools.includes('Task')) {
      mvpTools.push('Task');
    }

    const removedTools = originalMvpTools.filter(tool => !mvpTools.includes(tool));
    if (removedTools.length > 0) {
      console.log(`[AgentConfig] Orchestrator: Removed non-orchestration tools from parent: ${removedTools.join(', ')}`);
    }
  }

  console.log(`[AgentConfig] MVP tools: ${mvpTools.join(', ')}`);
  console.log(`[AgentConfig] Sandbox tools: ${sandboxTools.join(', ')}`);
  console.log(`[AgentConfig] Container ID: ${containerId || 'none'}`);

  // Docker MCP server for sandboxed tools (created only if container is available)
  let dockerMcpServer: ReturnType<typeof createDockerMcpServer> | null = null;
  const dockerMcpToolNames: string[] = [];

  // Get resource limits with defaults applied
  const resourceLimits = getResourceLimitsWithDefaults(migratedConfig.settings?.limits);

  // ORCHESTRATOR FIX: For orchestrators, create Docker MCP server even if parent doesn't
  // have sandbox tools enabled - subagents need it!
  const needsDockerForSubagents = isOrchestrator && containerId;

  if ((sandboxTools.length > 0 || needsDockerForSubagents) && containerId) {
    // Create Docker MCP server with container-isolated tools and resource limits
    dockerMcpServer = createDockerMcpServer(containerId, migratedConfig.id, resourceLimits);

    // Map enabled sandbox tools to their MCP names (for non-orchestrators)
    // The Docker MCP server exposes: mcp__docker__Read, mcp__docker__Write, etc.
    sandboxTools.forEach(toolName => {
      // Our Docker MCP server provides: Read, Write, Bash, Glob, Grep
      if (['Read', 'Write', 'Bash', 'Glob', 'Grep'].includes(toolName)) {
        dockerMcpToolNames.push(`mcp__docker__${toolName}`);
      }
    });

    // For orchestrators, subagents get all Docker tools (even if parent doesn't use them)
    if (isOrchestrator && dockerMcpToolNames.length === 0) {
      console.log('[AgentConfig] Orchestrator: Docker MCP server created for subagent use');
    } else if (dockerMcpToolNames.length > 0) {
      console.log(`[AgentConfig] Docker MCP tools: ${dockerMcpToolNames.join(', ')}`);
    }
  } else if (sandboxTools.length > 0 && !containerId) {
    console.warn('[AgentConfig] Sandbox tools enabled but no container ID - tools will not work!');
  } else if (isOrchestrator && !containerId) {
    console.warn('[AgentConfig] Orchestrator needs container for subagents but no container ID provided!');
  }

  // Create SDK MCP server for custom tools (Phase 3)
  // Uses createSdkMcpServer for type-safe, SDK-compliant custom tools
  const customToolsMcpServer = convertCustomToolsToMcpServer(
    migratedConfig.customTools,
    migratedConfig.id
  );

  // Create connector MCP server for OAuth-connected services
  // This provides tools like gmail_list, drive_search, slack_send, etc.
  let connectorMcpServer: ReturnType<typeof createConnectorMcpServer> = null;
  const connectorToolNames: string[] = [];

  if (migratedConfig.connectors && migratedConfig.connectors.length > 0) {
    // Resolve connector connections from the store
    const connectorStore = useConnectorStore.getState();
    const connectorConnections: Array<{
      connectionId: string;
      provider: OAuthProvider;
      getAccessToken: () => Promise<string>;
    }> = [];

    for (const connectionId of migratedConfig.connectors) {
      const connection = connectorStore.getConnection(connectionId);
      if (connection && connection.status === 'connected') {
        const encryptedTokens = connectorStore.getEncryptedTokens(connectionId);
        if (encryptedTokens) {
          connectorConnections.push({
            connectionId,
            provider: connection.provider,
            getAccessToken: async () => {
              // Decrypt tokens on demand
              const tokens = await decryptTokens(encryptedTokens);
              // TODO: Check if tokens are expired and refresh if needed
              return tokens.accessToken;
            },
          });

          // Add tool names for this provider
          const providerTools = getConnectorToolNames(connection.provider);
          providerTools.forEach(toolName => {
            if (!connectorToolNames.includes(`mcp__connectors__${toolName}`)) {
              connectorToolNames.push(`mcp__connectors__${toolName}`);
            }
          });
        }
      }
    }

    if (connectorConnections.length > 0) {
      connectorMcpServer = createConnectorMcpServer(connectorConnections);
      console.log(`[AgentConfig] Connector MCP tools: ${connectorToolNames.join(', ')}`);
    }
  }

  // Load context (Phase 3)
  const contextData = await injectContext(migratedConfig.context);

  // Convert Phase 3 fields
  const outputFormat = convertOutputFormat(migratedConfig.outputFormat);

  // Create orchestrator hooks if this is an orchestrator agent
  // These hooks validate Task calls to ensure proper subagent delegation
  let orchestratorHooks: any = undefined;
  if (isOrchestrator && migratedConfig.subagents) {
    const subagentNames = Object.keys(migratedConfig.subagents);
    // Add FileManager if it will be auto-injected
    if (!subagentNames.includes('FileManager')) {
      subagentNames.push('FileManager');
    }
    orchestratorHooks = createOrchestratorHooks(subagentNames);
    console.log(`[AgentConfig] Created orchestrator hooks for Task validation. Valid subagents: ${subagentNames.join(', ')}`);
  }

  const hooks = convertHooks(migratedConfig.hooks, orchestratorHooks);
  // Pass both connection IDs and pre-resolved servers (client resolves before sending to server)
  const mcpConfig = resolveMcpConnections(
    migratedConfig.mcpConnections,
    (migratedConfig as any).resolvedMcpServers
  );
  const errorHandlingConfig = applyErrorHandling(migratedConfig.errorHandling);

  // Build MCP servers configuration for the parent agent
  // Merge external MCP servers with internal MCP servers
  // ORCHESTRATOR ENFORCEMENT: Orchestrators don't get direct access to Docker/Custom/Connector servers
  const mcpServers: Record<string, any> = {
    ...(mcpConfig?.mcpServers || {})
  };

  // Custom tools MCP server name (used for both parent and subagent sharing)
  const customToolsMcpServerName = `custom-tools-${migratedConfig.id}`;

  // Add Docker MCP server if sandbox tools are enabled
  // ORCHESTRATOR FIX: Register at parent level for INHERITANCE - subagents inherit MCP servers from parent
  // The disallowedTools list prevents the orchestrator from using them directly
  if (dockerMcpServer) {
    mcpServers['docker'] = dockerMcpServer;
    if (isOrchestrator) {
      console.log('[AgentConfig] Docker MCP server registered at parent (subagents inherit, parent blocked via disallowedTools)');
    } else {
      console.log('[AgentConfig] Added Docker MCP server (worker mode)');
    }
  }

  // Add custom tools MCP server if present
  // ORCHESTRATOR FIX: Register at parent level for INHERITANCE
  if (customToolsMcpServer) {
    mcpServers[customToolsMcpServerName] = customToolsMcpServer;
    if (isOrchestrator) {
      console.log('[AgentConfig] Custom Tools MCP server registered at parent (subagents inherit, parent blocked via disallowedTools)');
    } else {
      console.log('[AgentConfig] Added Custom Tools MCP server (worker mode)');
    }
  }

  // Add connector MCP server if OAuth connectors are configured
  // ORCHESTRATOR FIX: Register at parent level for INHERITANCE
  if (connectorMcpServer) {
    mcpServers['connectors'] = connectorMcpServer;
    if (isOrchestrator) {
      console.log('[AgentConfig] Connector MCP server registered at parent (subagents inherit, parent blocked via disallowedTools)');
    } else {
      console.log('[AgentConfig] Added Connector MCP server (worker mode)');
    }
  }

  // ==========================================================================
  // SUBAGENT PROCESSING WITH AUTO-INJECTION AND MCP INHERITANCE
  // ==========================================================================

  const agents: Record<string, any> = {};
  let hasFileManager = false;

  if (migratedConfig.subagents && isOrchestrator) {
    // Check if FileManager already exists
    hasFileManager = 'FileManager' in migratedConfig.subagents;

    // AUTO-INJECT FileManager if not present
    // This ensures every orchestrator has a way to set up files
    if (!hasFileManager) {
      console.log('[AgentConfig] 📁 Auto-injecting FileManager subagent for orchestrator');
      migratedConfig.subagents = {
        FileManager: FILE_MANAGER_SUBAGENT,
        ...migratedConfig.subagents
      };
      hasFileManager = true;
    }

    // MCP servers are registered at parent level and inherited by subagents
    // Build the list of available tools for subagents
    // This includes Docker MCP tools and custom tools
    const subagentAvailableTools: string[] = [];

    // Add Docker MCP tool names
    if (dockerMcpServer) {
      ['Read', 'Write', 'Bash', 'Glob', 'Grep'].forEach(tool => {
        subagentAvailableTools.push(`mcp__docker__${tool}`);
      });
    }

    // Add custom tool MCP names
    if (customToolsMcpServer && migratedConfig.customTools) {
      migratedConfig.customTools.forEach(customTool => {
        subagentAvailableTools.push(`mcp__${customToolsMcpServerName}__${customTool.name}`);
      });
    }

    // Add connector tool names
    if (connectorMcpServer) {
      connectorToolNames.forEach(toolName => {
        subagentAvailableTools.push(toolName);
      });
    }

    // Docker tools that need MCP prefix conversion
    const DOCKER_TOOL_NAMES = ['Read', 'Write', 'Bash', 'Glob', 'Grep'];

    // Get custom tool names for MCP prefix conversion
    const customToolNames = migratedConfig.customTools?.map(t => t.name) || [];

    // Process each subagent
    Object.entries(migratedConfig.subagents).forEach(([name, subagent]) => {
      // Determine tools for this subagent
      // IMPORTANT: Plain tool names (Bash, Read) are in disallowedTools to block SDK's built-in versions
      // Subagents must use MCP-prefixed names to access Docker MCP and custom tools
      let subagentTools: string[] | undefined;

      if (subagent.tools && subagent.tools.length > 0) {
        // Convert plain tool names to MCP-prefixed names
        subagentTools = subagent.tools.map(toolName => {
          // Convert Docker tools: Bash -> mcp__docker__Bash
          if (DOCKER_TOOL_NAMES.includes(toolName)) {
            return `mcp__docker__${toolName}`;
          }
          // Convert custom tools: check_owasp_top10 -> mcp__custom-tools-{agentId}__check_owasp_top10
          if (customToolNames.includes(toolName)) {
            return `mcp__${customToolsMcpServerName}__${toolName}`;
          }
          // Keep other tools as-is (e.g., SDK tools like TodoWrite)
          return toolName;
        });
        console.log(`[AgentConfig] Subagent "${name}" tools converted: ${subagent.tools.join(', ')} -> ${subagentTools.join(', ')}`);
      } else {
        // No explicit tools - let SDK handle inheritance (pass undefined)
        // Subagents will inherit all tools including MCP tools from parent
        subagentTools = undefined;
        console.log(`[AgentConfig] Subagent "${name}" has no explicit tools - will inherit from parent`);
      }

      // Enhance subagent prompt with /scratch awareness
      const enhancedPrompt = `${subagent.prompt}

---
## Workspace Information
- Your workspace is the /scratch directory
- All files you need to access should be in /scratch
- Write your outputs to /scratch (e.g., /scratch/results.md)
- You have access to: Bash, Read, Write, Glob, Grep tools via the Docker MCP server
${migratedConfig.customTools && migratedConfig.customTools.length > 0 ? `- Custom tools available: ${migratedConfig.customTools.map(t => t.name).join(', ')}` : ''}`;

      agents[name] = {
        description: subagent.description,
        prompt: enhancedPrompt,
        tools: subagentTools,
        model: subagent.model === 'inherit' ? undefined : subagent.model,
        // Safety limit to prevent runaway subagents
        maxTurns: 15,
        // Subagents INHERIT MCP servers from parent automatically
        // No need to pass mcpServers explicitly - SDK handles inheritance
      };

      console.log(`[AgentConfig] Configured subagent "${name}" with ${subagentTools?.length || 'inherited'} tools`);
    });

    console.log('[AgentConfig] Subagents will inherit MCP servers from parent (docker, custom-tools, connectors)');
  } else if (migratedConfig.subagents && !isOrchestrator) {
    // Non-orchestrator with subagents (shouldn't happen, but handle gracefully)
    Object.entries(migratedConfig.subagents).forEach(([name, subagent]) => {
      agents[name] = {
        description: subagent.description,
        prompt: subagent.prompt,
        tools: subagent.tools,
        model: subagent.model === 'inherit' ? undefined : subagent.model,
      };
    });
  }

  // Debug logging for agents parameter - helps verify SDK receives correct subagent config
  if (Object.keys(agents).length > 0) {
    console.log('[AgentConfig] ═══════════════════════════════════════════════════════');
    console.log('[AgentConfig] Final agents configuration for SDK (with MCP-prefixed tools):');
    Object.entries(agents).forEach(([name, config]: [string, any]) => {
      console.log(`[AgentConfig]   └─ ${name}:`);
      console.log(`[AgentConfig]      tools=${config.tools?.join(', ') || 'inherited (undefined)'}`);
      console.log(`[AgentConfig]      model=${config.model || 'inherited'}`);
      console.log(`[AgentConfig]      maxTurns=${config.maxTurns || 'default'}`);
    });
    console.log('[AgentConfig] ═══════════════════════════════════════════════════════');
  }

  // Store hasFileManager for later use in guidelines
  const orchestratorHasFileManager = hasFileManager;

  // Build allowed tools list
  // Include MVP tools + Docker MCP tool names + custom tool MCP names
  // ORCHESTRATOR ENFORCEMENT: Orchestrators only get coordination tools, not specialized tools
  const allowedToolsList: string[] = [...mvpTools];

  // Add Docker MCP tool names (mcp__docker__Read, etc.) instead of SDK's built-in sandbox tools
  // This ensures sandbox tools route through our Docker container
  // ORCHESTRATOR ENFORCEMENT: Skip for orchestrators - they delegate file operations to subagents
  if (!isOrchestrator) {
    dockerMcpToolNames.forEach(toolName => {
      if (!allowedToolsList.includes(toolName)) {
        allowedToolsList.push(toolName);
      }
    });
  } else if (dockerMcpToolNames.length > 0) {
    console.log(`[AgentConfig] Orchestrator: Docker tools available only to subagents: ${dockerMcpToolNames.join(', ')}`);
  }

  // Add 'Skill' tool when skills are enabled (SDK-native skills)
  if (hasSkillsEnabled && !allowedToolsList.includes('Skill')) {
    allowedToolsList.push('Skill');
  }

  // Add custom tool MCP names
  // ORCHESTRATOR ENFORCEMENT: Skip for orchestrators - they delegate custom tool operations to subagents
  if (!isOrchestrator && customToolsMcpServer && migratedConfig.customTools) {
    migratedConfig.customTools.forEach(customTool => {
      // MCP tools use the format: mcp__<server_name>__<tool_name>
      allowedToolsList.push(`mcp__${customToolsMcpServerName}__${customTool.name}`);
    });
  } else if (isOrchestrator && migratedConfig.customTools && migratedConfig.customTools.length > 0) {
    console.log(`[AgentConfig] Orchestrator: Custom tools available only to subagents: ${migratedConfig.customTools.map(t => t.name).join(', ')}`);
  }

  // Add connector MCP tool names (mcp__connectors__gmail_list, etc.)
  // ORCHESTRATOR ENFORCEMENT: Skip for orchestrators - they delegate API operations to subagents
  if (!isOrchestrator) {
    connectorToolNames.forEach(toolName => {
      if (!allowedToolsList.includes(toolName)) {
        allowedToolsList.push(toolName);
      }
    });
  } else if (connectorToolNames.length > 0) {
    console.log(`[AgentConfig] Orchestrator: Connector tools available only to subagents: ${connectorToolNames.join(', ')}`);
  }

  // Build disallowed tools list
  // IMPORTANT: Always disable SDK's built-in sandbox tools (Read, Write, Bash, Glob, Grep, Edit)
  // These run directly on the host filesystem and bypass our Docker sandbox!
  // Instead, we use our Docker MCP server which provides mcp__docker__* tools
  const SDK_BUILTIN_SANDBOX_TOOLS = [
    'Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Glob', 'Grep', 'NotebookEdit'
  ];

  const SDK_DEFAULT_TOOLS = [
    ...SDK_BUILTIN_SANDBOX_TOOLS,
    'WebSearch', 'WebFetch', 'TodoWrite', 'Task', 'AskUserQuestion',
    'ListMcpResources', 'ReadMcpResource', 'Skill'
  ];

  // Start with user-specified disabled tools
  const disallowedToolsList = [...migratedConfig.tools.disabled];

  // ALWAYS disable SDK's built-in sandbox tools to prevent host filesystem access
  SDK_BUILTIN_SANDBOX_TOOLS.forEach(tool => {
    if (!disallowedToolsList.includes(tool)) {
      disallowedToolsList.push(tool);
    }
  });

  // Add any other SDK default tool that's not in our allowed list
  SDK_DEFAULT_TOOLS.filter(tool => !SDK_BUILTIN_SANDBOX_TOOLS.includes(tool))
    .forEach(tool => {
      if (!allowedToolsList.includes(tool) && !disallowedToolsList.includes(tool)) {
        disallowedToolsList.push(tool);
      }
    });

  // ORCHESTRATOR ENFORCEMENT: For orchestrators, we DON'T block MCP tools via disallowedTools
  // because that blocks them globally for the entire session including subagents.
  // Instead, we use canUseTool callback to block MCP tools only for the orchestrator (parent).
  // See agentExecutor.ts where canUseTool is configured to handle this.
  //
  // MCP servers are registered at parent level, and subagents inherit access to them.
  // The orchestrator's allowedTools only includes coordination tools (Task, TodoWrite, etc.),
  // so MCP tools won't appear in the model's tool list for the orchestrator.
  //
  // Note: We still track which tools need to be blocked so canUseTool can enforce it.
  let orchestratorBlockedMcpTools: string[] = [];

  if (isOrchestrator) {
    // Build list of MCP tools that should be blocked for the orchestrator (but NOT via disallowedTools)
    const allDockerMcpTools = [
      'mcp__docker__Read',
      'mcp__docker__Write',
      'mcp__docker__Bash',
      'mcp__docker__Glob',
      'mcp__docker__Grep'
    ];

    orchestratorBlockedMcpTools = [...allDockerMcpTools];

    // Add custom tool MCP names
    if (migratedConfig.customTools && migratedConfig.customTools.length > 0) {
      console.log(`[AgentConfig] Orchestrator has ${migratedConfig.customTools.length} custom tools to track for blocking`);
      migratedConfig.customTools.forEach(customTool => {
        orchestratorBlockedMcpTools.push(`mcp__${customToolsMcpServerName}__${customTool.name}`);
      });
    }

    // Add connector MCP tools
    orchestratorBlockedMcpTools.push(...connectorToolNames);

    console.log('[AgentConfig] Orchestrator: MCP tools will be blocked via canUseTool (not disallowedTools)');
    console.log(`[AgentConfig] Tools to block for orchestrator only: ${orchestratorBlockedMcpTools.join(', ')}`);
  }

  // Remove duplicates
  const uniqueDisallowedTools = [...new Set(disallowedToolsList)];

  // Log tool configuration for debugging
  console.log('[AgentConfig] Allowed tools:', allowedToolsList);
  console.log('[AgentConfig] Disallowed tools:', uniqueDisallowedTools);

  // Build system prompt with context and platform guidelines injection
  // Context is injected into the system prompt since SDK doesn't have a native context option
  // Platform guidelines are injected by default unless explicitly disabled
  // Subagent collaboration guidelines are injected when agent has subagents
  const injectPlatformGuidelines = !migratedConfig.advanced?.disablePlatformGuidelines;
  const subagentNames = migratedConfig.subagents ? Object.keys(migratedConfig.subagents) : [];
  const systemPromptWithContext = buildSystemPromptWithContext(
    migratedConfig.systemPrompt,
    contextData,
    {
      injectPlatformGuidelines,
      subagentNames,
      hasFileManager: orchestratorHasFileManager,
    }
  );

  // Build SDK options
  const options: any = {
    // System prompt with injected context (SDK-native skills are auto-discovered separately)
    systemPrompt: systemPromptWithContext,

    // Model selection
    model: migratedConfig.model === 'inherit' ? undefined : migratedConfig.model,

    // Setting sources for SDK-native skill discovery
    // When skills are enabled, includes 'project' and 'user' to load SKILL.md files
    settingSources,

    // Tools configuration
    // MVP tools + Docker MCP tools (mcp__docker__*) are allowed
    // SDK's built-in sandbox tools are ALWAYS disabled to ensure Docker isolation
    allowedTools: allowedToolsList.length > 0 ? allowedToolsList : undefined,
    disallowedTools: uniqueDisallowedTools.length > 0 ? uniqueDisallowedTools : undefined,

    // Note: Sandbox tools are now provided via Docker MCP server, not via 'tools' parameter

    // MCP Servers (external + custom tools)
    mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,

    // Subagents
    agents: Object.keys(agents).length > 0 ? agents : undefined,

    // Advanced settings
    maxTurns: migratedConfig.settings?.maxTurns,
    maxBudgetUsd: migratedConfig.settings?.maxBudgetUsd,
    maxThinkingTokens: migratedConfig.settings?.maxThinkingTokens,
    permissionMode: migratedConfig.settings?.permissionMode,
    enableFileCheckpointing: migratedConfig.settings?.enableFileCheckpointing,
    cwd: migratedConfig.settings?.cwd,

    // Phase 3: Structured Outputs
    outputFormat,

    // Phase 3: Hooks - log what's being passed
    hooks: (() => {
      if (hooks) {
        console.log('[AgentConfig] Final hooks config:');
        Object.entries(hooks).forEach(([event, hooksList]) => {
          const matchers = (hooksList as any[]).map((h: any) => h.matcher || 'no-matcher').join(', ');
          console.log(`  - ${event}: ${(hooksList as any[]).length} hook(s) [matchers: ${matchers}]`);
        });
      } else {
        console.log('[AgentConfig] No hooks configured');
      }
      return hooks;
    })(),

    // Phase 3: Error Handling
    ...errorHandlingConfig,

    // Note: Context is injected into systemPrompt above (SDK has no native context option)

    // Phase 3: Advanced options
    betas: migratedConfig.advanced?.betas,
    // Use sandboxed execution for canUseTool callback to prevent code injection
    canUseTool: (() => {
      if (!migratedConfig.advanced?.canUseTool) return undefined;
      const validation = validateCode(migratedConfig.advanced.canUseTool);
      if (!validation.valid) {
        console.error(`[AgentConfig] Invalid canUseTool code: ${validation.error}`);
        return undefined;
      }
      return createSafeCanUseToolCallback(migratedConfig.advanced.canUseTool);
    })(),
    // Enable partial messages by default for streaming feedback
    includePartialMessages: migratedConfig.advanced?.includePartialMessages ?? true,
    // Note: settingSources is set at the top of options, includes skill-aware sources
    plugins: migratedConfig.advanced?.plugins,
    env: migratedConfig.advanced?.env,
    strictMcpConfig: migratedConfig.advanced?.strictMcpConfig,
  };

  // Remove undefined values
  Object.keys(options).forEach(key => {
    if (options[key] === undefined) {
      delete options[key];
    }
  });

  // Add orchestrator metadata for canUseTool enforcement in executor
  // The executor will use this to block MCP tools for the parent but allow for subagents
  if (isOrchestrator && orchestratorBlockedMcpTools.length > 0) {
    options._orchestratorBlockedTools = orchestratorBlockedMcpTools;
    options._isOrchestrator = true;
    console.log(`[AgentConfig] Passing ${orchestratorBlockedMcpTools.length} blocked tools to executor for canUseTool enforcement`);
  }

  return options;
}

/**
 * Get model display name
 */
export function getModelDisplayName(model: string): string {
  const modelMap: Record<string, string> = {
    'sonnet': 'Claude 3.5 Sonnet',
    'opus': 'Claude 3 Opus',
    'haiku': 'Claude 3 Haiku',
    'inherit': 'Default Model',
  };
  return modelMap[model] || model;
}

/**
 * Calculate estimated cost based on token usage
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  // Pricing as of 2026 (these are example rates, adjust as needed)
  const pricing: Record<string, { input: number; output: number }> = {
    'sonnet': { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
    'opus': { input: 15.0 / 1_000_000, output: 75.0 / 1_000_000 },
    'haiku': { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 },
  };

  const rates = pricing[model] || pricing['sonnet'];
  return (inputTokens * rates.input) + (outputTokens * rates.output);
}
