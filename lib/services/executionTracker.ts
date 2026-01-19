import type { ExecutionNode, ExecutionEvent, ExecutionMetrics } from '../types/execution';
import type { ChatMessage, ToolCall } from '../types/chat';

/**
 * ExecutionTracker service
 * Parses messages and events to build execution tree with parent-child relationships
 */
export class ExecutionTracker {
  private sessionId: string;
  private rootNode: ExecutionNode | null = null;
  private nodeMap: Map<string, ExecutionNode> = new Map();

  constructor(sessionId: string, agentName: string) {
    this.sessionId = sessionId;

    // Initialize root execution node
    this.rootNode = {
      id: sessionId,
      parentId: null,
      sessionId,
      agentType: 'root',
      agentName,
      status: 'running',
      startTime: new Date().toISOString(),
      messages: [],
      toolCalls: [],
      subagents: [],
    };

    this.nodeMap.set(sessionId, this.rootNode);
  }

  /**
   * Add a message to the execution tree
   */
  addMessage(message: ChatMessage): void {
    const parentId = message.parent_tool_use_id || this.sessionId;
    const node = this.nodeMap.get(parentId);

    if (node) {
      node.messages.push(message);
    }
  }

  /**
   * Add a tool call to the execution tree
   */
  addToolCall(toolCall: ToolCall, parentId?: string): void {
    const nodeId = parentId || this.sessionId;
    const node = this.nodeMap.get(nodeId);

    if (node) {
      node.toolCalls.push(toolCall);
    }
  }

  /**
   * Start tracking a subagent execution
   */
  startSubagent(
    subagentId: string,
    agentType: string,
    description: string,
    parentId: string
  ): ExecutionNode {
    const parentNode = this.nodeMap.get(parentId);

    if (!parentNode) {
      throw new Error(`Parent node ${parentId} not found`);
    }

    const subagentNode: ExecutionNode = {
      id: subagentId,
      parentId,
      sessionId: this.sessionId,
      agentType,
      agentName: agentType,
      status: 'running',
      startTime: new Date().toISOString(),
      messages: [],
      toolCalls: [],
      subagents: [],
    };

    this.nodeMap.set(subagentId, subagentNode);
    parentNode.subagents.push(subagentNode);

    return subagentNode;
  }

  /**
   * Update subagent status
   */
  updateSubagentStatus(
    subagentId: string,
    status: ExecutionNode['status'],
    error?: string
  ): void {
    const node = this.nodeMap.get(subagentId);

    if (node) {
      node.status = status;

      if (status === 'completed' || status === 'failed' || status === 'interrupted') {
        node.endTime = new Date().toISOString();

        if (node.startTime && node.endTime) {
          node.duration = new Date(node.endTime).getTime() - new Date(node.startTime).getTime();
        }
      }
    }
  }

  /**
   * End a subagent execution (convenience method)
   */
  endSubagent(
    subagentId: string,
    status: 'completed' | 'failed' | 'interrupted' = 'completed'
  ): void {
    this.updateSubagentStatus(subagentId, status);
  }

  /**
   * Update execution metrics
   */
  updateMetrics(metrics: Partial<ExecutionMetrics>): void {
    if (this.rootNode) {
      this.rootNode.metrics = {
        ...this.rootNode.metrics,
        ...metrics,
      } as ExecutionMetrics;
    }
  }

  /**
   * Complete the execution
   */
  complete(status: 'completed' | 'failed' | 'interrupted' = 'completed'): void {
    if (this.rootNode) {
      this.rootNode.status = status;
      this.rootNode.endTime = new Date().toISOString();

      if (this.rootNode.startTime && this.rootNode.endTime) {
        this.rootNode.duration =
          new Date(this.rootNode.endTime).getTime() -
          new Date(this.rootNode.startTime).getTime();
      }

      // Calculate final metrics
      this.calculateMetrics();
    }
  }

  /**
   * Calculate execution metrics recursively
   */
  private calculateMetrics(): void {
    if (!this.rootNode) return;

    const metrics: ExecutionMetrics = {
      totalTurns: this.countTurns(this.rootNode),
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      toolCallCount: this.countToolCalls(this.rootNode),
      subagentCount: this.countSubagents(this.rootNode),
    };

    this.rootNode.metrics = metrics;
  }

  /**
   * Count total conversation turns
   */
  private countTurns(node: ExecutionNode): number {
    let turns = node.messages.filter(m => m.type === 'user' || m.type === 'assistant').length;

    for (const subagent of node.subagents) {
      turns += this.countTurns(subagent);
    }

    return turns;
  }

  /**
   * Count total tool calls recursively
   */
  private countToolCalls(node: ExecutionNode): number {
    let count = node.toolCalls.length;

    for (const subagent of node.subagents) {
      count += this.countToolCalls(subagent);
    }

    return count;
  }

  /**
   * Count total subagents recursively
   */
  private countSubagents(node: ExecutionNode): number {
    let count = node.subagents.length;

    for (const subagent of node.subagents) {
      count += this.countSubagents(subagent);
    }

    return count;
  }

  /**
   * Get the root execution node
   */
  getExecutionTree(): ExecutionNode | null {
    return this.rootNode;
  }

  /**
   * Get a specific node by ID
   */
  getNode(nodeId: string): ExecutionNode | undefined {
    return this.nodeMap.get(nodeId);
  }

  /**
   * Get all events in chronological order
   */
  getTimelineEvents(): ExecutionEvent[] {
    const events: ExecutionEvent[] = [];

    if (this.rootNode) {
      this.collectEvents(this.rootNode, events);
    }

    return events.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Recursively collect events from execution tree
   */
  private collectEvents(node: ExecutionNode, events: ExecutionEvent[]): void {
    // Add session start event
    events.push({
      id: `${node.id}-start`,
      sessionId: this.sessionId,
      type: node.parentId ? 'subagent_start' : 'session_start',
      timestamp: node.startTime,
      data: {
        agentType: node.agentType,
        agentName: node.agentName,
      },
    });

    // Add message events
    node.messages.forEach((message, index) => {
      events.push({
        id: message.uuid,
        sessionId: this.sessionId,
        type: message.type === 'user' ? 'user_prompt' : 'assistant_thinking',
        timestamp: message.timestamp,
        data: message,
      });
    });

    // Add tool call events
    node.toolCalls.forEach((toolCall) => {
      events.push({
        id: `${toolCall.id}-start`,
        sessionId: this.sessionId,
        type: 'tool_call_start',
        timestamp: toolCall.timestamp,
        data: toolCall,
      });

      if (toolCall.status === 'completed' || toolCall.status === 'failed') {
        events.push({
          id: `${toolCall.id}-end`,
          sessionId: this.sessionId,
          type: 'tool_call_end',
          timestamp: toolCall.timestamp,
          data: toolCall,
        });
      }
    });

    // Recursively collect from subagents
    node.subagents.forEach((subagent) => {
      this.collectEvents(subagent, events);

      if (subagent.endTime) {
        events.push({
          id: `${subagent.id}-end`,
          sessionId: this.sessionId,
          type: 'subagent_end',
          timestamp: subagent.endTime,
          data: {
            agentType: subagent.agentType,
            status: subagent.status,
            duration: subagent.duration,
          },
        });
      }
    });

    // Add session end event
    if (node.endTime) {
      events.push({
        id: `${node.id}-end`,
        sessionId: this.sessionId,
        type: 'session_end',
        timestamp: node.endTime,
        data: {
          status: node.status,
          duration: node.duration,
          metrics: node.metrics,
        },
      });
    }
  }
}

/**
 * Helper function to format duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Helper function to calculate cost estimate
 */
export function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'sonnet': { input: 3.00, output: 15.00 },  // per million tokens
    'opus': { input: 15.00, output: 75.00 },
    'haiku': { input: 0.25, output: 1.25 },
  };

  const modelPricing = pricing[model] || pricing['sonnet'];

  return (
    (inputTokens / 1_000_000) * modelPricing.input +
    (outputTokens / 1_000_000) * modelPricing.output
  );
}
