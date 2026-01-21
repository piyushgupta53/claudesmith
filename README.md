# Claudesmith

Build powerful AI agents with Claude. A platform built on **Claude Agent SDK** featuring Docker sandbox execution, OAuth connectors, skills system, and AI-powered agent creation.

## 🎬 Demo

https://github.com/user-attachments/assets/cd3b23b4-9334-4dec-a184-e732177ee158

## ✨ Key Features

### 🚀 Instant Mode - AI-Powered Agent Creation
- **Natural Language to Agent**: Describe what you want in plain English
- **Smart Generation**: AI selects tools, skills, and creates optimized prompts
- **10-Second Setup**: From idea to working agent in seconds
- **One-Click Deploy**: Launch immediately or customize further

### 🐳 Docker Sandbox Execution
- **Isolated Containers**: Safe execution environment per session
- **File Operations**: Read files, write to `/scratch` workspace
- **Bash Commands**: Execute whitelisted shell commands with security validation
- **Multi-Mount Architecture**: `/scratch` (read-write), `/skills` (read-only)
- **Security Layers**: Command validation, path sanitization, network restrictions

### 🔗 OAuth Connectors
Connect your agents to external services with secure OAuth authentication:
- **Gmail** - List and read emails
- **Google Drive** - List, read, and search files
- **Slack** - List channels, read/send messages
- **Notion** - Search and read pages
- **GitHub** - List repos, get details, list issues

### 📚 Skills System
- **Pre-Built Knowledge**: Professional skills (data-analysis, code-review, research, scripting)
- **Markdown-Based**: Readable, version-controllable markdown files
- **Auto-Injection**: Enabled skills automatically added to agent context
- **Custom Skills**: Create your own domain-specific knowledge modules

### 🎛️ Advanced Agent Builder
1. **Details** - Name, description, model, category, icon, color
2. **System Prompt** - Multi-panel editor with templates
3. **Tools** - Enable/disable sandbox and API tools
4. **Skills** - Select pre-built knowledge modules
5. **Connectors** - OAuth integrations
6. **MCP Servers** - Model Context Protocol integrations
7. **Custom Tools** - Build your own tool functions
8. **Subagents** - Nested agent configuration with orchestrator patterns
9. **Output Format** - Structured JSON schema output
10. **Hooks** - JavaScript lifecycle events (12 hook types)
11. **Context** - Static and dynamic context injection
12. **Error Handling** - Retry logic, fallbacks, recovery
13. **Settings** - Turns, budget, permissions, checkpointing

### 💬 Rich Chat Interface
- **Streaming Responses** - Real-time text generation with thinking indicators
- **Specialized Cards**: Enhanced visualization for sandbox operations
  - **Bash Execution**: Commands with color-coded exit status, stdout/stderr
  - **File Operations**: Read/Write with content preview and download
  - **Sandbox Status**: Container resources, uptime, mounts
- **Filesystem Browser**: Interactive tree view of /scratch directory
- **Permission Dialogs**: Approve/deny tool execution with context
- **Question Dialogs**: Interactive prompts from agents
- **File Checkpointing**: Rewind file changes to previous states

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript 5.3
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State**: Zustand with persistence
- **Agent SDK**: @anthropic-ai/claude-agent-sdk v0.2.7+
- **Sandbox**: Docker (via dockerode)
- **Storage**: IndexedDB (idb) for agents, sessions, connectors
- **Testing**: Jest + React Testing Library

## Getting Started

### Prerequisites

- **Node.js 18+** and npm/pnpm/yarn
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- **Claude API key** from [Anthropic Console](https://console.anthropic.com/)

### Quick Start

1. **Clone and Install**
```bash
git clone <repository-url>
cd claudesmith
npm install
```

2. **Start Docker Desktop**
```bash
# macOS
open -a Docker

# Verify it's running:
docker info
```

3. **Configure Environment**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys (see `.env.example` for all available options).

4. **Run Development Server**
```bash
npm run dev
```

5. **Open Browser**
Navigate to [http://localhost:3000](http://localhost:3000)

### First Agent

**Option 1: Instant Mode (Recommended)**
1. Click **Create Agent**
2. Enter description: "Analyze CSV data files and create summary reports"
3. Click **Generate Agent**
4. Review and click **Create Agent**
5. Start chatting!

**Option 2: Use Template**
1. Browse **Agent Library**
2. Click pre-built template (e.g., "Data Analyst")
3. Click **Chat** to start conversation

**Option 3: Advanced Mode**
1. Click **Create Agent** → **Advanced Mode**
2. Configure all tabs with full control
3. Save and launch

## 📁 Project Structure

```
claudesmith/
├── app/                    # Next.js App Router
│   ├── agents/             # Agent pages (new, edit, detail)
│   ├── chat/[sessionId]/   # Chat interface
│   ├── settings/           # Settings page
│   ├── connectors/         # OAuth connector management
│   ├── mcp/                # MCP server management
│   └── api/                # API routes
│       ├── chat/           # Stream, question, permission, interrupt
│       ├── agents/         # CRUD, generate
│       ├── docker/         # Container management
│       └── skills/         # Skills listing
├── components/
│   ├── ui/                 # shadcn/ui base components
│   ├── agent-builder/      # Agent configuration tabs
│   ├── chat/               # Chat interface + message rendering
│   ├── sandbox/            # Sandbox visualization
│   ├── skills/             # Skills browser
│   ├── mcp/                # MCP connection manager
│   ├── sidebar/            # Navigation & sessions
│   └── providers/          # Context providers
├── lib/
│   ├── services/           # agentExecutor, dockerService, skillsManager
│   ├── stores/             # agentStore, chatStore, mcpStore, executionStore, connectorStore
│   ├── tools/              # dockerMcpServer, connectorMcpServer, toolRegistry
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # agentConfigConverter, validators, safeCodeExecutor
│   ├── connectors/         # OAuth providers, token encryption
│   └── prompts/            # metaAgentPrompt for Instant Mode
├── templates/              # Pre-built agent templates
└── .claude/skills/         # SDK-native skills directory
```

## 🔧 Available Tools

### Sandbox Tools (Docker MCP Server)
Executed in isolated Docker containers:

| Tool | Description |
|------|-------------|
| `Read` | Read files from `/scratch` or `/skills` |
| `Write` | Write files to `/scratch` |
| `Bash` | Execute whitelisted shell commands |
| `Glob` | Search for files by pattern |
| `Grep` | Search file contents with regex |

### API Tools (SDK Built-in)

| Tool | Description |
|------|-------------|
| `WebSearch` | Search the web |
| `WebFetch` | Fetch and analyze web pages |
| `AskUserQuestion` | Interactive prompts to user |
| `TodoWrite` | Task list management |
| `Task` | Delegate work to subagents |

### Connector Tools (OAuth MCP Server)

| Provider | Tools |
|----------|-------|
| Gmail | `gmail_list`, `gmail_read` |
| Google Drive | `drive_list`, `drive_read`, `drive_search` |
| Slack | `slack_list_channels`, `slack_read`, `slack_send` |
| Notion | `notion_search`, `notion_read_page` |
| GitHub | `github_list_repos`, `github_get_repo`, `github_list_issues` |

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

## Development

```bash
# Development server
npm run dev

# Production build
npm run build && npm start

# Linting
npm run lint

# Type check
npx tsc --noEmit

# Build Docker image
npm run build:docker
```

## Resources

- [Claude Agent SDK Documentation](https://docs.anthropic.com/en/docs/claude-agent-sdk)
