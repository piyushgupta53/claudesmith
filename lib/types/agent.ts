// Core agent configuration interface
export interface AgentConfig {
  // Metadata
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;

  // Core Configuration
  systemPrompt: string;
  model: 'sonnet' | 'opus' | 'haiku' | 'inherit';

  // Tool Configuration
  tools: {
    enabled: string[];   // e.g., ['Read', 'Write', 'Bash', 'WebSearch']
    disabled: string[];
  };

  // Skills Configuration (SDK-native skills)
  // Skills are loaded from .claude/skills/ via settingSources: ['project', 'user']
  // When enabled, 'Skill' tool is automatically added to allowedTools
  skills?: {
    enabled: string[];   // e.g., ['data-analysis', 'code-review', 'research', 'scripting']
  };

  // Subagent Definitions
  subagents: Record<string, SubagentConfig>;

  // Advanced Settings
  settings: AgentSettings;

  // UI Metadata
  ui: AgentUIMetadata;

  // Structured Outputs (Phase 3)
  outputFormat?: {
    type: 'json_schema';
    schema: JSONSchema;
  };

  // Hooks (Phase 3)
  hooks?: {
    [key in HookEvent]?: Array<{
      matcher?: string; // Optional: only fire for matching tool/subagent
      code: string; // JavaScript function code
    }>;
  };

  // MCP Connections (Phase 3)
  mcpConnections?: string[]; // Array of global MCP connection IDs

  // OAuth Connectors
  // When specified, the connector MCP server will be created with tools for these connectors
  // Tool names: gmail_list, gmail_read, drive_list, drive_read, drive_search,
  //             slack_list_channels, slack_read, slack_send,
  //             notion_search, notion_read_page,
  //             github_list_repos, github_get_repo, github_list_issues
  connectors?: string[]; // Array of connector connection IDs from connectorStore

  // Custom Tools (Phase 3)
  // Custom tools are converted to SDK MCP servers using createSdkMcpServer()
  // Tool names are exposed as: mcp__custom-tools-{agentId}__{toolName}
  customTools?: Array<{
    /** Unique tool name (used in MCP tool name: mcp__custom-tools-{agentId}__{name}) */
    name: string;
    /** Natural language description of what the tool does */
    description: string;
    /** JSON Schema defining the tool's input parameters (converted to Zod at runtime) */
    inputSchema: JSONSchema;
    /**
     * JavaScript handler code as a string.
     * The code receives `args` (validated input) and `context` (execution context).
     * Should return a result or use CallToolResult format: { content: [{ type: 'text', text: '...' }] }
     *
     * @example
     * ```javascript
     * // Simple return
     * return `Hello, ${args.name}!`;
     *
     * // CallToolResult format
     * return {
     *   content: [{ type: 'text', text: `Processed: ${args.data}` }]
     * };
     *
     * // Async operations
     * const response = await fetch(args.url);
     * const data = await response.json();
     * return JSON.stringify(data, null, 2);
     * ```
     */
    handler: string;
  }>;

  // Error Handling (Phase 3)
  errorHandling?: {
    retryOnFailure?: boolean;
    maxRetries?: number;
    retryDelay?: number; // milliseconds
    fallbackModel?: 'sonnet' | 'opus' | 'haiku';
    fallbackTools?: string[]; // If MCP tool fails, use these instead
  };

  // Context (Phase 3)
  context?: {
    static?: Record<string, unknown>; // Static context data
    dynamicLoader?: string; // JavaScript function code
  };

  // Advanced (Phase 3)
  advanced?: {
    betas?: string[]; // e.g., ['prompt-caching-2024-07-31']
    canUseTool?: string; // JavaScript function code
    includePartialMessages?: boolean;
    settingSources?: SettingSource[];
    plugins?: Array<{
      type: 'local';
      path: string;
    }>;
    env?: Record<string, string>;
    strictMcpConfig?: boolean;
    /**
     * Disable automatic injection of platform guidelines into system prompt.
     * Platform guidelines include best practices for writing files, API pagination, etc.
     * Default: false (guidelines are injected)
     */
    disablePlatformGuidelines?: boolean;
  };
}

export interface SubagentConfig {
  description: string;
  prompt: string;
  tools?: string[];
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
}

export interface AgentSettings {
  maxTurns?: number;
  maxBudgetUsd?: number;
  maxThinkingTokens?: number;
  permissionMode: PermissionMode;
  enableFileCheckpointing?: boolean;
  cwd?: string;

  /**
   * Resource limits for tool execution.
   * These are applied at the platform level to prevent resource exhaustion.
   */
  limits?: ResourceLimits;
}

/**
 * Resource limits for agent execution.
 * Applied automatically by the platform - users don't need to know about these.
 */
export interface ResourceLimits {
  /**
   * Maximum size of tool results in characters.
   * Results exceeding this are truncated with a helpful message.
   * Default: 50000 (50KB)
   */
  maxResultSize?: number;

  /**
   * Default timeout for tool execution in milliseconds.
   * Individual tools may have their own timeouts that override this.
   * Default: 60000 (60 seconds)
   */
  maxToolTimeoutMs?: number;

  /**
   * Whether to include helpful hints when results are truncated or errors occur.
   * Helps agents understand how to retry with smaller scope.
   * Default: true
   */
  includeErrorHints?: boolean;
}

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk' | 'plan';

/**
 * Default resource limits applied to all agents.
 * These provide sensible defaults that prevent resource exhaustion.
 */
export const DEFAULT_RESOURCE_LIMITS: Required<ResourceLimits> = {
  maxResultSize: 50000,       // 50KB - reasonable for most tool outputs
  maxToolTimeoutMs: 60000,    // 60 seconds - reasonable for most operations
  includeErrorHints: true,    // Help agents recover from errors
};

/**
 * Get resource limits with defaults applied.
 * Always returns a complete ResourceLimits object.
 */
export function getResourceLimitsWithDefaults(limits?: ResourceLimits): Required<ResourceLimits> {
  return {
    maxResultSize: limits?.maxResultSize ?? DEFAULT_RESOURCE_LIMITS.maxResultSize,
    maxToolTimeoutMs: limits?.maxToolTimeoutMs ?? DEFAULT_RESOURCE_LIMITS.maxToolTimeoutMs,
    includeErrorHints: limits?.includeErrorHints ?? DEFAULT_RESOURCE_LIMITS.includeErrorHints,
  };
}

// Setting source for loading filesystem-based settings (SDK-compliant)
export type SettingSource = 'user' | 'project' | 'local';

export interface AgentUIMetadata {
  color: string;
  icon: string;
  category: AgentCategory;
}

export type AgentCategory = 'general' | 'code' | 'research' | 'analysis' | 'custom';

// Available Claude SDK tools - MVP (API-based, no sandboxing required)
export const MVP_TOOLS = [
  'WebSearch',
  'WebFetch',
  'AskUserQuestion',
  'TodoWrite',
  'ListMcpResources',
  'ReadMcpResource',
] as const;

// Sandbox tools (executed via Docker MCP server)
export const SANDBOX_TOOLS = [
  'Read',
  'Write',
  'Glob',
  'Grep',
  'Bash',
] as const;

// Coming soon tools (not yet implemented)
// 'Edit', 'MultiEdit', 'NotebookEdit' will be added when ready

// All tools (for type definitions and future use)
export const AVAILABLE_TOOLS = [...MVP_TOOLS, ...SANDBOX_TOOLS] as const;

export type ToolName = typeof AVAILABLE_TOOLS[number];
export type MvpToolName = typeof MVP_TOOLS[number];
export type SandboxToolName = typeof SANDBOX_TOOLS[number];

// Helper function to check if a tool requires sandboxing
export function isSandboxTool(tool: string): tool is SandboxToolName {
  return (SANDBOX_TOOLS as readonly string[]).includes(tool);
}

// Helper function to check if a tool is available in MVP
export function isMvpTool(tool: string): tool is MvpToolName {
  return (MVP_TOOLS as readonly string[]).includes(tool);
}

// Hook Events (Phase 3) - Aligned with Claude Agent SDK specification
export type HookEvent =
  | 'PreToolUse'           // Runs before each tool is executed
  | 'PostToolUse'          // Runs after each tool completes successfully
  | 'PostToolUseFailure'   // Runs when a tool execution fails
  | 'Notification'         // Runs when Claude sends a notification
  | 'UserPromptSubmit'     // Runs when user submits a prompt
  | 'SessionStart'         // Runs once when the agent session starts
  | 'SessionEnd'           // Runs once when the agent session ends
  | 'Stop'                 // Runs when execution is stopped
  | 'SubagentStart'        // Runs before a subagent is invoked
  | 'SubagentStop'         // Runs after a subagent completes
  | 'PreCompact'           // Runs before conversation compaction
  | 'PermissionRequest';   // Runs when permission is requested

// Legacy hook event names (deprecated - will be auto-migrated)
export type LegacyHookEvent =
  | 'BeforeToolUse'        // Use 'PreToolUse' instead
  | 'AfterToolUse'         // Use 'PostToolUse' instead
  | 'BeforeSubagentCall'   // Use 'SubagentStart' instead
  | 'AfterSubagentCall'    // Use 'SubagentStop' instead
  | 'OnError'              // Use 'PostToolUseFailure' instead
  | 'BeforeRequest'        // Not supported in SDK
  | 'AfterResponse';       // Not supported in SDK

// Hook event migration map for backward compatibility
export const HOOK_EVENT_MIGRATION: Record<LegacyHookEvent, HookEvent | null> = {
  'BeforeToolUse': 'PreToolUse',
  'AfterToolUse': 'PostToolUse',
  'BeforeSubagentCall': 'SubagentStart',
  'AfterSubagentCall': 'SubagentStop',
  'OnError': 'PostToolUseFailure',
  'BeforeRequest': null,  // Not supported - will be removed
  'AfterResponse': null,  // Not supported - will be removed
};

// Helper function to migrate old hook event names to new SDK-compliant names
export function migrateHookEvents(config: AgentConfig): AgentConfig {
  if (!config.hooks || Object.keys(config.hooks).length === 0) {
    return config;
  }

  const migratedHooks: AgentConfig['hooks'] = {};
  let hasLegacyEvents = false;

  Object.entries(config.hooks).forEach(([event, hooks]) => {
    // Check if this is a legacy event name
    if (event in HOOK_EVENT_MIGRATION) {
      hasLegacyEvents = true;
      const newEvent = HOOK_EVENT_MIGRATION[event as LegacyHookEvent];

      if (newEvent) {
        // Migrate to new event name
        migratedHooks[newEvent] = hooks;
        console.warn(`[Migration] Hook event "${event}" has been migrated to "${newEvent}"`);
      } else {
        // Event not supported in SDK - log warning
        console.warn(`[Migration] Hook event "${event}" is not supported by the SDK and has been removed`);
      }
    } else {
      // Already using new event name
      migratedHooks[event as HookEvent] = hooks;
    }
  });

  if (hasLegacyEvents) {
    console.info('[Migration] Agent configuration has been automatically migrated to use SDK-compliant hook event names');
  }

  return {
    ...config,
    hooks: migratedHooks,
  };
}

// Permission System Types (aligned with Claude Agent SDK)
export interface PermissionUpdate {
  type: 'addRules' | 'replaceRules' | 'removeRules' | 'setMode' | 'addDirectories' | 'removeDirectories';
  rules?: Array<{ toolName: string; ruleContent?: string }>;
  behavior?: 'allow' | 'deny' | 'ask';
  mode?: PermissionMode;
  directories?: string[];
  destination?: 'userSettings' | 'projectSettings' | 'localSettings' | 'session';
}

export type PermissionResultAllow = {
  behavior: 'allow';
  updatedInput: Record<string, any>;
  updatedPermissions?: PermissionUpdate[];
};

export type PermissionResultDeny = {
  behavior: 'deny';
  message: string;
  interrupt?: boolean;
};

export type PermissionResult = PermissionResultAllow | PermissionResultDeny;

// canUseTool callback type (SDK specification)
export type CanUseToolCallback = (
  toolName: string,
  input: Record<string, any>,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
  }
) => Promise<PermissionResult>;

// canUseTool Examples and Templates
export const CAN_USE_TOOL_EXAMPLES = {
  // Example 1: Handle AskUserQuestion tool to collect user answers
  askUserQuestion: `
// Intercept AskUserQuestion to display questions and collect answers
if (toolName === 'AskUserQuestion') {
  // Display questions to user (integrate with your UI)
  const answers = await showQuestionsToUser(input.questions);

  // Return with answers injected into tool input
  return {
    behavior: 'allow',
    updatedInput: { ...input, answers }
  };
}

// Default: allow other tools
return { behavior: 'allow', updatedInput: input };
`,

  // Example 2: Auto-approve read-only tools
  autoApproveReads: `
// Auto-approve read-only tools
const readOnlyTools = ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];
if (readOnlyTools.includes(toolName)) {
  return { behavior: 'allow', updatedInput: input };
}

// Ask for permission on write operations
return { behavior: 'deny', message: 'Write operations require explicit approval' };
`,

  // Example 3: Rate limiting
  rateLimiting: `
// Rate limit tool calls (1 per second)
const now = Date.now();
if (lastCallTime && now - lastCallTime < 1000) {
  return {
    behavior: 'deny',
    message: 'Rate limit: Please wait 1 second between tool calls',
    interrupt: false
  };
}
lastCallTime = now;

return { behavior: 'allow', updatedInput: input };
`,

  // Example 4: Modify tool input
  modifyInput: `
// Add metadata to Bash commands
if (toolName === 'Bash') {
  return {
    behavior: 'allow',
    updatedInput: {
      ...input,
      description: input.description || 'Executing command',
      timeout: input.timeout || 120000  // Default 2min timeout
    }
  };
}

return { behavior: 'allow', updatedInput: input };
`,

  // Example 5: Budget control
  budgetControl: `
// Block tools if budget exceeded
if (totalCostUsd > maxBudgetUsd) {
  return {
    behavior: 'deny',
    message: \`Budget exceeded: $\${totalCostUsd.toFixed(2)} / $\${maxBudgetUsd.toFixed(2)}\`,
    interrupt: true  // Stop execution entirely
  };
}

return { behavior: 'allow', updatedInput: input };
`,

  // Example 6: Validate file paths
  validatePaths: `
// Restrict file operations to specific directories
if (['Read', 'Write', 'Edit'].includes(toolName)) {
  const filePath = input.file_path || input.path;
  const allowedDirs = ['/project', '/scratch'];

  if (!allowedDirs.some(dir => filePath.startsWith(dir))) {
    return {
      behavior: 'deny',
      message: \`File access denied: \${filePath} is outside allowed directories\`
    };
  }
}

return { behavior: 'allow', updatedInput: input };
`
};

// Hook System Types (aligned with Claude Agent SDK)

// Base hook input that all hook events extend
export interface BaseHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
}

// Specific hook input types
export interface PreToolUseHookInput extends BaseHookInput {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: unknown;
}

export interface PostToolUseHookInput extends BaseHookInput {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
}

export interface PostToolUseFailureHookInput extends BaseHookInput {
  hook_event_name: 'PostToolUseFailure';
  tool_name: string;
  tool_input: unknown;
  error: string;
  is_interrupt?: boolean;
}

export interface NotificationHookInput extends BaseHookInput {
  hook_event_name: 'Notification';
  message: string;
  title?: string;
}

export interface UserPromptSubmitHookInput extends BaseHookInput {
  hook_event_name: 'UserPromptSubmit';
  prompt: string;
}

export interface SessionStartHookInput extends BaseHookInput {
  hook_event_name: 'SessionStart';
  source: 'startup' | 'resume' | 'clear' | 'compact';
}

export interface SessionEndHookInput extends BaseHookInput {
  hook_event_name: 'SessionEnd';
  reason: string;
}

export interface StopHookInput extends BaseHookInput {
  hook_event_name: 'Stop';
  stop_hook_active: boolean;
}

export interface SubagentStartHookInput extends BaseHookInput {
  hook_event_name: 'SubagentStart';
  agent_id: string;
  agent_type: string;
}

export interface SubagentStopHookInput extends BaseHookInput {
  hook_event_name: 'SubagentStop';
  stop_hook_active: boolean;
}

export interface PreCompactHookInput extends BaseHookInput {
  hook_event_name: 'PreCompact';
  trigger: 'manual' | 'auto';
  custom_instructions: string | null;
}

export interface PermissionRequestHookInput extends BaseHookInput {
  hook_event_name: 'PermissionRequest';
  tool_name: string;
  tool_input: unknown;
  permission_suggestions?: PermissionUpdate[];
}

// Union type of all hook inputs
export type HookInput =
  | PreToolUseHookInput
  | PostToolUseHookInput
  | PostToolUseFailureHookInput
  | NotificationHookInput
  | UserPromptSubmitHookInput
  | SessionStartHookInput
  | SessionEndHookInput
  | StopHookInput
  | SubagentStartHookInput
  | SubagentStopHookInput
  | PreCompactHookInput
  | PermissionRequestHookInput;

// Hook output types
export interface AsyncHookJSONOutput {
  async: true;
  asyncTimeout?: number;
}

export interface SyncHookJSONOutput {
  continue?: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  decision?: 'approve' | 'block';
  systemMessage?: string;
  reason?: string;
  hookSpecificOutput?:
    | {
        hookEventName: 'PreToolUse';
        permissionDecision?: 'allow' | 'deny' | 'ask';
        permissionDecisionReason?: string;
        updatedInput?: Record<string, unknown>;
      }
    | {
        hookEventName: 'UserPromptSubmit';
        additionalContext?: string;
      }
    | {
        hookEventName: 'SessionStart';
        additionalContext?: string;
      }
    | {
        hookEventName: 'PostToolUse';
        additionalContext?: string;
      };
}

export type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput;

// Hook callback type (SDK specification)
export type HookCallback = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal }
) => Promise<HookJSONOutput>;

// JSON Schema (Phase 3)
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  description?: string;
  enum?: any[];
  const?: any;
  default?: any;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | JSONSchema;
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;
}
