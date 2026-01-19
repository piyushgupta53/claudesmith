import { create } from 'zustand';
import type { ExecutionNode, ExecutionEvent, PermissionRequest, QuestionRequest, Checkpoint } from '../types/execution';
import type { ToolCall } from '../types/chat';

interface ExecutionStore {
  // State
  executions: Map<string, ExecutionNode>;  // sessionId -> execution
  events: Map<string, ExecutionEvent[]>;   // sessionId -> events
  toolCalls: Map<string, ToolCall[]>;      // sessionId -> tool calls
  permissions: Map<string, PermissionRequest[]>;  // sessionId -> pending permissions
  questions: Map<string, QuestionRequest[]>;  // sessionId -> pending questions
  checkpoints: Map<string, Checkpoint[]>;  // sessionId -> checkpoints

  // Actions
  getExecution: (sessionId: string) => ExecutionNode | undefined;
  setExecution: (sessionId: string, execution: ExecutionNode) => void;
  updateExecution: (sessionId: string, updates: Partial<ExecutionNode>) => void;
  deleteExecution: (sessionId: string) => void;

  addEvent: (sessionId: string, event: ExecutionEvent) => void;
  getEvents: (sessionId: string) => ExecutionEvent[];

  addToolCall: (sessionId: string, toolCall: ToolCall) => void;
  updateToolCall: (sessionId: string, toolCallId: string, updates: Partial<ToolCall>) => void;
  getToolCalls: (sessionId: string) => ToolCall[];

  addPermissionRequest: (sessionId: string, request: PermissionRequest) => void;
  removePermissionRequest: (sessionId: string, requestId: string) => void;
  getPendingPermissions: (sessionId: string) => PermissionRequest[];

  addQuestionRequest: (sessionId: string, request: QuestionRequest) => void;
  removeQuestionRequest: (sessionId: string, requestId: string) => void;
  getPendingQuestions: (sessionId: string) => QuestionRequest[];

  // Checkpoint actions
  addCheckpoint: (sessionId: string, checkpoint: Checkpoint) => void;
  getCheckpoints: (sessionId: string) => Checkpoint[];
  clearCheckpoints: (sessionId: string) => void;
}

export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  // Initial state
  executions: new Map(),
  events: new Map(),
  toolCalls: new Map(),
  permissions: new Map(),
  questions: new Map(),
  checkpoints: new Map(),

  // Execution actions
  getExecution: (sessionId) => {
    return get().executions.get(sessionId);
  },

  setExecution: (sessionId, execution) => set((state) => {
    const newExecutions = new Map(state.executions);
    newExecutions.set(sessionId, execution);
    return { executions: newExecutions };
  }),

  updateExecution: (sessionId, updates) => set((state) => {
    const execution = state.executions.get(sessionId);
    if (!execution) return state;

    const newExecutions = new Map(state.executions);
    newExecutions.set(sessionId, { ...execution, ...updates });
    return { executions: newExecutions };
  }),

  deleteExecution: (sessionId) => set((state) => {
    const newExecutions = new Map(state.executions);
    const newEvents = new Map(state.events);
    const newToolCalls = new Map(state.toolCalls);
    const newPermissions = new Map(state.permissions);
    const newQuestions = new Map(state.questions);
    const newCheckpoints = new Map(state.checkpoints);

    newExecutions.delete(sessionId);
    newEvents.delete(sessionId);
    newToolCalls.delete(sessionId);
    newPermissions.delete(sessionId);
    newQuestions.delete(sessionId);
    newCheckpoints.delete(sessionId);

    return {
      executions: newExecutions,
      events: newEvents,
      toolCalls: newToolCalls,
      permissions: newPermissions,
      questions: newQuestions,
      checkpoints: newCheckpoints,
    };
  }),

  // Event actions
  addEvent: (sessionId, event) => set((state) => {
    const sessionEvents = state.events.get(sessionId) || [];
    const newEvents = new Map(state.events);
    newEvents.set(sessionId, [...sessionEvents, event]);
    return { events: newEvents };
  }),

  getEvents: (sessionId) => {
    return get().events.get(sessionId) || [];
  },

  // Tool call actions
  addToolCall: (sessionId, toolCall) => set((state) => {
    const sessionToolCalls = state.toolCalls.get(sessionId) || [];
    const newToolCalls = new Map(state.toolCalls);
    newToolCalls.set(sessionId, [...sessionToolCalls, toolCall]);
    return { toolCalls: newToolCalls };
  }),

  updateToolCall: (sessionId, toolCallId, updates) => set((state) => {
    const sessionToolCalls = state.toolCalls.get(sessionId);
    if (!sessionToolCalls) return state;

    const newToolCalls = new Map(state.toolCalls);
    newToolCalls.set(
      sessionId,
      sessionToolCalls.map((tc) =>
        tc.id === toolCallId ? { ...tc, ...updates } : tc
      )
    );
    return { toolCalls: newToolCalls };
  }),

  getToolCalls: (sessionId) => {
    return get().toolCalls.get(sessionId) || [];
  },

  // Permission actions
  addPermissionRequest: (sessionId, request) => set((state) => {
    const sessionPermissions = state.permissions.get(sessionId) || [];
    const newPermissions = new Map(state.permissions);
    newPermissions.set(sessionId, [...sessionPermissions, request]);
    return { permissions: newPermissions };
  }),

  removePermissionRequest: (sessionId, requestId) => set((state) => {
    const sessionPermissions = state.permissions.get(sessionId);
    if (!sessionPermissions) return state;

    const newPermissions = new Map(state.permissions);
    newPermissions.set(
      sessionId,
      sessionPermissions.filter((p) => p.id !== requestId)
    );
    return { permissions: newPermissions };
  }),

  getPendingPermissions: (sessionId) => {
    return get().permissions.get(sessionId) || [];
  },

  // Question actions
  addQuestionRequest: (sessionId, request) => set((state) => {
    const sessionQuestions = state.questions.get(sessionId) || [];
    const newQuestions = new Map(state.questions);
    newQuestions.set(sessionId, [...sessionQuestions, request]);
    return { questions: newQuestions };
  }),

  removeQuestionRequest: (sessionId, requestId) => set((state) => {
    const sessionQuestions = state.questions.get(sessionId);
    if (!sessionQuestions) return state;

    const newQuestions = new Map(state.questions);
    newQuestions.set(
      sessionId,
      sessionQuestions.filter((q) => q.id !== requestId)
    );
    return { questions: newQuestions };
  }),

  getPendingQuestions: (sessionId) => {
    return get().questions.get(sessionId) || [];
  },

  // Checkpoint actions
  addCheckpoint: (sessionId, checkpoint) => set((state) => {
    const sessionCheckpoints = state.checkpoints.get(sessionId) || [];
    const newCheckpoints = new Map(state.checkpoints);
    newCheckpoints.set(sessionId, [...sessionCheckpoints, checkpoint]);
    return { checkpoints: newCheckpoints };
  }),

  getCheckpoints: (sessionId) => {
    return get().checkpoints.get(sessionId) || [];
  },

  clearCheckpoints: (sessionId) => set((state) => {
    const newCheckpoints = new Map(state.checkpoints);
    newCheckpoints.delete(sessionId);
    return { checkpoints: newCheckpoints };
  }),
}));
