/**
 * Shared utility for converting technical tool names to human-readable labels.
 * Used across all UI components that display tool names.
 */

import {
  FileSearch,
  FileEdit,
  Terminal,
  Search,
  Globe,
  HelpCircle,
  ListChecks,
  Loader2,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icon mapping for known tools
 */
export const toolIcons: Record<string, LucideIcon> = {
  Read: FileSearch,
  Write: FileEdit,
  Edit: FileEdit,
  Bash: Terminal,
  WebSearch: Search,
  WebFetch: Globe,
  AskUserQuestion: HelpCircle,
  TodoWrite: ListChecks,
  Grep: Search,
  Glob: FileSearch,
};

/**
 * Human-readable names for built-in tools
 */
const builtInToolNames: Record<string, string> = {
  AskUserQuestion: 'Ask Question',
  TodoWrite: 'Update Tasks',
  WebSearch: 'Web Search',
  WebFetch: 'Fetch Page',
  Read: 'Read File',
  Write: 'Write File',
  Edit: 'Edit File',
  Bash: 'Run Command',
  Grep: 'Search Content',
  Glob: 'Find Files',
};

/**
 * Human-readable names for Docker sandbox tools
 */
const dockerToolNames: Record<string, string> = {
  Read: 'Read File',
  Write: 'Write File',
  Bash: 'Run Command',
  Grep: 'Search Content',
  Glob: 'Find Files',
  Edit: 'Edit File',
};

/**
 * Human-readable names for Notion API tools
 */
const notionToolNames: Record<string, string> = {
  'API-post-search': 'Search Notion',
  'API-get-block-children': 'Get Page Content',
  'API-retrieve-a-page': 'Get Page',
  'API-query-data-source': 'Query Database',
  'API-retrieve-a-database': 'Get Database',
  'API-list-databases': 'List Databases',
  'API-create-a-page': 'Create Page',
  'API-update-a-page': 'Update Page',
  'API-delete-a-block': 'Delete Block',
};

/**
 * Human-readable names for GitHub MCP tools
 */
const githubToolNames: Record<string, string> = {
  'search_repositories': 'Search Repos',
  'get_file_contents': 'Get File',
  'create_or_update_file': 'Update File',
  'push_files': 'Push Files',
  'create_issue': 'Create Issue',
  'list_issues': 'List Issues',
  'create_pull_request': 'Create PR',
  'list_commits': 'List Commits',
  'get_pull_request': 'Get PR',
  'list_pull_requests': 'List PRs',
};

/**
 * Convert technical tool names to human-readable labels.
 * Handles MCP tools (mcp__server__tool), custom tools, and built-in tools.
 */
export function getToolDisplayName(toolName: string): string {
  // Handle MCP tools: mcp__<server>__<tool>
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    const server = parts[1]; // e.g., "Notion", "docker", "github"
    const tool = parts.slice(2).join('__'); // e.g., "API-post-search"

    // Docker sandbox tools
    if (server === 'docker') {
      return dockerToolNames[tool] || tool;
    }

    // Notion API tools
    if (server === 'Notion' || server === 'notion') {
      if (notionToolNames[tool]) {
        return notionToolNames[tool];
      }
      // Fallback: format the API tool name nicely
      return `Notion: ${tool.replace('API-', '').replace(/-/g, ' ')}`;
    }

    // GitHub tools
    if (server === 'github' || server === 'GitHub') {
      if (githubToolNames[tool]) {
        return githubToolNames[tool];
      }
      // Fallback: format the tool name nicely
      return `GitHub: ${tool.replace(/_/g, ' ')}`;
    }

    // Custom tools: mcp__custom-tools-{agentId}__{toolName}
    if (server.startsWith('custom-tools')) {
      // Extract the actual tool name and format it
      return tool
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // Generic MCP tools - format nicely
    // Capitalize server name and format tool name
    const formattedServer = server.charAt(0).toUpperCase() + server.slice(1);
    const formattedTool = tool
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return `${formattedServer}: ${formattedTool}`;
  }

  // Built-in tools
  return builtInToolNames[toolName] || toolName;
}

/**
 * Get the appropriate icon for a tool.
 * Handles MCP tools, custom tools, and built-in tools.
 */
export function getToolIcon(toolName: string): LucideIcon {
  // Check direct match first
  if (toolIcons[toolName]) {
    return toolIcons[toolName];
  }

  // Handle MCP tools
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    const server = parts[1];
    const tool = parts.slice(2).join('__');

    // Docker tools - use the base tool's icon
    if (server === 'docker' && toolIcons[tool]) {
      return toolIcons[tool];
    }

    // Notion tools - use appropriate icons
    if (server === 'Notion' || server === 'notion') {
      if (tool.includes('search')) return Search;
      if (tool.includes('block') || tool.includes('page')) return FileSearch;
      if (tool.includes('database')) return ListChecks;
    }

    // GitHub tools
    if (server === 'github' || server === 'GitHub') {
      if (tool.includes('search')) return Search;
      if (tool.includes('file')) return FileSearch;
      if (tool.includes('issue') || tool.includes('pull')) return ListChecks;
    }

    // Custom tools - use Zap icon
    if (server.startsWith('custom-tools')) {
      return Zap;
    }

    // Default MCP icon
    return Globe;
  }

  return Loader2;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatToolDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Parse a bash command and return a human-readable description
 */
export function getBashCommandDescription(command: string): string {
  if (!command) return 'Running command';

  // Get the first command (before && or |)
  const firstCmd = command.split(/&&|\|/)[0].trim();

  // Extract the base command (first word)
  const parts = firstCmd.split(/\s+/);
  const baseCmd = parts[0];

  // Map common commands to human-readable descriptions
  const commandDescriptions: Record<string, string | ((args: string[]) => string)> = {
    // File reading
    'cat': (args) => {
      const file = args.find(a => !a.startsWith('-'));
      return file ? `Reading ${getFileName(file)}` : 'Reading file';
    },
    'head': (args) => {
      const file = args.find(a => !a.startsWith('-'));
      return file ? `Reading ${getFileName(file)}` : 'Reading file header';
    },
    'tail': (args) => {
      const file = args.find(a => !a.startsWith('-'));
      return file ? `Reading ${getFileName(file)}` : 'Reading file tail';
    },
    'less': () => 'Viewing file',
    'more': () => 'Viewing file',

    // File operations
    'cp': () => 'Copying files',
    'mv': () => 'Moving files',
    'rm': () => 'Removing files',
    'mkdir': () => 'Creating directory',
    'touch': () => 'Creating file',
    'chmod': () => 'Changing permissions',
    'chown': () => 'Changing ownership',

    // Search
    'grep': (args) => {
      const pattern = args.find(a => !a.startsWith('-'));
      return pattern ? `Searching for "${truncate(pattern, 15)}"` : 'Searching content';
    },
    'rg': (args) => {
      const pattern = args.find(a => !a.startsWith('-'));
      return pattern ? `Searching for "${truncate(pattern, 15)}"` : 'Searching content';
    },
    'find': () => 'Finding files',
    'locate': () => 'Locating files',
    'which': () => 'Finding command path',
    'whereis': () => 'Finding command location',

    // Text processing
    'sed': () => 'Processing text',
    'awk': () => 'Processing text',
    'cut': () => 'Extracting columns',
    'sort': () => 'Sorting data',
    'uniq': () => 'Finding unique lines',
    'wc': () => 'Counting lines/words',
    'tr': () => 'Translating characters',
    'jq': () => 'Processing JSON',
    'xargs': () => 'Processing arguments',

    // Package managers
    'npm': (args) => {
      const subCmd = args[0];
      const npmActions: Record<string, string> = {
        'install': 'Installing dependencies',
        'i': 'Installing dependencies',
        'run': args[1] ? `Running ${args[1]}` : 'Running script',
        'start': 'Starting application',
        'build': 'Building project',
        'test': 'Running tests',
        'publish': 'Publishing package',
        'init': 'Initializing project',
      };
      return npmActions[subCmd] || 'Running npm';
    },
    'yarn': (args) => {
      const subCmd = args[0];
      const yarnActions: Record<string, string> = {
        'install': 'Installing dependencies',
        'add': 'Adding dependency',
        'run': args[1] ? `Running ${args[1]}` : 'Running script',
        'start': 'Starting application',
        'build': 'Building project',
        'test': 'Running tests',
      };
      return yarnActions[subCmd] || 'Running yarn';
    },
    'pnpm': (args) => {
      const subCmd = args[0];
      return subCmd === 'install' ? 'Installing dependencies' : `Running pnpm ${subCmd || ''}`.trim();
    },
    'pip': (args) => args[0] === 'install' ? 'Installing Python packages' : 'Running pip',
    'pip3': (args) => args[0] === 'install' ? 'Installing Python packages' : 'Running pip',
    'cargo': (args) => {
      const cargoActions: Record<string, string> = {
        'build': 'Building Rust project',
        'run': 'Running Rust project',
        'test': 'Running Rust tests',
      };
      return cargoActions[args[0]] || 'Running cargo';
    },

    // Version control
    'git': (args) => {
      const gitActions: Record<string, string> = {
        'clone': 'Cloning repository',
        'pull': 'Pulling changes',
        'push': 'Pushing changes',
        'commit': 'Committing changes',
        'add': 'Staging files',
        'status': 'Checking status',
        'diff': 'Viewing changes',
        'log': 'Viewing history',
        'checkout': 'Switching branch',
        'branch': 'Managing branches',
        'merge': 'Merging branches',
        'fetch': 'Fetching updates',
        'stash': 'Stashing changes',
      };
      return gitActions[args[0]] || 'Running git';
    },

    // System info
    'ls': () => 'Listing files',
    'pwd': () => 'Getting current directory',
    'whoami': () => 'Getting username',
    'hostname': () => 'Getting hostname',
    'uname': () => 'Getting system info',
    'df': () => 'Checking disk space',
    'du': () => 'Checking directory size',
    'ps': () => 'Listing processes',
    'top': () => 'Monitoring processes',
    'htop': () => 'Monitoring processes',
    'free': () => 'Checking memory',
    'uptime': () => 'Checking uptime',

    // Network
    'curl': () => 'Fetching URL',
    'wget': () => 'Downloading file',
    'ping': () => 'Pinging host',
    'ssh': () => 'Connecting via SSH',
    'scp': () => 'Copying via SSH',

    // Docker
    'docker': (args) => {
      const dockerActions: Record<string, string> = {
        'build': 'Building image',
        'run': 'Running container',
        'ps': 'Listing containers',
        'exec': 'Executing in container',
        'pull': 'Pulling image',
        'push': 'Pushing image',
        'stop': 'Stopping container',
        'start': 'Starting container',
        'logs': 'Viewing container logs',
      };
      return dockerActions[args[0]] || 'Running docker';
    },

    // Python
    'python': () => 'Running Python',
    'python3': () => 'Running Python',
    'node': () => 'Running Node.js',
    'deno': () => 'Running Deno',
    'bun': () => 'Running Bun',

    // Build tools
    'make': () => 'Running make',
    'cmake': () => 'Running cmake',
    'tsc': () => 'Compiling TypeScript',
    'webpack': () => 'Bundling with webpack',
    'vite': () => 'Running Vite',
    'esbuild': () => 'Building with esbuild',

    // Testing
    'jest': () => 'Running Jest tests',
    'vitest': () => 'Running Vitest tests',
    'pytest': () => 'Running pytest',
    'mocha': () => 'Running Mocha tests',

    // Misc
    'echo': () => 'Printing output',
    'printf': () => 'Printing output',
    'date': () => 'Getting date/time',
    'sleep': () => 'Waiting',
    'true': () => 'No operation',
    'false': () => 'No operation',
    'exit': () => 'Exiting',
    'cd': () => 'Changing directory',
    'export': () => 'Setting environment',
    'env': () => 'Showing environment',
    'source': () => 'Sourcing script',
    '.': () => 'Sourcing script',
  };

  const handler = commandDescriptions[baseCmd];

  if (handler) {
    if (typeof handler === 'function') {
      return handler(parts.slice(1));
    }
    return handler;
  }

  // For unknown commands, try to make it somewhat readable
  // If it looks like a script or binary, just say "Running command"
  if (baseCmd.includes('/') || baseCmd.startsWith('./')) {
    return 'Running script';
  }

  // Check for npx commands
  if (baseCmd === 'npx') {
    const tool = parts[1];
    return tool ? `Running ${tool}` : 'Running npx';
  }

  return 'Running command';
}

/**
 * Helper to get filename from path
 */
function getFileName(path: string): string {
  const name = path.split('/').pop() || path;
  return truncate(name, 20);
}

/**
 * Helper to truncate string
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}
