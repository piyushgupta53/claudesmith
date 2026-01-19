import { useEffect } from 'react';
import { useChatStore } from '../lib/stores/chatStore';
import { storageService } from '../lib/services/storageService';

/**
 * Hook to sync chat store with IndexedDB
 * Loads sessions on mount
 */
export function useChatSync() {
  const { setSessions } = useChatStore();

  // Load sessions from storage on mount
  useEffect(() => {
    const loadSessions = async () => {
      const storedSessions = await storageService.getAllSessions();
      const sessionsMap = new Map(storedSessions.map(s => [s.id, s]));
      setSessions(sessionsMap);
    };

    loadSessions();
  }, [setSessions]);

  return { isLoaded: true };
}
