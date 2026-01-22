/**
 * Session Config Store
 *
 * Stores agent configurations server-side to avoid URL length limits.
 * Uses file-based storage to persist across Next.js API route invocations.
 *
 * PERFORMANCE: Uses async fs/promises to prevent blocking during streaming.
 */

import type { AgentConfig } from '../types/agent';
import fs from 'fs/promises';
import path from 'path';

interface StoredConfig {
  agentConfig: AgentConfig & { resolvedMcpServers?: any[] };
  prompt: string;
  createdAt: number;
}

// Directory for storing session configs
const CONFIG_DIR = path.join(process.cwd(), '.scratch', '_session_configs');

// Track if directory has been ensured (avoid repeated checks)
let configDirEnsured = false;

/**
 * Ensure config directory exists (async)
 */
async function ensureConfigDir(): Promise<void> {
  if (configDirEnsured) return;

  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    configDirEnsured = true;
  } catch (error: any) {
    // Directory already exists is fine
    if (error.code !== 'EEXIST') {
      throw error;
    }
    configDirEnsured = true;
  }
}

/**
 * Get config file path for a session
 */
function getConfigPath(sessionId: string): string {
  // Sanitize sessionId to prevent path traversal
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(CONFIG_DIR, `${safeSessionId}.json`);
}

/**
 * Store config for a session (async)
 */
export async function storeSessionConfig(
  sessionId: string,
  agentConfig: AgentConfig & { resolvedMcpServers?: any[] },
  prompt: string
): Promise<void> {
  await ensureConfigDir();

  const config: StoredConfig = {
    agentConfig,
    prompt,
    createdAt: Date.now(),
  };

  const configPath = getConfigPath(sessionId);
  await fs.writeFile(configPath, JSON.stringify(config), 'utf-8');

  console.log(`[SessionConfigStore] Stored config for session ${sessionId} (${JSON.stringify(agentConfig).length} bytes) at ${configPath}`);
}

/**
 * Get config for a session (async)
 */
export async function getSessionConfig(sessionId: string): Promise<StoredConfig | null> {
  const configPath = getConfigPath(sessionId);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as StoredConfig;
    console.log(`[SessionConfigStore] Retrieved config for session ${sessionId}`);
    return config;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`[SessionConfigStore] No config found for session ${sessionId} at ${configPath}`);
      return null;
    }
    console.error(`[SessionConfigStore] Error reading config for session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Clear config for a session (async)
 */
export async function clearSessionConfig(sessionId: string): Promise<void> {
  const configPath = getConfigPath(sessionId);

  try {
    await fs.unlink(configPath);
    console.log(`[SessionConfigStore] Cleared config for session ${sessionId}`);
  } catch (error: any) {
    // Ignore if file doesn't exist
    if (error.code !== 'ENOENT') {
      console.error(`[SessionConfigStore] Error clearing config for session ${sessionId}:`, error);
    }
  }
}

/**
 * Check if config exists for a session (async)
 */
export async function hasSessionConfig(sessionId: string): Promise<boolean> {
  const configPath = getConfigPath(sessionId);

  try {
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}

export const sessionConfigStore = {
  store: storeSessionConfig,
  get: getSessionConfig,
  clear: clearSessionConfig,
  has: hasSessionConfig,
};
