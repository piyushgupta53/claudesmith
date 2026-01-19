import { AgentExecutor } from './agentExecutor';

/**
 * Global registry for AgentExecutor instances
 * Maps sessionId -> AgentExecutor
 *
 * This allows API routes to access running executors
 * to handle questions, permissions, interrupts, etc.
 *
 * Uses globalThis to ensure the same instance is shared across
 * all Next.js API routes (which may run in separate module contexts)
 */
class ExecutorRegistry {
  private executors: Map<string, AgentExecutor> = new Map();

  register(sessionId: string, executor: AgentExecutor): void {
    console.log(`[ExecutorRegistry] Registering executor for session: ${sessionId}`);
    this.executors.set(sessionId, executor);
  }

  get(sessionId: string): AgentExecutor | undefined {
    const executor = this.executors.get(sessionId);
    console.log(`[ExecutorRegistry] Getting executor for session: ${sessionId}, found: ${!!executor}`);
    return executor;
  }

  unregister(sessionId: string): void {
    console.log(`[ExecutorRegistry] Unregistering executor for session: ${sessionId}`);
    this.executors.delete(sessionId);
  }

  has(sessionId: string): boolean {
    return this.executors.has(sessionId);
  }

  // Debug method to list all registered sessions
  listSessions(): string[] {
    return Array.from(this.executors.keys());
  }
}

// Use globalThis to ensure singleton across all module contexts in Next.js
const globalForRegistry = globalThis as unknown as {
  executorRegistry: ExecutorRegistry | undefined;
};

export const executorRegistry = globalForRegistry.executorRegistry ?? new ExecutorRegistry();

if (process.env.NODE_ENV !== 'production') {
  globalForRegistry.executorRegistry = executorRegistry;
}
