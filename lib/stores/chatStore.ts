import { create } from 'zustand';
import type { ChatSession, ChatMessage } from '../types/chat';

// PERFORMANCE FIX: Limit to prevent unbounded memory growth
// Sessions with 1000+ messages can severely degrade performance
// This keeps the most recent messages while allowing good conversation history
const MAX_MESSAGES_PER_SESSION = 1000;

interface ChatStore {
  // State
  sessions: Map<string, ChatSession>;
  activeSessionId: string | null;
  messages: Map<string, ChatMessage[]>;  // sessionId -> messages
  isStreaming: boolean;

  // Actions
  setSessions: (sessions: Map<string, ChatSession>) => void;
  getSession: (id: string) => ChatSession | undefined;
  createSession: (session: ChatSession) => void;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;
  setActiveSession: (id: string | null) => void;
  listSessions: () => ChatSession[];

  // Message actions
  getMessages: (sessionId: string) => ChatMessage[];
  addMessage: (sessionId: string, message: ChatMessage) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  clearMessages: (sessionId: string) => void;
  setStreaming: (isStreaming: boolean) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  sessions: new Map(),
  activeSessionId: null,
  messages: new Map(),
  isStreaming: false,

  // Session actions
  setSessions: (sessions) => set({ sessions }),

  getSession: (id) => {
    return get().sessions.get(id);
  },

  createSession: (session) => set((state) => {
    const newSessions = new Map(state.sessions);
    newSessions.set(session.id, session);
    return { sessions: newSessions };
  }),

  updateSession: (id, updates) => set((state) => {
    const session = state.sessions.get(id);
    if (!session) return state;

    const updatedSession: ChatSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const newSessions = new Map(state.sessions);
    newSessions.set(id, updatedSession);
    return { sessions: newSessions };
  }),

  deleteSession: (id) => set((state) => {
    const newSessions = new Map(state.sessions);
    const newMessages = new Map(state.messages);
    newSessions.delete(id);
    newMessages.delete(id);
    return {
      sessions: newSessions,
      messages: newMessages,
      activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
    };
  }),

  clearAllSessions: () => set({
    sessions: new Map(),
    messages: new Map(),
    activeSessionId: null,
  }),

  setActiveSession: (id) => set({ activeSessionId: id }),

  listSessions: () => {
    return Array.from(get().sessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  // Message actions
  getMessages: (sessionId) => {
    return get().messages.get(sessionId) || [];
  },

  addMessage: (sessionId, message) => set((state) => {
    let sessionMessages = state.messages.get(sessionId) || [];
    sessionMessages = [...sessionMessages, message];
    // PERFORMANCE FIX: FIFO eviction to prevent unbounded growth
    if (sessionMessages.length > MAX_MESSAGES_PER_SESSION) {
      sessionMessages = sessionMessages.slice(-MAX_MESSAGES_PER_SESSION);
    }
    const newMessages = new Map(state.messages);
    newMessages.set(sessionId, sessionMessages);

    // Update session message count
    const session = state.sessions.get(sessionId);
    if (session) {
      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        messageCount: sessionMessages.length,
        updatedAt: new Date().toISOString(),
      });
      return { messages: newMessages, sessions: newSessions };
    }

    return { messages: newMessages };
  }),

  updateMessage: (sessionId, messageId, updates) => set((state) => {
    const sessionMessages = state.messages.get(sessionId);
    if (!sessionMessages) return state;

    const newMessages = new Map(state.messages);
    newMessages.set(
      sessionId,
      sessionMessages.map((msg) =>
        msg.uuid === messageId ? { ...msg, ...updates } : msg
      )
    );
    return { messages: newMessages };
  }),

  clearMessages: (sessionId) => set((state) => {
    const newMessages = new Map(state.messages);
    newMessages.delete(sessionId);
    return { messages: newMessages };
  }),

  setStreaming: (isStreaming) => set({ isStreaming }),
}));
