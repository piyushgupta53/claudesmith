// Chat session and message types
export interface ChatSession {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  status: SessionStatus;
}

export type SessionStatus = 'active' | 'completed' | 'error' | 'interrupted';

export interface ChatMessage {
  uuid: string;
  sessionId: string;
  type: MessageType;
  content: string | MessageContent[];
  timestamp: string;
  parent_tool_use_id?: string;  // For tracking subagent messages
}

export type MessageType =
  | 'user'
  | 'assistant'
  | 'system'
  | 'tool_result'
  | 'partial';

export interface MessageContent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, any>;
  output?: any;
  is_error?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
  output?: any;
  status: ToolCallStatus;
  timestamp: string;
  duration?: number;
  error?: string;
}

export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SubagentCall {
  id: string;  // tool_use_id from SDK
  parentSessionId: string;
  agentType: string;
  description: string;
  status: SubagentStatus;
  startTime: string;
  endTime?: string;
  progress?: string;
}

export type SubagentStatus = 'starting' | 'running' | 'completed' | 'failed';
