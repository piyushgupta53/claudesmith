'use client';

import { useEffect, ReactNode } from 'react';
import { useAgentSync } from '@/hooks/useAgentSync';
import { useChatSync } from '@/hooks/useChatSync';
import { useAgentStore } from '@/lib/stores/agentStore';
import { getAllTemplates } from '@/lib/utils/loadTemplates';

interface StorageProviderProps {
  children: ReactNode;
}

export function StorageProvider({ children }: StorageProviderProps) {
  // Sync stores with storage
  useAgentSync();
  useChatSync();

  const { agents, createAgent } = useAgentStore();

  // Load templates on first run if no agents exist
  useEffect(() => {
    const loadTemplates = async () => {
      // Wait a bit for agents to load from storage
      await new Promise(resolve => setTimeout(resolve, 100));

      if (agents.size === 0) {
        const templates = getAllTemplates();
        templates.forEach(template => {
          createAgent(template);
        });
      }
    };

    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return <>{children}</>;
}
