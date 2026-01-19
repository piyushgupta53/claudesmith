import type { ChatMessage, ToolCall, SubagentCall } from './chat';

// Execution tree for tracking agent and subagent execution
export interface ExecutionNode {
  id: string;
  parentId: string | null;
  sessionId: string;
  agentType: string;
  agentName: string;

  // Status tracking
  status: ExecutionStatus;
  startTime: string;
  endTime?: string;
  duration?: number;

  // Execution data
  messages: ChatMessage[];
  toolCalls: ToolCall[];
  subagents: ExecutionNode[];

  // Metrics
  metrics?: ExecutionMetrics;
}

export type ExecutionStatus =
  | 'initializing'
  | 'running'
  | 'waiting_for_user'
  | 'waiting_for_permission'
  | 'completed'
  | 'failed'
  | 'interrupted';

export interface ExecutionMetrics {
  totalTurns: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  toolCallCount: number;
  subagentCount: number;
}

export interface ExecutionEvent {
  id: string;
  sessionId: string;
  type: ExecutionEventType;
  timestamp: string;
  data: any;
}

export type ExecutionEventType =
  | 'session_start'
  | 'user_prompt'
  | 'assistant_thinking'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'subagent_start'
  | 'subagent_end'
  | 'permission_request'
  | 'permission_response'
  | 'session_end'
  | 'error';

export interface PermissionRequest {
  id: string;
  toolName: string;
  toolInput: Record<string, any>;
  timestamp: string;
  suggestions?: string[];
}

export interface PermissionResponse {
  requestId: string;
  approved: boolean;
  timestamp: string;
}

// AskUserQuestion types
export interface QuestionRequest {
  id: string;
  questions: Question[];
  timestamp: string;
}

export interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionResponse {
  requestId: string;
  answers: Record<string, string>;  // question text -> selected label(s)
  timestamp: string;
}

// File Checkpointing types
export interface Checkpoint {
  id: string;                    // Unique ID for this checkpoint
  messageUuid: string;           // UUID from SDK message (used for rewindFiles)
  sessionId: string;
  timestamp: string;
  preview: string;               // First 100 chars of message content
  canRewind: boolean;            // Whether rewind is possible from this point
}

export interface RewindResult {
  canRewind: boolean;
  error?: string;
  filesChanged?: string[];
  insertions?: number;
  deletions?: number;
}

// Progress tracking for long-running tasks
// Based on Anthropic's claude-progress.txt pattern
export interface ProgressState {
  sessionId: string;
  taskDescription: string;
  startedAt: string;
  lastUpdatedAt: string;
  currentPhase: ProgressPhase;
  completedSteps: ProgressStep[];
  pendingSteps: string[];
  featureList?: FeatureStatus[];
  notes?: string;
}

export type ProgressPhase =
  | 'gathering_context'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'completed';

export interface ProgressStep {
  step: string;
  completedAt: string;
  result?: 'success' | 'failure';
}

export interface FeatureStatus {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

// SSE progress event data
export interface ProgressEvent {
  sessionId: string;
  phase: ProgressPhase;
  completedTools: number;
  totalTools?: number;
  currentTool?: string;
  percentComplete?: number;
  featureList?: FeatureStatus[];
}
