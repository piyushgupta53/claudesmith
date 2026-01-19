import { create } from 'zustand';
import type { AgentConfig } from '../types/agent';
import { storageService } from '../services/storageService';

interface AgentStore {
  // State
  agents: Map<string, AgentConfig>;
  activeAgentId: string | null;
  isLoading: boolean;

  // Actions
  setAgents: (agents: Map<string, AgentConfig>) => void;
  getAgent: (id: string) => AgentConfig | undefined;
  createAgent: (config: AgentConfig) => void;
  updateAgent: (id: string, config: Partial<AgentConfig>) => void;
  deleteAgent: (id: string) => void;
  setActiveAgent: (id: string | null) => void;
  listAgents: () => AgentConfig[];
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  // Initial state
  agents: new Map(),
  activeAgentId: null,
  isLoading: false,

  // Actions
  setAgents: (agents) => set({ agents }),

  getAgent: (id) => {
    return get().agents.get(id);
  },

  createAgent: (config) => {
    // Persist to storage
    storageService.saveAgent(config);

    set((state) => {
      const newAgents = new Map(state.agents);
      newAgents.set(config.id, config);
      return { agents: newAgents };
    });
  },

  updateAgent: (id, updates) => {
    const state = get();
    const agent = state.agents.get(id);
    if (!agent) return;

    const updatedAgent: AgentConfig = {
      ...agent,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Persist to storage
    storageService.saveAgent(updatedAgent);

    set(() => {
      const newAgents = new Map(state.agents);
      newAgents.set(id, updatedAgent);
      return { agents: newAgents };
    });
  },

  deleteAgent: (id) => {
    // Persist deletion to storage
    storageService.deleteAgent(id);

    set((state) => {
      const newAgents = new Map(state.agents);
      newAgents.delete(id);
      return {
        agents: newAgents,
        activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
      };
    });
  },

  setActiveAgent: (id) => set({ activeAgentId: id }),

  listAgents: () => {
    return Array.from(get().agents.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },
}));
