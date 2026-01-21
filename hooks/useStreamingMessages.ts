import { useEffect, useState, useCallback, useRef } from 'react';
import { useChatStore } from '@/lib/stores/chatStore';
import { useExecutionStore } from '@/lib/stores/executionStore';
import { useMcpStore } from '@/lib/stores/mcpStore';
import { ExecutionTracker } from '@/lib/services/executionTracker';
import { getToolDisplayName } from '@/lib/utils/toolDisplayNames';
import type { ChatMessage } from '@/lib/types/chat';
import type { Activity } from '@/components/chat/ActivityIndicator';

export interface StreamingEvent {
  type: 'connection' | 'message' | 'text' | 'tool_start' | 'tool_call' | 'tool_result' | 'subagent_start' | 'subagent_stop' | 'permission_request' | 'question_request' | 'result' | 'complete' | 'error' | 'status' | 'partial' | 'checkpoint' | 'progress';
  sessionId: string;
  timestamp: string;
  [key: string]: any;
}

export type ProgressPhase = 'gathering_context' | 'planning' | 'executing' | 'verifying' | 'completed';

export interface ProgressData {
  phase: ProgressPhase;
  completedTools: number;
  totalTools?: number;
  currentTool?: string;
  completedSteps?: number;
  pendingSteps?: number;
}

export interface ToolActivity {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed' | 'slow';
  startTime: string;
  endTime?: string;
  duration?: number;
  outputPreview?: string;
  subagentName?: string; // Name of the subagent that ran this tool
}

export interface ActiveSubagent {
  name: string;
  description: string;
  startTime: string;
}

// Tool is considered slow after this many milliseconds
const SLOW_TOOL_THRESHOLD_MS = 30000; // 30 seconds

// Phase to description mapping for better UX
const PHASE_DESCRIPTIONS: Record<ProgressPhase, string> = {
  gathering_context: 'Gathering context...',
  planning: 'Planning next steps...',
  executing: 'Executing changes...',
  verifying: 'Verifying results...',
  completed: 'Completed',
};

function getPhaseDescription(phase: ProgressPhase | null | undefined): string {
  if (!phase) return 'Processing...';
  return PHASE_DESCRIPTIONS[phase] || 'Processing...';
}

export function useStreamingMessages(sessionId: string | null) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([]);
  const [streamingText, setStreamingText] = useState<string>('');
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [activeSubagent, setActiveSubagent] = useState<ActiveSubagent | null>(null);
  const { addMessage, setStreaming } = useChatStore();
  const { addToolCall, updateToolCall, addEvent, setExecution, addPermissionRequest, addQuestionRequest, addCheckpoint } = useExecutionStore();
  const executionTrackerRef = useRef<ExecutionTracker | null>(null);
  const currentPhaseRef = useRef<ProgressPhase | null>(null);
  // Track active subagents to prevent tool_result from overwriting subagent status
  const activeSubagentNamesRef = useRef<Set<string>>(new Set());

  // PERFORMANCE FIX: Store EventSource and interval refs for proper cleanup
  // This prevents memory leaks when components unmount during streaming
  const eventSourceRef = useRef<EventSource | null>(null);
  const slowToolCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startStreaming = useCallback(async (agentConfig: any, prompt: string) => {
    if (!sessionId) return;

    setIsStreaming(true);
    setStreaming(true);
    setError(null);
    setCurrentActivity({ type: 'thinking', description: 'Starting...', timestamp: new Date().toISOString() });
    setToolActivities([]);
    setStreamingText('');
    setProgressData(null);
    setActiveSubagent(null);
    currentPhaseRef.current = null;
    activeSubagentNamesRef.current = new Set(); // Clear active subagents for new session

    // Initialize execution tracker
    const tracker = new ExecutionTracker(sessionId, agentConfig.name);
    executionTrackerRef.current = tracker;

    // Add user message to tracker
    const userMessage: ChatMessage = {
      uuid: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      type: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    tracker.addMessage(userMessage);
    addMessage(sessionId, userMessage);

    try {
      // Resolve MCP connection IDs to full configs (client-side has localStorage access)
      const mcpStore = useMcpStore.getState();
      let resolvedMcpServers: Record<string, any> | undefined;

      if (agentConfig.mcpConnections && agentConfig.mcpConnections.length > 0) {
        resolvedMcpServers = {};
        agentConfig.mcpConnections.forEach((connectionId: string) => {
          const connection = mcpStore.getConnection(connectionId);
          if (connection) {
            // Convert to SDK config format
            if (connection.type === 'stdio') {
              resolvedMcpServers![connection.name] = {
                type: 'stdio',
                command: connection.command,
                args: connection.args,
                env: connection.env,
              };
            } else if (connection.type === 'sse') {
              resolvedMcpServers![connection.name] = {
                type: 'sse',
                url: connection.url,
                headers: connection.headers,
              };
            } else if (connection.type === 'http') {
              resolvedMcpServers![connection.name] = {
                type: 'http',
                url: connection.url,
                headers: connection.headers,
              };
            }
            console.log(`[Client] Resolved MCP connection: ${connection.name}`, connection.type);
          } else {
            console.warn(`[Client] MCP connection not found: ${connectionId}`);
          }
        });
      }

      // Create config with resolved MCP servers
      const configWithResolvedMcp = {
        ...agentConfig,
        resolvedMcpServers, // Pass the full MCP configs to the server
      };

      const configJson = JSON.stringify(configWithResolvedMcp);
      const MAX_URL_CONFIG_SIZE = 6000; // Safe threshold for URL params

      let url: string;

      // For large configs, POST first to store server-side, then connect via SSE
      if (configJson.length > MAX_URL_CONFIG_SIZE) {
        console.log(`[Client] Config too large for URL (${configJson.length} chars), using POST + SSE`);

        // POST config to server first
        const configResponse = await fetch(`/api/chat/${sessionId}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentConfig: configWithResolvedMcp,
            prompt: prompt,
          }),
        });

        if (!configResponse.ok) {
          const errorData = await configResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to store config');
        }

        // Connect to stream without config in URL (server reads from store)
        url = `/api/chat/${sessionId}/stream`;
      } else {
        // Small config - use URL params (backwards compatible)
        const params = new URLSearchParams({
          agentConfig: configJson,
          prompt: prompt,
        });
        url = `/api/chat/${sessionId}/stream?${params}`;
      }

      // PERFORMANCE FIX: Close any existing EventSource before creating new one
      // This prevents orphaned connections if startStreaming is called multiple times
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (slowToolCheckIntervalRef.current) {
        clearInterval(slowToolCheckIntervalRef.current);
        slowToolCheckIntervalRef.current = null;
      }

      // Create EventSource for SSE and store in ref for cleanup
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Start interval to detect slow/stuck tools and store in ref for cleanup
      const slowToolCheckInterval = setInterval(() => {
        setToolActivities(prev => {
          const now = Date.now();
          let hasChanges = false;
          const updated = prev.map(ta => {
            // Only check tools that are currently running (not slow, completed, or failed)
            if (ta.status === 'running') {
              const startTime = new Date(ta.startTime).getTime();
              const elapsed = now - startTime;
              if (elapsed > SLOW_TOOL_THRESHOLD_MS) {
                hasChanges = true;
                console.log(`[UI] Tool ${ta.name} marked as slow (${Math.round(elapsed/1000)}s)`);
                return { ...ta, status: 'slow' as const };
              }
            }
            return ta;
          });
          return hasChanges ? updated : prev;
        });
      }, 5000); // Check every 5 seconds
      slowToolCheckIntervalRef.current = slowToolCheckInterval;

      eventSource.onmessage = (event) => {
        try {
          const data: StreamingEvent = JSON.parse(event.data);

          // Add event to execution store
          addEvent(sessionId, {
            id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sessionId,
            type: data.type as any,
            timestamp: data.timestamp,
            data,
          });

          // Handle different event types
          switch (data.type) {
            case 'connection':
              console.log('[UI] Connected to agent stream');
              break;

            case 'status':
              // Handle status updates (e.g., container initialization, thinking, waiting_for_model, subagent_running)
              console.log(`[UI] Status: ${data.status} - ${data.message}`);
              if (data.status === 'container_init') {
                setCurrentActivity({
                  type: 'thinking',
                  description: data.message || 'Initializing container...',
                  timestamp: data.timestamp,
                });
              } else if (data.status === 'subagent_running') {
                // Show which subagents are currently working
                setCurrentActivity({
                  type: 'subagent_running',
                  description: data.message || 'Subagents working...',
                  timestamp: data.timestamp,
                  elapsedSeconds: data.idleSeconds,
                  activeSubagents: data.activeSubagents || [],
                });
              } else if (data.status === 'thinking' || data.status === 'waiting_for_model') {
                // Update activity to show thinking/analyzing with elapsed time
                setCurrentActivity({
                  type: data.status as 'thinking' | 'waiting_for_model',
                  description: data.message || 'Thinking...',
                  timestamp: data.timestamp,
                  elapsedSeconds: data.idleSeconds,
                  lastToolName: data.lastToolName,
                });
              }
              break;

            case 'partial':
              // Handle streaming text deltas
              if (data.delta) {
                setStreamingText(prev => prev + data.delta);
                // Update activity to show we're generating text
                setCurrentActivity({
                  type: 'thinking',
                  description: 'Generating response...',
                  timestamp: data.timestamp,
                });
              }
              break;

            case 'text':
              // Add text message (final text, replaces streaming)
              const textMessage: ChatMessage = {
                uuid: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                sessionId,
                type: 'assistant',
                content: data.text,
                timestamp: data.timestamp,
              };
              addMessage(sessionId, textMessage);
              setStreamingText(''); // Clear streaming text since we have final
              if (executionTrackerRef.current) {
                executionTrackerRef.current.addMessage(textMessage);
              }
              break;

            case 'tool_start':
              // New detailed tool start event
              console.log(`[UI] Tool started: ${data.toolName}`);

              // Update current activity to show tool
              setCurrentActivity({
                type: 'tool_running',
                toolName: data.toolName,
                toolInput: data.toolInput,
                timestamp: data.timestamp,
              });

              // Add to tool activities
              setToolActivities(prev => [...prev, {
                id: data.toolCallId,
                name: data.toolName,
                input: data.toolInput,
                status: 'running',
                startTime: data.timestamp,
              }]);

              // Add tool call to execution store
              const newToolCall = {
                id: data.toolCallId,
                name: data.toolName,
                input: data.toolInput,
                status: 'running' as const,
                timestamp: data.timestamp,
              };
              addToolCall(sessionId, newToolCall);
              if (executionTrackerRef.current) {
                executionTrackerRef.current.addToolCall(newToolCall);
              }
              break;

            case 'tool_result':
              // Tool completed event
              console.log(`[UI] Tool completed: ${data.toolName} (${data.duration}ms)`);

              // Update tool activities
              setToolActivities(prev => prev.map(ta =>
                ta.id === data.toolCallId
                  ? {
                      ...ta,
                      status: data.success ? 'completed' : 'failed',
                      endTime: data.timestamp,
                      duration: data.duration,
                      outputPreview: data.outputPreview,
                    }
                  : ta
              ));

              // Update tool call in execution store
              updateToolCall(sessionId, data.toolCallId, {
                status: data.success ? 'completed' : 'failed',
                duration: data.duration,
                output: data.outputPreview,
              });

              // Only update to waiting_for_model if NO subagents are active
              // This prevents the activity indicator from flickering to "Analyzing results..."
              // when subagents are running and making many tool calls
              if (activeSubagentNamesRef.current.size === 0) {
                // No subagents running - show analyzing message
                setCurrentActivity({
                  type: 'waiting_for_model',
                  description: `Analyzing ${getToolDisplayName(data.toolName)} results...`,
                  timestamp: data.timestamp,
                  elapsedSeconds: 0,
                  lastToolName: data.toolName,
                });
              } else {
                // Subagents are running - show their progress with the tool being used
                const subagentNames = Array.from(activeSubagentNamesRef.current).join(', ');
                setCurrentActivity({
                  type: 'subagent_running',
                  description: `${subagentNames}: ${getToolDisplayName(data.toolName)}`,
                  timestamp: data.timestamp,
                  activeSubagents: Array.from(activeSubagentNamesRef.current),
                });
              }
              break;

            case 'tool_call':
              // Legacy event - keep for backwards compatibility
              const toolCall = {
                id: data.toolCall.id,
                name: data.toolCall.name,
                input: data.toolCall.input,
                status: 'running' as const,
                timestamp: data.timestamp,
              };
              addToolCall(sessionId, toolCall);
              if (executionTrackerRef.current) {
                executionTrackerRef.current.addToolCall(toolCall);
              }
              break;

            case 'subagent_start':
              console.log(`[UI] 🚀 Subagent started: ${data.subagentInfo?.agentType} - "${data.subagentInfo?.description}"`);
              if (executionTrackerRef.current && data.subagentInfo) {
                executionTrackerRef.current.startSubagent(
                  data.subagentInfo.id || `subagent-${Date.now()}`,
                  data.subagentInfo.type,
                  data.subagentInfo.description,
                  sessionId
                );
              }
              // Track active subagent for activity indicator
              const subagentName = data.subagentInfo?.agentType || 'Subagent';
              activeSubagentNamesRef.current.add(subagentName);
              // Set active subagent state for UI components
              setActiveSubagent({
                name: subagentName,
                description: data.subagentInfo?.description || '',
                startTime: data.timestamp,
              });
              // Show subagent in activity indicator
              setCurrentActivity({
                type: 'subagent_running',
                description: `${subagentName} starting...`,
                timestamp: data.timestamp,
                activeSubagents: Array.from(activeSubagentNamesRef.current),
              });
              break;

            case 'subagent_stop':
              console.log(`[UI] ✅ Subagent completed: ${data.subagentName} (${Math.round(data.duration / 1000)}s)`);
              if (executionTrackerRef.current) {
                executionTrackerRef.current.endSubagent(
                  data.toolCallId || `subagent-${Date.now()}`,
                  data.success ? 'completed' : 'failed'
                );
              }
              // Remove from active subagents tracking
              activeSubagentNamesRef.current.delete(data.subagentName);
              // If other subagents are still running, show them; otherwise clear active subagent
              if (activeSubagentNamesRef.current.size > 0) {
                const remainingSubagents = Array.from(activeSubagentNamesRef.current);
                // Update to first remaining subagent
                setActiveSubagent({
                  name: remainingSubagents[0],
                  description: '',
                  startTime: data.timestamp,
                });
                setCurrentActivity({
                  type: 'subagent_running',
                  description: `${remainingSubagents.join(', ')} working...`,
                  timestamp: data.timestamp,
                  activeSubagents: remainingSubagents,
                });
              } else {
                // All subagents done, clear active subagent and transition to analyzing
                setActiveSubagent(null);
                setCurrentActivity({
                  type: 'waiting_for_model',
                  description: `Analyzing ${data.subagentName} results...`,
                  timestamp: data.timestamp,
                  lastToolName: data.subagentName,
                });
              }
              break;

            case 'permission_request':
              console.log('Permission requested:', data.permissionRequest);
              if (data.permissionRequest) {
                addPermissionRequest(sessionId, {
                  id: data.permissionRequest.id || `perm-${Date.now()}`,
                  toolName: data.permissionRequest.toolName,
                  toolInput: data.permissionRequest.toolInput,
                  timestamp: data.timestamp,
                  suggestions: data.permissionRequest.suggestions,
                });
              }
              break;

            case 'question_request':
              console.log('Question requested:', data.questionRequest);
              if (data.questionRequest) {
                addQuestionRequest(sessionId, {
                  id: data.questionRequest.id || `q-${Date.now()}`,
                  questions: data.questionRequest.questions || [],
                  timestamp: data.timestamp,
                });
              }
              break;

            case 'checkpoint':
              // Handle file checkpoint events (for rewind functionality)
              console.log('Checkpoint created:', data.checkpoint?.messageUuid);
              if (data.checkpoint) {
                addCheckpoint(sessionId, data.checkpoint);
              }
              break;

            case 'progress':
              // Handle progress events for long-running tasks
              if (data.data || data.progress) {
                const progressInfo = data.data || data.progress;
                console.log('[UI] Progress update:', progressInfo.phase, 'tools:', progressInfo.completedTools);
                // Update ref for use in other handlers
                currentPhaseRef.current = progressInfo.phase;
                setProgressData({
                  phase: progressInfo.phase,
                  completedTools: progressInfo.completedTools || 0,
                  totalTools: progressInfo.totalTools,
                  currentTool: progressInfo.currentTool,
                  completedSteps: progressInfo.completedSteps,
                  pendingSteps: progressInfo.pendingSteps,
                });
                // Also update activity description based on phase
                setCurrentActivity(prev => prev ? {
                  ...prev,
                  description: getPhaseDescription(progressInfo.phase),
                } : null);
              }
              break;

            case 'result':
              // Check for explicit failure (success === false), not just falsy
              if (data.success === false) {
                console.error('Agent execution failed', data.error);
                setError(data.error || 'Execution failed');
              } else {
                // success === true or success is undefined (normal completion)
                console.log('Agent execution completed', data.usage);
              }
              break;

            case 'complete':
              console.log('Stream complete');

              // Finalize execution tracker
              if (executionTrackerRef.current) {
                executionTrackerRef.current.complete('completed');
                const executionTree = executionTrackerRef.current.getExecutionTree();
                if (executionTree) {
                  setExecution(sessionId, executionTree);
                }
              }

              // PERFORMANCE FIX: Cleanup and clear refs to prevent memory leaks
              clearInterval(slowToolCheckInterval);
              slowToolCheckIntervalRef.current = null;
              eventSource.close();
              eventSourceRef.current = null;
              setIsStreaming(false);
              setStreaming(false);
              setCurrentActivity(null);
              break;

            case 'error':
              console.error('Stream error:', data.error);
              setError(data.error);

              // Mark execution as failed
              if (executionTrackerRef.current) {
                executionTrackerRef.current.complete('failed');
                const executionTree = executionTrackerRef.current.getExecutionTree();
                if (executionTree) {
                  setExecution(sessionId, executionTree);
                }
              }

              // PERFORMANCE FIX: Cleanup and clear refs to prevent memory leaks
              clearInterval(slowToolCheckInterval);
              slowToolCheckIntervalRef.current = null;
              eventSource.close();
              eventSourceRef.current = null;
              setIsStreaming(false);
              setStreaming(false);
              setCurrentActivity(null);
              break;
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource error:', err);
        setError('Connection error');

        // Mark execution as failed
        if (executionTrackerRef.current) {
          executionTrackerRef.current.complete('failed');
          const executionTree = executionTrackerRef.current.getExecutionTree();
          if (executionTree) {
            setExecution(sessionId, executionTree);
          }
        }

        // PERFORMANCE FIX: Cleanup and clear refs to prevent memory leaks
        clearInterval(slowToolCheckInterval);
        slowToolCheckIntervalRef.current = null;
        eventSource.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
        setStreaming(false);
        setCurrentActivity(null);
      };

      // Note: Cleanup is now handled via refs in the complete/error handlers
      // and in the useEffect cleanup below
    } catch (err: any) {
      console.error('Failed to start streaming:', err);
      setError(err.message || 'Failed to start streaming');
      setIsStreaming(false);
      setStreaming(false);
      setCurrentActivity(null);
    }
  }, [sessionId, addMessage, addToolCall, updateToolCall, addEvent, setStreaming, setExecution, addPermissionRequest, addQuestionRequest, addCheckpoint]);

  // PERFORMANCE FIX: Cleanup EventSource and interval when component unmounts
  // This prevents memory leaks if the component unmounts during streaming
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        console.log('[UI] Cleanup: Closing EventSource on unmount');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (slowToolCheckIntervalRef.current) {
        clearInterval(slowToolCheckIntervalRef.current);
        slowToolCheckIntervalRef.current = null;
      }
    };
  }, []);

  return {
    isStreaming,
    error,
    currentActivity,
    toolActivities,
    streamingText,
    progressData,
    activeSubagent,
    startStreaming,
  };
}
