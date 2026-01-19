import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  OAuthConnection,
  OAuthProvider,
  OAuthState,
  ConnectorStore,
} from '../types/connector';

/**
 * Generate unique ID for connector connection
 */
function generateConnectorId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * OAuth state expiration time (10 minutes)
 */
const STATE_EXPIRATION_MS = 10 * 60 * 1000;

/**
 * OAuth Connector Store
 * Manages OAuth connections that can be used by agents
 */
export const useConnectorStore = create<ConnectorStore>()(
  persist(
    (set, get) => ({
      connections: new Map(),
      encryptedTokens: new Map(),
      pendingStates: new Map(),

      // ============ Connection CRUD ============

      addConnection: (connection) => {
        const id = generateConnectorId();
        const now = new Date().toISOString();
        const newConnection: OAuthConnection = {
          ...connection,
          id,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          const newConnections = new Map(state.connections);
          newConnections.set(id, newConnection);
          return { connections: newConnections };
        });

        return id;
      },

      updateConnection: (id, updates) => {
        set((state) => {
          const connection = state.connections.get(id);
          if (!connection) return state;

          const updatedConnection: OAuthConnection = {
            ...connection,
            ...updates,
            id, // Prevent ID from being changed
            createdAt: connection.createdAt, // Prevent createdAt from being changed
            updatedAt: new Date().toISOString(),
          };

          const newConnections = new Map(state.connections);
          newConnections.set(id, updatedConnection);
          return { connections: newConnections };
        });
      },

      deleteConnection: (id) => {
        set((state) => {
          const newConnections = new Map(state.connections);
          newConnections.delete(id);

          // Also remove encrypted tokens
          const newEncryptedTokens = new Map(state.encryptedTokens);
          newEncryptedTokens.delete(id);

          return {
            connections: newConnections,
            encryptedTokens: newEncryptedTokens,
          };
        });
      },

      getConnection: (id) => {
        return get().connections.get(id);
      },

      getConnectionsByProvider: (provider) => {
        return Array.from(get().connections.values()).filter(
          (conn) => conn.provider === provider
        );
      },

      listConnections: () => {
        return Array.from(get().connections.values());
      },

      // ============ Token Management ============

      setEncryptedTokens: (connectionId, encryptedTokens) => {
        set((state) => {
          const newEncryptedTokens = new Map(state.encryptedTokens);
          newEncryptedTokens.set(connectionId, encryptedTokens);
          return { encryptedTokens: newEncryptedTokens };
        });
      },

      getEncryptedTokens: (connectionId) => {
        return get().encryptedTokens.get(connectionId);
      },

      removeEncryptedTokens: (connectionId) => {
        set((state) => {
          const newEncryptedTokens = new Map(state.encryptedTokens);
          newEncryptedTokens.delete(connectionId);
          return { encryptedTokens: newEncryptedTokens };
        });
      },

      // ============ OAuth Flow State Management ============

      setPendingState: (nonce, state) => {
        set((currentState) => {
          const newPendingStates = new Map(currentState.pendingStates);
          newPendingStates.set(nonce, state);
          return { pendingStates: newPendingStates };
        });
      },

      getPendingState: (nonce) => {
        return get().pendingStates.get(nonce);
      },

      removePendingState: (nonce) => {
        set((state) => {
          const newPendingStates = new Map(state.pendingStates);
          newPendingStates.delete(nonce);
          return { pendingStates: newPendingStates };
        });
      },

      cleanupExpiredStates: () => {
        const now = Date.now();
        set((state) => {
          const newPendingStates = new Map(state.pendingStates);
          for (const [nonce, oauthState] of newPendingStates.entries()) {
            if (now - oauthState.timestamp > STATE_EXPIRATION_MS) {
              newPendingStates.delete(nonce);
            }
          }
          return { pendingStates: newPendingStates };
        });
      },
    }),
    {
      name: 'oauth-connectors',
      storage: createJSONStorage(() => localStorage),
      // Custom serialization to handle Map
      partialize: (state) => ({
        connections: Array.from(state.connections.entries()),
        encryptedTokens: Array.from(state.encryptedTokens.entries()),
        // Don't persist pendingStates - they're session-only
      }),
      // Custom deserialization to restore Map
      merge: (persistedState: any, currentState) => {
        return {
          ...currentState,
          connections: new Map(persistedState?.connections || []),
          encryptedTokens: new Map(persistedState?.encryptedTokens || []),
          pendingStates: new Map(), // Always start fresh
        };
      },
    }
  )
);

/**
 * Helper: Get connected providers
 */
export function getConnectedProviders(): OAuthProvider[] {
  const connections = useConnectorStore.getState().listConnections();
  const providers = new Set<OAuthProvider>();

  for (const conn of connections) {
    if (conn.status === 'connected') {
      providers.add(conn.provider);
    }
  }

  return Array.from(providers);
}

/**
 * Helper: Check if a provider is connected
 */
export function isProviderConnected(provider: OAuthProvider): boolean {
  const connections = useConnectorStore
    .getState()
    .getConnectionsByProvider(provider);
  return connections.some((conn) => conn.status === 'connected');
}

/**
 * Helper: Get the active connection for a provider
 * Returns the most recently updated connected connection
 */
export function getActiveConnection(
  provider: OAuthProvider
): OAuthConnection | undefined {
  const connections = useConnectorStore
    .getState()
    .getConnectionsByProvider(provider);

  const connected = connections
    .filter((conn) => conn.status === 'connected')
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  return connected[0];
}

/**
 * Helper: Update connection last used timestamp
 */
export function markConnectionUsed(connectionId: string): void {
  useConnectorStore.getState().updateConnection(connectionId, {
    lastUsedAt: new Date().toISOString(),
  });
}
