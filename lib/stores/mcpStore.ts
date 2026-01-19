import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * MCP Transport Types
 * Supported transport protocols for MCP servers
 */
export type McpTransportType = 'stdio' | 'sse' | 'http';

/**
 * Base MCP Connection fields shared across all transport types
 */
interface McpConnectionBase {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stdio MCP Connection - Server communicates via stdin/stdout
 */
export interface McpStdioConnection extends McpConnectionBase {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * SSE MCP Connection - Server-Sent Events transport
 */
export interface McpSSEConnection extends McpConnectionBase {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

/**
 * HTTP MCP Connection - HTTP/Streamable HTTP transport
 */
export interface McpHttpConnection extends McpConnectionBase {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

/**
 * Global MCP Connection
 * Represents a Model Context Protocol server connection
 * Supports stdio, SSE, and HTTP transport types
 *
 * Note: SDK type (in-process) is not supported in the UI as it requires
 * programmatic server instance creation via createSdkMcpServer()
 */
export type GlobalMcpConnection = McpStdioConnection | McpSSEConnection | McpHttpConnection;

/**
 * Legacy connection format for backwards compatibility
 * Used during migration from older format
 */
interface LegacyMcpConnection {
  id: string;
  name: string;
  description: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  type?: never; // Legacy connections don't have type field
}

/**
 * Check if a connection is in legacy format (no type field)
 */
function isLegacyConnection(conn: any): conn is LegacyMcpConnection {
  return conn && typeof conn.command === 'string' && !conn.type;
}

/**
 * Migrate legacy connection to new format
 */
function migrateConnection(conn: LegacyMcpConnection): McpStdioConnection {
  return {
    ...conn,
    type: 'stdio',
  };
}

/**
 * Input types for adding connections (without auto-generated fields)
 */
export type McpStdioConnectionInput = Omit<McpStdioConnection, 'id' | 'createdAt' | 'updatedAt'>;
export type McpSSEConnectionInput = Omit<McpSSEConnection, 'id' | 'createdAt' | 'updatedAt'>;
export type McpHttpConnectionInput = Omit<McpHttpConnection, 'id' | 'createdAt' | 'updatedAt'>;
export type McpConnectionInput = McpStdioConnectionInput | McpSSEConnectionInput | McpHttpConnectionInput;

/**
 * MCP Store Interface
 */
interface McpStore {
  connections: Map<string, GlobalMcpConnection>;

  // CRUD Operations
  addConnection: (connection: McpConnectionInput) => string;
  updateConnection: (id: string, updates: Partial<Omit<GlobalMcpConnection, 'type'>>) => void;
  deleteConnection: (id: string) => void;
  getConnection: (id: string) => GlobalMcpConnection | undefined;
  listConnections: () => GlobalMcpConnection[];

  // Persistence
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

/**
 * Generate unique ID for MCP connection
 */
function generateMcpId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Global MCP Connection Store
 * Manages MCP server connections that can be shared across agents
 */
export const useMcpStore = create<McpStore>()(
  persist(
    (set, get) => ({
      connections: new Map(),

      addConnection: (connection) => {
        const id = generateMcpId();
        const now = new Date().toISOString();
        const newConnection: GlobalMcpConnection = {
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

          const updatedConnection: GlobalMcpConnection = {
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
          return { connections: newConnections };
        });
      },

      getConnection: (id) => {
        return get().connections.get(id);
      },

      listConnections: () => {
        return Array.from(get().connections.values());
      },

      loadFromStorage: () => {
        // Called automatically by persist middleware
      },

      saveToStorage: () => {
        // Called automatically by persist middleware
      },
    }),
    {
      name: 'mcp-connections',
      storage: createJSONStorage(() => localStorage),
      // Custom serialization to handle Map
      partialize: (state) => ({
        connections: Array.from(state.connections.entries()),
      }),
      // Custom deserialization to restore Map with legacy migration
      merge: (persistedState: any, currentState) => {
        const rawConnections = persistedState?.connections || [];
        // Migrate any legacy connections (without type field) to stdio type
        const migratedConnections = rawConnections.map(([id, conn]: [string, any]) => {
          if (isLegacyConnection(conn)) {
            console.log(`[MCP Store] Migrating legacy connection "${conn.name}" to stdio type`);
            return [id, migrateConnection(conn)];
          }
          return [id, conn];
        });
        return {
          ...currentState,
          connections: new Map(migratedConnections),
        };
      },
    }
  )
);

/**
 * Example MCP Connections for Reference
 * Includes examples for all transport types: stdio, SSE, and HTTP
 */
export const EXAMPLE_MCP_CONNECTIONS: McpConnectionInput[] = [
  // === STDIO Examples (Local process-based servers) ===
  {
    type: 'stdio',
    name: 'Filesystem',
    description: 'Access local filesystem for reading and writing files',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
  },
  {
    type: 'stdio',
    name: 'Brave Search',
    description: 'Web search using Brave Search API',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: {
      BRAVE_API_KEY: 'your-api-key-here',
    },
  },
  {
    type: 'stdio',
    name: 'GitHub',
    description: 'Access GitHub repositories, issues, and pull requests',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: 'your-token-here',
    },
  },
  {
    type: 'stdio',
    name: 'PostgreSQL',
    description: 'Query PostgreSQL databases',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: {
      POSTGRES_CONNECTION_STRING: 'postgresql://user:password@localhost:5432/dbname',
    },
  },
  {
    type: 'stdio',
    name: 'Slack',
    description: 'Read and send Slack messages',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: {
      SLACK_BOT_TOKEN: 'xoxb-your-token',
      SLACK_TEAM_ID: 'T1234567',
    },
  },
  // === SSE Examples (Server-Sent Events remote servers) ===
  {
    type: 'sse',
    name: 'Remote MCP (SSE)',
    description: 'Connect to a remote MCP server via Server-Sent Events',
    url: 'https://mcp.example.com/sse',
    headers: {
      Authorization: 'Bearer your-api-key',
    },
  },
  // === HTTP Examples (Streamable HTTP remote servers) ===
  {
    type: 'http',
    name: 'Remote MCP (HTTP)',
    description: 'Connect to a remote MCP server via Streamable HTTP (recommended for 2025+)',
    url: 'https://mcp.example.com/api',
    headers: {
      Authorization: 'Bearer your-api-key',
      'Content-Type': 'application/json',
    },
  },
  {
    type: 'http',
    name: 'Custom API Server',
    description: 'Connect to your custom HTTP-based MCP server',
    url: 'http://localhost:8080/mcp',
  },
];
