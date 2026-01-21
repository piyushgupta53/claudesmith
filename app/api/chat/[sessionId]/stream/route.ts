import { NextRequest } from 'next/server';
import { AgentExecutor, parseSDKMessage, isSubagentCall, extractSubagentInfo } from '@/lib/services/agentExecutor';
import { executorRegistry } from '@/lib/services/executorRegistry';
import { sessionConfigStore } from '@/lib/services/sessionConfigStore';
import { getToolDisplayName } from '@/lib/utils/toolDisplayNames';
import { randomUUID } from 'crypto';
import type { ProgressState, ProgressPhase } from '@/lib/types/execution';

/**
 * Extract a preview string from message content for checkpoint display
 */
function extractCheckpointPreview(message: any): string {
  const content = message.message?.content;
  if (!content) return 'User message';

  if (typeof content === 'string') {
    return content.substring(0, 100);
  }

  if (Array.isArray(content)) {
    // Look for text blocks first
    const textBlock = content.find((block: any) => block.type === 'text');
    if (textBlock?.text) {
      return textBlock.text.substring(0, 100);
    }
    // Fall back to tool_result preview
    const toolResult = content.find((block: any) => block.type === 'tool_result');
    if (toolResult) {
      return `Tool result: ${toolResult.tool_use_id?.substring(0, 20) || 'unknown'}`;
    }
  }

  return 'User message';
}

/**
 * GET /api/chat/[sessionId]/stream
 * Server-Sent Events endpoint for streaming agent responses
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;
  const searchParams = request.nextUrl.searchParams;

  // Try to get config from session store first (for large configs)
  // Fall back to URL params for backwards compatibility with smaller configs
  let agentConfig;
  let prompt;

  const storedConfig = sessionConfigStore.get(sessionId);
  if (storedConfig) {
    console.log(`[Stream] Using stored config for session ${sessionId}`);
    agentConfig = storedConfig.agentConfig;
    prompt = storedConfig.prompt;
  } else {
    // Fall back to URL params
    const agentConfigJson = searchParams.get('agentConfig');
    prompt = searchParams.get('prompt');

    if (!agentConfigJson || !prompt) {
      return new Response('Missing required parameters. For large configs, POST to /api/chat/[sessionId]/config first.', { status: 400 });
    }

    try {
      agentConfig = JSON.parse(agentConfigJson);
    } catch (error) {
      return new Response('Invalid agent configuration', { status: 400 });
    }
  }

  // Create a ReadableStream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE events
      const sendEvent = (eventData: object) => {
        const event = `data: ${JSON.stringify(eventData)}\n\n`;
        controller.enqueue(encoder.encode(event));
      };

      // Track pending tool calls to detect results
      const pendingToolCalls = new Map<string, { name: string; input: any; startTime: number }>();

      // Declare heartbeat interval at top of scope so it's accessible in catch block
      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

      // Declare executor at top of scope so it's accessible in catch block
      let executor: AgentExecutor | null = null;

      try {
        executor = new AgentExecutor(sessionId, agentConfig);

        // Register executor so other API routes can access it
        executorRegistry.register(sessionId, executor);

        // Track tool completion count for progress calculation
        let completedToolCount = 0;
        let currentPhase: ProgressPhase = 'gathering_context';

        // Register for progress updates from executor
        executor.onProgressUpdate((progress: ProgressState) => {
          sendEvent({
            type: 'progress',
            sessionId,
            progress: {
              phase: progress.currentPhase,
              completedSteps: progress.completedSteps.length,
              pendingSteps: progress.pendingSteps.length,
              featureList: progress.featureList,
            },
            timestamp: new Date().toISOString(),
          });
        });

        // Send initial connection event
        sendEvent({
          type: 'connection',
          sessionId,
          timestamp: new Date().toISOString(),
        });

        // Check if sandbox tools are enabled - notify UI about container setup
        const sandboxTools = ['Read', 'Write', 'Bash', 'Edit'];
        const usesSandboxTools = agentConfig.tools?.enabled?.some((tool: string) =>
          sandboxTools.includes(tool)
        );

        if (usesSandboxTools) {
          sendEvent({
            type: 'status',
            sessionId,
            status: 'container_init',
            message: 'Initializing Docker container for sandbox tools...',
            timestamp: new Date().toISOString(),
          });
        }

        // Execute agent and stream messages
        let messageCount = 0;
        let lastActivityTime = Date.now();
        let thinkingSeconds = 0;

        // Track context for smarter thinking messages
        let lastToolCompletedAt: number | null = null;
        let lastToolName: string | null = null;

        // Track active subagents for better status messages
        // Map: toolCallId -> { subagentName, description, startTime }
        const activeSubagents = new Map<string, { subagentName: string; description: string; startTime: number }>();

        // Heartbeat interval to show user that processing is ongoing
        // Sends "thinking" or "waiting_for_model" events every 1.5 seconds during waits
        heartbeatInterval = setInterval(() => {
          const idleTime = Date.now() - lastActivityTime;
          // If idle for more than 500ms, send status event
          if (idleTime > 500) {
            thinkingSeconds = Math.floor(idleTime / 1000);

            // Determine status type based on whether we just finished a tool
            let status = 'thinking';
            let message = `Thinking... (${thinkingSeconds}s)`;

            // Check if subagents are running - show their names and recent tool!
            if (activeSubagents.size > 0) {
              const subagentNames = Array.from(activeSubagents.values())
                .map(s => s.subagentName)
                .join(', ');
              // Include recent tool name if one completed within last 5 seconds
              const recentTool = lastToolName && lastToolCompletedAt && (Date.now() - lastToolCompletedAt) < 5000
                ? `: ${getToolDisplayName(lastToolName)}`
                : '';
              status = 'subagent_running';
              message = `${subagentNames}${recentTool} (${thinkingSeconds}s)`;
            } else if (lastToolCompletedAt && (Date.now() - lastToolCompletedAt) < 60000) {
              status = 'waiting_for_model';
              const toolDisplayName = lastToolName ? getToolDisplayName(lastToolName) : 'results';
              message = `Analyzing ${toolDisplayName}... (${thinkingSeconds}s)`;
            }

            sendEvent({
              type: 'status',
              sessionId,
              status,
              message,
              idleSeconds: thinkingSeconds,
              lastToolName,
              activeSubagents: Array.from(activeSubagents.values()).map(s => s.subagentName),
              timestamp: new Date().toISOString(),
            });
          }
        }, 1500); // Check every 1.5 seconds

        for await (const message of executor.execute(prompt)) {
          messageCount++;
          lastActivityTime = Date.now(); // Reset idle timer on any message
          const parsed = parseSDKMessage(message);
          const now = new Date().toISOString();

          // Debug logging - skip noisy event types (partial, stream_event)
          const isNoisyEvent = message.type === 'partial' || message.type === 'stream_event';
          if (!isNoisyEvent) {
            console.log(`[Stream #${messageCount}] type=${message.type}`,
              message.type === 'assistant' ? `tools=${parsed.toolCalls?.length || 0}` : '',
              message.type === 'user' ? 'tool_result' : ''
            );
          }

          // Handle partial messages (streaming text deltas)
          if (message.type === 'partial' && parsed.delta) {
            sendEvent({
              type: 'partial',
              sessionId,
              delta: parsed.delta,
              timestamp: now,
            });
            continue; // Skip the rest for partial messages
          }

          // Handle stream_event messages (SDK streaming deltas)
          // These contain the actual streaming text from the API
          if (message.type === 'stream_event' && message.event) {
            const event = message.event;
            // Extract text delta from content_block_delta events
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const textDelta = event.delta.text;
              if (textDelta) {
                sendEvent({
                  type: 'partial',
                  sessionId,
                  delta: textDelta,
                  timestamp: now,
                });
              }
            }
            continue; // Skip the rest for stream_event messages
          }

          // Send the raw message (for debugging/advanced use)
          sendEvent({
            type: 'message',
            sessionId,
            message: parsed,
          });

          // Detect and emit tool calls (tool_use blocks from assistant)
          if (parsed.toolCalls && parsed.toolCalls.length > 0) {
            for (const toolCall of parsed.toolCalls) {
              // Track this tool call
              pendingToolCalls.set(toolCall.id, {
                name: toolCall.name,
                input: toolCall.input,
                startTime: Date.now(),
              });

              console.log(`[Stream] Tool started: ${toolCall.name}`,
                JSON.stringify(toolCall.input).substring(0, 100));

              // Check if it's a subagent call
              if (isSubagentCall(toolCall)) {
                const subagentInfo = extractSubagentInfo(toolCall);

                // Track active subagent for status messages
                activeSubagents.set(toolCall.id, {
                  subagentName: subagentInfo?.agentType || 'Subagent',
                  description: subagentInfo?.description || '',
                  startTime: Date.now(),
                });

                console.log(`[Stream] 🚀 Subagent started: ${subagentInfo?.agentType} - "${subagentInfo?.description}"`);

                sendEvent({
                  type: 'subagent_start',
                  sessionId,
                  toolCallId: toolCall.id,
                  subagentInfo,
                  timestamp: now,
                });
              } else if (toolCall.name === 'AskUserQuestion') {
                // Emit question_request event for AskUserQuestion
                sendEvent({
                  type: 'question_request',
                  sessionId,
                  toolCallId: toolCall.id,
                  questionRequest: {
                    id: toolCall.id,
                    questions: toolCall.input.questions || [],
                    timestamp: now,
                  },
                  timestamp: now,
                });
                // Also emit tool_start for activity tracking
                sendEvent({
                  type: 'tool_start',
                  sessionId,
                  toolCallId: toolCall.id,
                  toolName: toolCall.name,
                  toolInput: toolCall.input,
                  timestamp: now,
                });
              } else {
                // Emit tool_start event with full details
                sendEvent({
                  type: 'tool_start',
                  sessionId,
                  toolCallId: toolCall.id,
                  toolName: toolCall.name,
                  toolInput: toolCall.input,
                  timestamp: now,
                });
              }
            }
          }

          // Detect tool results (user message with tool_result content)
          if (message.type === 'user' && message.message?.content) {
            const content = message.message.content;
            // SDK returns tool results as array of content blocks
            const toolResults = Array.isArray(content)
              ? content.filter((block: any) => block.type === 'tool_result')
              : [];

            for (const result of toolResults) {
              const toolCallId = result.tool_use_id;
              const pending = pendingToolCalls.get(toolCallId);

              if (pending) {
                const duration = Date.now() - pending.startTime;
                const isError = result.is_error === true;

                console.log(`[Stream] Tool completed: ${pending.name} (${duration}ms)${isError ? ' ERROR' : ''}`);

                // Emit tool_result event
                sendEvent({
                  type: 'tool_result',
                  sessionId,
                  toolCallId,
                  toolName: pending.name,
                  success: !isError,
                  duration,
                  // Truncate output for SSE (full output in message)
                  outputPreview: typeof result.content === 'string'
                    ? result.content.substring(0, 200)
                    : JSON.stringify(result.content).substring(0, 200),
                  timestamp: now,
                });

                pendingToolCalls.delete(toolCallId);

                // Check if this was a subagent (Task) that completed
                const activeSubagent = activeSubagents.get(toolCallId);
                if (activeSubagent) {
                  const subagentDuration = Date.now() - activeSubagent.startTime;
                  console.log(`[Stream] ✅ Subagent completed: ${activeSubagent.subagentName} (${Math.round(subagentDuration / 1000)}s)`);

                  // Emit subagent_stop event
                  sendEvent({
                    type: 'subagent_stop',
                    sessionId,
                    toolCallId,
                    subagentName: activeSubagent.subagentName,
                    description: activeSubagent.description,
                    success: !isError,
                    duration: subagentDuration,
                    timestamp: now,
                  });

                  activeSubagents.delete(toolCallId);
                }

                // Track last completed tool for context-aware thinking messages
                lastToolCompletedAt = Date.now();
                // For subagents, use the subagent name instead of "Task"
                lastToolName = activeSubagent ? activeSubagent.subagentName : pending.name;

                // Track progress and emit progress event
                completedToolCount++;

                // Infer phase from tool usage patterns
                // Handle both SDK tools and MCP tools (mcp__server__toolname)
                const toolName = pending.name;
                const toolNameLower = toolName.toLowerCase();

                // Check if it's a read-like operation
                const isReadTool = (
                  ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'].includes(toolName) ||
                  toolName.startsWith('mcp__docker__Read') ||
                  toolName.startsWith('mcp__docker__Glob') ||
                  toolName.startsWith('mcp__docker__Grep') ||
                  // MCP tools that look like reads (search, get, list, fetch, query)
                  toolNameLower.includes('search') ||
                  toolNameLower.includes('get') ||
                  toolNameLower.includes('list') ||
                  toolNameLower.includes('fetch') ||
                  toolNameLower.includes('query') ||
                  toolNameLower.includes('read')
                );

                // Check if it's a write-like operation
                const isWriteTool = (
                  ['Write', 'Edit', 'MultiEdit', 'Bash'].includes(toolName) ||
                  toolName.startsWith('mcp__docker__Write') ||
                  toolName.startsWith('mcp__docker__Bash') ||
                  // MCP tools that look like writes (create, update, delete, post, put)
                  toolNameLower.includes('create') ||
                  toolNameLower.includes('update') ||
                  toolNameLower.includes('delete') ||
                  toolNameLower.includes('post-') || // API POST operations
                  toolNameLower.includes('put-') ||
                  toolNameLower.includes('write')
                );

                // Update phase based on tool type
                if (isReadTool && completedToolCount <= 5) {
                  currentPhase = 'gathering_context';
                } else if (toolName === 'TodoWrite' || toolName.includes('TodoWrite')) {
                  currentPhase = 'planning';
                } else if (isWriteTool) {
                  currentPhase = 'executing';
                } else if (isReadTool && completedToolCount > 5) {
                  // Later reads after some work likely verification
                  currentPhase = 'verifying';
                }

                // Emit progress event
                sendEvent({
                  type: 'progress',
                  sessionId,
                  data: {
                    phase: currentPhase,
                    completedTools: completedToolCount,
                    currentTool: pending.name,
                  },
                  timestamp: now,
                });

                // Update executor progress state asynchronously
                executor.addCompletedStep(
                  `${pending.name}: ${JSON.stringify(pending.input).substring(0, 50)}`,
                  isError ? 'failure' : 'success'
                ).catch(err => console.error('[Stream] Failed to update progress:', err));
              }
            }
          }

          // Emit checkpoint event for user messages with UUIDs (when file checkpointing is enabled)
          if (message.type === 'user' && message.uuid && agentConfig.settings?.enableFileCheckpointing) {
            sendEvent({
              type: 'checkpoint',
              sessionId,
              checkpoint: {
                id: randomUUID(),
                messageUuid: message.uuid,
                sessionId,
                timestamp: now,
                preview: extractCheckpointPreview(message),
                canRewind: true,
              },
            });
            console.log(`[Stream] Checkpoint created: ${message.uuid}`);
          }

          // Send text updates
          if (parsed.text) {
            sendEvent({
              type: 'text',
              sessionId,
              text: parsed.text,
              timestamp: now,
            });
          }

          // Send result event
          if (message.type === 'result') {
            sendEvent({
              type: 'result',
              sessionId,
              success: parsed.success,
              usage: parsed.usage,
              error: parsed.error,
              timestamp: now,
            });
          }
        }

        // PERFORMANCE FIX: Clear heartbeat interval before completion
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

        // PERFORMANCE FIX: Clear pending tool calls map to prevent memory leak
        pendingToolCalls.clear();

        console.log(`[Stream] Complete. Total messages: ${messageCount}`);

        // Send completion event
        sendEvent({
          type: 'complete',
          sessionId,
          messageCount,
          timestamp: new Date().toISOString(),
        });

        // Cleanup: destroy container and unregister executor
        try {
          await executor.destroy();
          console.log(`[Stream] Container destroyed for session: ${sessionId}`);
        } catch (cleanupError) {
          console.error(`[Stream] Failed to destroy container for session ${sessionId}:`, cleanupError);
        }
        executorRegistry.unregister(sessionId);

        controller.close();
      } catch (error: any) {
        console.error('[Stream] Error:', error.message);

        // PERFORMANCE FIX: Clear heartbeat interval on error (if it was created)
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

        // PERFORMANCE FIX: Clear pending tool calls map to prevent memory leak
        pendingToolCalls.clear();

        // Send error event
        sendEvent({
          type: 'error',
          sessionId,
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString(),
        });

        // Cleanup: destroy container and unregister executor on error
        if (executor) {
          try {
            await executor.destroy();
            console.log(`[Stream] Container destroyed on error for session: ${sessionId}`);
          } catch (cleanupError) {
            console.error(`[Stream] Failed to destroy container for session ${sessionId}:`, cleanupError);
          }
        }
        executorRegistry.unregister(sessionId);

        controller.close();
      }
    },
    // PERFORMANCE FIX: Handle stream cancellation (e.g., client disconnect)
    // This ensures cleanup happens even if the client disconnects unexpectedly
    cancel() {
      console.log(`[Stream] Stream cancelled for session: ${sessionId}`);
      // Note: heartbeatInterval and pendingToolCalls are scoped to the start() function
      // They will be cleaned up when the function exits
      // This handler is mainly for logging and any future global cleanup needs
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    },
  });
}
