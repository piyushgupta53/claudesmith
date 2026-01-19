/**
 * Tool Registry
 *
 * Central registry for all tool implementations
 * Maps tool names to their handlers and schemas
 */

import { readTool, readToolSchema } from './readTool';
import { writeTool, writeToolSchema } from './writeTool';
import { bashTool, bashToolSchema } from './bashTool';

/**
 * Tool handler function signature
 */
export type ToolHandler = (
  input: any,
  context: { containerId?: string }
) => Promise<any>;

/**
 * Tool definition with handler and schema
 */
export interface ToolDefinition {
  handler: ToolHandler;
  schema: {
    name: string;
    description: string;
    input_schema: Record<string, any>;
  };
}

/**
 * Registry of all available tools
 */
export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  // Sandbox tools (require Docker container)
  Read: {
    handler: readTool,
    schema: readToolSchema
  },
  Write: {
    handler: writeTool,
    schema: writeToolSchema
  },
  Bash: {
    handler: bashTool,
    schema: bashToolSchema
  }
};

/**
 * Get tool handler by name
 */
export function getToolHandler(toolName: string): ToolHandler | null {
  const tool = TOOL_REGISTRY[toolName];
  return tool ? tool.handler : null;
}

/**
 * Get tool schema by name
 */
export function getToolSchema(toolName: string): any | null {
  const tool = TOOL_REGISTRY[toolName];
  return tool ? tool.schema : null;
}

/**
 * Get all tool schemas for enabled tools
 */
export function getToolSchemas(toolNames: string[]): any[] {
  return toolNames
    .map(name => getToolSchema(name))
    .filter(schema => schema !== null);
}

/**
 * Check if tool is registered
 */
export function isToolRegistered(toolName: string): boolean {
  return toolName in TOOL_REGISTRY;
}

/**
 * Get all registered tool names
 */
export function getRegisteredToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}
