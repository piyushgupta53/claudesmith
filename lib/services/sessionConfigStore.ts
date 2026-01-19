/**
 * Session Config Store
 *
 * Stores agent configurations server-side to avoid URL length limits.
 * Uses file-based storage to persist across Next.js API route invocations.
 */

import type { AgentConfig } from '../types/agent';
import fs from 'fs';
import path from 'path';

interface StoredConfig {
  agentConfig: AgentConfig & { resolvedMcpServers?: any[] };
  prompt: string;
  createdAt: number;
}

// Directory for storing session configs
const CONFIG_DIR = path.join(process.cwd(), '.scratch', '_session_configs');

// Ensure config directory exists
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Get config file path for a session
function getConfigPath(sessionId: string): string {
  // Sanitize sessionId to prevent path traversal
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(CONFIG_DIR, `${safeSessionId}.json`);
}

/**
 * Store config for a session
 */
export function storeSessionConfig(
  sessionId: string,
  agentConfig: AgentConfig & { resolvedMcpServers?: any[] },
  prompt: string
): void {
  ensureConfigDir();

  const config: StoredConfig = {
    agentConfig,
    prompt,
    createdAt: Date.now(),
  };

  const configPath = getConfigPath(sessionId);
  fs.writeFileSync(configPath, JSON.stringify(config), 'utf-8');

  console.log(`[SessionConfigStore] Stored config for session ${sessionId} (${JSON.stringify(agentConfig).length} bytes) at ${configPath}`);
}

/**
 * Get config for a session
 */
export function getSessionConfig(sessionId: string): StoredConfig | null {
  const configPath = getConfigPath(sessionId);

  if (!fs.existsSync(configPath)) {
    console.log(`[SessionConfigStore] No config found for session ${sessionId} at ${configPath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as StoredConfig;
    console.log(`[SessionConfigStore] Retrieved config for session ${sessionId}`);
    return config;
  } catch (error) {
    console.error(`[SessionConfigStore] Error reading config for session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Clear config for a session
 */
export function clearSessionConfig(sessionId: string): void {
  const configPath = getConfigPath(sessionId);

  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
    console.log(`[SessionConfigStore] Cleared config for session ${sessionId}`);
  }
}

/**
 * Check if config exists for a session
 */
export function hasSessionConfig(sessionId: string): boolean {
  return fs.existsSync(getConfigPath(sessionId));
}

export const sessionConfigStore = {
  store: storeSessionConfig,
  get: getSessionConfig,
  clear: clearSessionConfig,
  has: hasSessionConfig,
};
