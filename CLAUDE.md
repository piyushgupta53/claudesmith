# Claudesmith

Forge powerful AI agents with Claude. Built on Claude Agent SDK v0.2.7+.

## Tech Stack

- **Framework**: Next.js 14 (App Router), TypeScript (strict)
- **State**: Zustand stores
- **Styling**: Tailwind CSS + CSS variables (emerald primary, no blue/purple)
- **Execution**: Docker containers for sandboxed tools
- **SDK**: `@anthropic-ai/claude-agent-sdk` v0.2.7+

## Project Structure

```
app/
  api/                  # API routes
  chat/[sessionId]/     # Chat interface
  agents/               # Agent management
  settings/             # Settings page
components/
  agent-builder/        # Agent config (17 components)
  chat/                 # Chat interface (12 components)
  connectors/           # OAuth connector UI (4 components)
  execution/            # Execution visualization (5 components)
  mcp/                  # MCP management (3 components)
  sandbox/              # Sandbox UI (4 components)
  skills/               # Skills browser
  sidebar/              # Navigation & sessions
  providers/            # Context providers
  ui/                   # shadcn/ui components
lib/
  connectors/
    providers.ts        # OAuth provider configs
    tokenEncryption.ts  # AES-256-GCM token encryption
  services/
    agentExecutor.ts    # SDK query orchestration
    dockerService.ts    # Container management
    executorRegistry.ts # Active executor access
    storageService.ts   # IndexedDB persistence
  stores/               # Zustand (agentStore, chatStore, executionStore, mcpStore, connectorStore)
  tools/
    dockerMcpServer.ts     # Docker MCP server (Read, Write, Bash, Glob, Grep)
    connectorMcpServer.ts  # OAuth connector tools
  utils/
    agentConfigConverter.ts  # Config → SDK options
    safeCodeExecutor.ts      # VM sandbox for user code
    pathValidator.ts         # Path validation
    commandValidator.ts      # Command validation
```

## Core SDK Integration

Central service wrapping SDK's `query()`. **Always use `agentConfigToSDKOptions()`** for config conversion.

```typescript
class AgentExecutor {
  async *execute(prompt: string) {
    const options = await agentConfigToSDKOptions(this.agentConfig, this.containerId);
    for await (const message of query({ prompt, options })) {
      yield message;
    }
  }
}
```

## Tools

| Category | Tools | Execution |
|----------|-------|-----------|
| **MVP** | WebSearch, WebFetch, AskUserQuestion, TodoWrite, Task | API-based |
| **Sandbox** | Read, Write, Bash, Glob, Grep | Docker MCP server |
| **Connectors** | gmail_*, drive_*, slack_*, notion_*, github_* | Connector MCP server |
| **Coming Soon** | Edit, MultiEdit, NotebookEdit | Not yet implemented |
| **Custom** | User-defined via `customTools` | In-process MCP |

### Sandbox Tool Isolation

SDK's built-in sandbox tools are **disabled** and routed through Docker MCP server for security:

```typescript
disabledTools: ['Read', 'Write', 'Bash', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'NotebookEdit']
// Exposed as: mcp__docker__Read, mcp__docker__Write, mcp__docker__Bash, etc.
```

### Container Mounts

| Path | Access | Purpose |
|------|--------|---------|
| `/scratch` | Read-write | Session workspace |
| `/skills` | Read-only | Skill definitions |
| `/claude-cache/projects` | Read-only | SDK tool result cache |

Host paths `~/.claude/projects/...` auto-map to `/claude-cache/projects/...`.

### Custom Tools

```typescript
customTools: [{
  name: 'get_weather',
  description: 'Get weather for a city',
  inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
  handler: `return \`Weather in \${args.city}: 72°\`;`  // Runs in VM sandbox
}]
// Exposed as: mcp__custom-tools-{agentId}__get_weather
```

## OAuth Connectors

| Provider | Scopes | Tools |
|----------|--------|-------|
| **Google** | gmail.readonly, drive.readonly | gmail_list, gmail_read, drive_list, drive_read, drive_search |
| **Slack** | channels:read, channels:history, chat:write | slack_list_channels, slack_read, slack_send |
| **Notion** | read_content | notion_search, notion_read_page |
| **GitHub** | public_repo, read:user | github_list_repos, github_get_repo, github_list_issues |

**OAuth Flow**: Connect → Scope selection → Provider consent → Token encrypted (AES-256-GCM) → Stored in localStorage

**Environment Variables**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`

## Hook System

```typescript
type HookEvent =
  | 'PreToolUse' | 'PostToolUse' | 'PostToolUseFailure'
  | 'SubagentStart' | 'SubagentStop'
  | 'SessionStart' | 'SessionEnd' | 'Stop'
  | 'Notification' | 'UserPromptSubmit'
  | 'PreCompact' | 'PermissionRequest';

// Hook response examples
{ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' | 'deny' } }
{ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: '...' } }
```

**Safety Hook Presets** (optional, on top of built-in security):
- Block Dangerous Bash: `rm -rf`, fork bombs, pipe-to-shell
- Restrict File Paths: `/scratch` boundaries
- Block Secret Access: `.env`, credentials, SSH keys
- Block Network in Bash: `curl`, `wget`, `ssh`

## AgentConfig Schema

```typescript
interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: 'sonnet' | 'opus' | 'haiku' | 'inherit';

  tools: { enabled: string[]; disabled: string[] };
  skills?: { enabled: string[] };
  connectors?: string[];  // OAuth connection IDs

  // Subagents: When defined, agent becomes an orchestrator
  // Use BASE tool names (Read, Bash) - converter adds mcp__ prefix
  subagents: Record<string, {
    description: string;  // When to use (Claude reads this!)
    prompt: string;       // System instructions
    tools?: string[];     // Optional: inherits all if omitted
    model?: string;       // Optional: 'sonnet' | 'opus' | 'haiku'
  }>;

  settings: {
    maxTurns?: number;
    maxBudgetUsd?: number;
    permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk' | 'plan';
  };

  // Advanced
  hooks?: Record<HookEvent, Array<{ matcher?: string; code: string }>>;
  mcpConnections?: string[];
  customTools?: Array<{ name; description; inputSchema: JSONSchema; handler: string }>;
  outputFormat?: { type: 'json_schema'; schema: JSONSchema };
}
```

## State Management

| Store | Purpose |
|-------|---------|
| `agentStore` | Agent CRUD |
| `chatStore` | Sessions, messages |
| `executionStore` | Execution state, questions, permissions, checkpoints |
| `mcpStore` | MCP connections |
| `connectorStore` | OAuth connections, encrypted tokens |

## API Routes

| Route | Purpose |
|-------|---------|
| `/api/agents` | Create/list agents |
| `/api/chat/[sessionId]/stream` | Execute agent (SSE) |
| `/api/chat/[sessionId]/question` | Submit question answers |
| `/api/chat/[sessionId]/permission` | Handle permissions |
| `/api/chat/[sessionId]/interrupt` | Interrupt execution |
| `/api/chat/[sessionId]/checkpoint/rewind` | Rewind to checkpoint |
| `/api/connectors/[provider]/*` | OAuth flow (authorize, callback, refresh, revoke) |
| `/api/docker/status` | Docker health |

## Security

### Docker MCP Validation

| Tool | Validation |
|------|------------|
| `Bash` | `validateBashCommand()` - allowlist only |
| `Read` | `validateReadPath()` - blocks traversal, system dirs, sensitive files |
| `Write` | `validateWritePath()` - `/scratch` only |
| `Grep/Glob` | `shellEscape()` all arguments |

### Bash Command Allowlist

```
Allowed:  ls, cat, head, tail, grep, find, awk, sed, jq, sort, uniq, cut, diff,
          tar, gzip, zip, unzip, date, env, which, python3, node, git, curl, cp, mkdir
Blocked:  rm, mv, chmod, sudo, apt, wget, ssh, nc, gcc, make, npm, pip, vim, eval
Patterns: $(...), backticks, redirects outside /scratch
```

### Sensitive File Blocking

Always blocked even in allowed directories:
```
.env*, .secret*, *.pem, *.key, id_rsa*, .git/config, .aws/credentials,
gcloud*.json, service-account*.json, .npmrc, token*.json, api-key*
```

### Resource Limits

| Limit | Default | Purpose |
|-------|---------|---------|
| `maxResultSize` | 50,000 chars | Truncates large outputs |
| `maxToolTimeoutMs` | 60,000 ms | Command timeout |

### Safe Code Execution

User code (hooks, custom tools) runs in VM sandbox via `safeCodeExecutor.ts`:
- **Blocked**: `process`, `require`, `import`, `fs`, `child_process`, `eval`, `fetch`
- **Allowed**: `JSON`, `Math`, `Date`, `Array`, `Object`, `Map`, `Set`, `Promise`

---

## Orchestrator/Subagent Architecture

### Core Concepts

- **Orchestrator**: Parent agent with subagents defined. Only coordinates—delegates all work via `Task` tool
- **Subagent**: Specialized agent for focused subtasks. Isolated context, restricted tools
- **Task Tool**: SDK mechanism to invoke subagents with `subagent_type` parameter

### Tool Access

| Agent Type | Tools |
|------------|-------|
| Orchestrator | `Task`, `TodoWrite`, `AskUserQuestion` only |
| Subagent | Docker MCP tools, custom tools, connectors (no `Task`) |

**Critical**: Subagents cannot spawn subagents. Never include `Task` in subagent's tools.

### Tool Naming: SDK vs Claudesmith

| Context | Names | Example |
|---------|-------|---------|
| SDK native | Plain | `Read`, `Bash`, `Glob` |
| Claudesmith | MCP-prefixed | `mcp__docker__Read`, `mcp__docker__Bash` |

**Users define plain names** in `AgentConfig.subagents.tools`. The converter adds `mcp__` prefix automatically.

### MCP Tool Pattern

```
mcp__{serverName}__{toolName}
```
- Docker: `mcp__docker__Bash`
- Custom: `mcp__custom-tools-{agentId}__check_owasp`
- Connectors: `mcp__connectors__gmail_read`

### Tool Name Conversion

```
User defines          →    SDK receives
["Bash", "Read"]      →    ["mcp__docker__Bash", "mcp__docker__Read"]
["check_owasp"]       →    ["mcp__custom-tools-{id}__check_owasp"]
undefined             →    undefined (inherits all)
```

### MCP Server Inheritance

MCP servers registered at parent are inherited by subagents. Orchestrator blocked via `canUseTool`:

```typescript
options.canUseTool = async (toolName, input, context) => {
  if (orchestratorBlockedTools.includes(toolName)) {
    if (context?.agentID) return { behavior: 'allow', updatedInput: input };  // Subagent
    return { behavior: 'deny', message: 'Must delegate to subagent' };        // Orchestrator
  }
  return { behavior: 'allow', updatedInput: input };
};
```

Key: `context.agentID` is non-null only for subagent calls.

### Implementation Details

`agentConfigToSDKOptions()` in `lib/utils/agentConfigConverter.ts`:
1. Detects orchestrator mode (has `subagents`)
2. Segregates tools (coordination vs specialized)
3. Converts base names → MCP-prefixed
4. Registers MCP servers at parent for inheritance
5. Auto-injects FileManager subagent
6. Adds `maxTurns: 15` to subagents

### Common Subagent Patterns

```typescript
// Read-only analysis
"code-analyzer": { tools: ["Read", "Grep", "Glob"], model: "haiku" }

// Test execution
"test-runner": { tools: ["Bash", "Read", "Grep"], model: "haiku" }

// Full access (omit tools to inherit all)
"implementer": { model: "sonnet" }
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Subagents not invoked | Ensure `Task` in orchestrator's allowedTools; check `description` clarity |
| Subagent can't access tools | Verify MCP server at parent; check tools array includes needed tools |
| Orchestrator using tools directly | Check `canUseTool` blocking; review `[canUseTool]` logs |

---

## Key Patterns

### Always Do
- Use `agentConfigToSDKOptions()` for config conversion
- Use base tool names in `AgentConfig.subagents.tools`
- Include `Task` in orchestrator's allowedTools
- Register MCP servers at parent level
- Validate paths (`/scratch` only for writes)
- Use `shellEscape()` for user input in commands

### Never Do
- Include `Task` in subagent's tools
- Let orchestrators use specialized tools directly
- Hardcode MCP-prefixed names in AgentConfig
- Access filesystem directly (use DockerService)
- Use `eval()` with user code
- Use blue/purple in UI

## Quick Reference

```typescript
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

// Tool naming: Users define plain names, Claudesmith adds mcp__ prefix
// Orchestrator tools: ['Task', 'TodoWrite', 'AskUserQuestion']
// Subagent detection: message.parent_tool_use_id (non-null inside subagent)

// Task invocation
{ name: 'Task', input: { subagent_type: 'Name', description: '...', prompt: '...' } }

// Enums
PermissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk' | 'plan'
MCPTransport: 'stdio' | 'sse' | 'http'
Model: 'sonnet' | 'opus' | 'haiku' | 'inherit'
OAuthProviders: 'google' | 'slack' | 'notion' | 'github'
```

## Development

```bash
npm run dev      # Dev server
npm run build    # Production build
npm run test     # Jest tests
```

---
*Claude Agent SDK v0.2.7+ • Next.js 14 • TypeScript Strict • Zustand v5*

**Reference**: [SDK Subagents Docs](https://platform.claude.com/docs/en/agent-sdk/subagents)
