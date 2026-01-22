import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { AgentConfig } from '../types/agent';
import type { ChatSession, ChatMessage } from '../types/chat';

// IndexedDB Schema
interface AgentPlatformDB extends DBSchema {
  agents: {
    key: string;
    value: AgentConfig;
    indexes: { 'by-updated': string; 'by-category': string };
  };
  sessions: {
    key: string;
    value: ChatSession;
    indexes: { 'by-agent': string; 'by-updated': string };
  };
  messages: {
    key: string;
    value: ChatMessage;
    indexes: { 'by-session': string; 'by-timestamp': string };
  };
}

const DB_NAME = 'claude-agent-platform';
const DB_VERSION = 1;

// LocalStorage keys
const STORAGE_KEYS = {
  AGENTS: 'claude-platform:agents',
  ACTIVE_AGENT: 'claude-platform:active-agent',
  ACTIVE_SESSION: 'claude-platform:active-session',
} as const;

class StorageService {
  private db: IDBPDatabase<AgentPlatformDB> | null = null;

  // PERFORMANCE: Cache for agents to avoid repeated localStorage parsing
  private agentsCache: Map<string, AgentConfig> | null = null;
  private agentsCacheValid: boolean = false;

  // Initialize IndexedDB
  async initDB(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<AgentPlatformDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Agents store
        if (!db.objectStoreNames.contains('agents')) {
          const agentStore = db.createObjectStore('agents', { keyPath: 'id' });
          agentStore.createIndex('by-updated', 'updatedAt');
          agentStore.createIndex('by-category', 'ui.category');
        }

        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by-agent', 'agentId');
          sessionStore.createIndex('by-updated', 'updatedAt');
        }

        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'uuid' });
          messageStore.createIndex('by-session', 'sessionId');
          messageStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }

  // ============================================
  // Agent Operations (LocalStorage)
  // ============================================

  /**
   * Save an agent to localStorage.
   * PERFORMANCE: Uses cached agents map to avoid re-parsing.
   */
  async saveAgent(agent: AgentConfig): Promise<void> {
    const agents = await this.getAllAgents();
    agents.set(agent.id, agent);
    this.persistAgents(agents);
  }

  /**
   * Get a single agent by ID.
   * PERFORMANCE: Uses cached agents map.
   */
  async getAgent(id: string): Promise<AgentConfig | null> {
    const agents = await this.getAllAgents();
    return agents.get(id) || null;
  }

  /**
   * Get all agents from localStorage with caching.
   * PERFORMANCE: Uses in-memory cache to avoid repeated JSON parsing.
   */
  async getAllAgents(): Promise<Map<string, AgentConfig>> {
    // Return cached data if valid
    if (this.agentsCacheValid && this.agentsCache) {
      return new Map(this.agentsCache);
    }

    const stored = localStorage.getItem(STORAGE_KEYS.AGENTS);
    if (!stored) {
      this.agentsCache = new Map();
      this.agentsCacheValid = true;
      return new Map();
    }

    try {
      const agentsArray: AgentConfig[] = JSON.parse(stored);
      this.agentsCache = new Map(agentsArray.map(agent => [agent.id, agent]));
      this.agentsCacheValid = true;
      return new Map(this.agentsCache);
    } catch (error) {
      console.error('Failed to parse agents from localStorage:', error);
      this.agentsCache = new Map();
      this.agentsCacheValid = true;
      return new Map();
    }
  }

  /**
   * Invalidate the agents cache (call when external changes may have occurred)
   */
  invalidateAgentsCache(): void {
    this.agentsCacheValid = false;
    this.agentsCache = null;
  }

  /**
   * Write agents to localStorage and update cache.
   * PERFORMANCE: Single localStorage write with cache update.
   */
  private persistAgents(agents: Map<string, AgentConfig>): void {
    const agentsArray = Array.from(agents.values());
    localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(agentsArray));
    // Update cache
    this.agentsCache = new Map(agents);
    this.agentsCacheValid = true;
  }

  /**
   * Delete an agent from localStorage.
   * PERFORMANCE: Uses cached agents map to avoid re-parsing.
   */
  async deleteAgent(id: string): Promise<void> {
    const agents = await this.getAllAgents();
    agents.delete(id);
    this.persistAgents(agents);

    // Clear active agent if deleted
    const activeAgentId = localStorage.getItem(STORAGE_KEYS.ACTIVE_AGENT);
    if (activeAgentId === id) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_AGENT);
    }
  }

  setActiveAgent(id: string | null): void {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_AGENT, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_AGENT);
    }
  }

  getActiveAgent(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_AGENT);
  }

  // ============================================
  // Session Operations (IndexedDB)
  // ============================================

  async saveSession(session: ChatSession): Promise<void> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.put('sessions', session);
  }

  async getSession(id: string): Promise<ChatSession | null> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    return (await this.db.get('sessions', id)) || null;
  }

  async getAllSessions(): Promise<ChatSession[]> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAll('sessions');
  }

  async getSessionsByAgent(agentId: string): Promise<ChatSession[]> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAllFromIndex('sessions', 'by-agent', agentId);
  }

  async deleteSession(id: string): Promise<void> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    // Delete session
    await this.db.delete('sessions', id);

    // Delete all messages in session
    const messages = await this.getMessagesBySession(id);
    const tx = this.db.transaction('messages', 'readwrite');
    await Promise.all(messages.map(msg => tx.store.delete(msg.uuid)));
    await tx.done;

    // Clear active session if deleted
    const activeSessionId = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (activeSessionId === id) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
  }

  setActiveSession(id: string | null): void {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
  }

  getActiveSession(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
  }

  // ============================================
  // Message Operations (IndexedDB)
  // ============================================

  async saveMessage(message: ChatMessage): Promise<void> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.put('messages', message);
  }

  async getMessage(uuid: string): Promise<ChatMessage | null> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    return (await this.db.get('messages', uuid)) || null;
  }

  async getMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAllFromIndex('messages', 'by-session', sessionId);
  }

  async deleteMessage(uuid: string): Promise<void> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.delete('messages', uuid);
  }

  async clearSessionMessages(sessionId: string): Promise<void> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    const messages = await this.getMessagesBySession(sessionId);
    const tx = this.db.transaction('messages', 'readwrite');
    await Promise.all(messages.map(msg => tx.store.delete(msg.uuid)));
    await tx.done;
  }

  // ============================================
  // Utility Methods
  // ============================================

  async clearAllData(): Promise<void> {
    // Clear LocalStorage
    localStorage.removeItem(STORAGE_KEYS.AGENTS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_AGENT);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);

    // Invalidate cache
    this.invalidateAgentsCache();

    // Clear IndexedDB
    await this.initDB();
    if (!this.db) return;

    await this.db.clear('agents');
    await this.db.clear('sessions');
    await this.db.clear('messages');
  }

  async exportData(): Promise<string> {
    const agents = await this.getAllAgents();
    const sessions = await this.getAllSessions();

    return JSON.stringify({
      agents: Array.from(agents.values()),
      sessions,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);

      // Import agents
      if (data.agents && Array.isArray(data.agents)) {
        for (const agent of data.agents) {
          await this.saveAgent(agent);
        }
      }

      // Import sessions
      if (data.sessions && Array.isArray(data.sessions)) {
        for (const session of data.sessions) {
          await this.saveSession(session);
        }
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Invalid import data format');
    }
  }
}

// Singleton instance
export const storageService = new StorageService();

// Initialize on first import
if (typeof window !== 'undefined') {
  storageService.initDB().catch(console.error);
}
