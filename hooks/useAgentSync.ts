import { useEffect } from 'react';
import { useAgentStore } from '../lib/stores/agentStore';
import { storageService } from '../lib/services/storageService';

/**
 * Hook to sync agent store with localStorage
 * Loads agents on mount and saves on changes
 */
export function useAgentSync() {
  const { setAgents, agents } = useAgentStore();

  // Load agents from storage on mount
  useEffect(() => {
    const loadAgents = async () => {
      const storedAgents = await storageService.getAllAgents();
      setAgents(storedAgents);
    };

    loadAgents();
  }, [setAgents]);

  // Save agents to storage when they change
  useEffect(() => {
    const saveAgents = async () => {
      for (const agent of agents.values()) {
        await storageService.saveAgent(agent);
      }
    };

    if (agents.size > 0) {
      saveAgents();
    }
  }, [agents]);

  return { isLoaded: agents.size >= 0 };
}
