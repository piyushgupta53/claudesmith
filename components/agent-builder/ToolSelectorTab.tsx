'use client';

import { Label } from '@/components/ui/label';
import { AgentConfig, MVP_TOOLS, SANDBOX_TOOLS, isSandboxTool } from '@/lib/types/agent';
import { Check, Info, Search, Globe, MessageSquare, ListTodo, Database, BookOpen, FileText, FileEdit, Terminal, FileSearch, Filter, Box, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface ToolSelectorTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

interface ToolInfo {
  name: string;
  description: string;
  icon: LucideIcon;
  category: 'api' | 'sandbox';
}

const TOOLS_INFO: Record<string, ToolInfo> = {
  // MVP Tools (API-based)
  WebSearch: { name: 'WebSearch', description: 'Search the web using Brave Search API', icon: Search, category: 'api' },
  WebFetch: { name: 'WebFetch', description: 'Fetch and analyze web page content', icon: Globe, category: 'api' },
  AskUserQuestion: { name: 'AskUserQuestion', description: 'Ask the user for clarification', icon: MessageSquare, category: 'api' },
  TodoWrite: { name: 'TodoWrite', description: 'Manage task lists and tracking', icon: ListTodo, category: 'api' },
  ListMcpResources: { name: 'ListMcpResources', description: 'List resources from MCP servers', icon: Database, category: 'api' },
  ReadMcpResource: { name: 'ReadMcpResource', description: 'Read data from MCP servers', icon: BookOpen, category: 'api' },

  // Sandbox Tools (Docker-based)
  Read: { name: 'Read', description: 'Read files from /scratch or /skills', icon: FileText, category: 'sandbox' },
  Write: { name: 'Write', description: 'Write files to /scratch workspace', icon: FileEdit, category: 'sandbox' },
  Glob: { name: 'Glob', description: 'Search for files by pattern', icon: FileSearch, category: 'sandbox' },
  Grep: { name: 'Grep', description: 'Search file contents with regex', icon: Filter, category: 'sandbox' },
  Bash: { name: 'Bash', description: 'Execute safe bash commands', icon: Terminal, category: 'sandbox' },
};

export function ToolSelectorTab({ config, onChange }: ToolSelectorTabProps) {
  const enabledTools = config.tools?.enabled || [];
  const disabledTools = config.tools?.disabled || [];

  const isToolEnabled = (tool: string) => {
    return enabledTools.includes(tool) && !disabledTools.includes(tool);
  };

  // Implemented sandbox tools that are available
  const IMPLEMENTED_SANDBOX_TOOLS = ['Read', 'Write', 'Bash', 'Glob', 'Grep'];

  const isToolImplemented = (tool: string) => {
    if (!isSandboxTool(tool)) return true; // MVP tools are always available
    return IMPLEMENTED_SANDBOX_TOOLS.includes(tool);
  };

  const toggleTool = (tool: string) => {
    const isEnabled = isToolEnabled(tool);

    // Prevent ENABLING unimplemented sandbox tools (but allow disabling)
    if (!isEnabled && isSandboxTool(tool) && !isToolImplemented(tool)) {
      return;
    }

    if (isEnabled) {
      // Disable the tool
      onChange({
        tools: {
          enabled: enabledTools.filter(t => t !== tool),
          disabled: [...disabledTools, tool],
        }
      });
    } else {
      // Enable the tool
      onChange({
        tools: {
          enabled: [...enabledTools.filter(t => t !== tool), tool],
          disabled: disabledTools.filter(t => t !== tool),
        }
      });
    }
  };

  const enableAll = () => {
    // Enable all implemented tools
    onChange({
      tools: {
        enabled: [...MVP_TOOLS, ...IMPLEMENTED_SANDBOX_TOOLS],
        disabled: [],
      }
    });
  };

  const disableAll = () => {
    onChange({
      tools: {
        enabled: [],
        disabled: [...MVP_TOOLS, ...IMPLEMENTED_SANDBOX_TOOLS],
      }
    });
  };

  const apiToolsEnabled = enabledTools.filter(t => !isSandboxTool(t)).length;
  const sandboxToolsEnabled = enabledTools.filter(t => isSandboxTool(t) && isToolImplemented(t)).length;
  const totalEnabled = apiToolsEnabled + sandboxToolsEnabled;

  return (
    <div className="space-y-8">
      {/* Stats Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{totalEnabled}</p>
              <p className="text-xs text-muted-foreground">Tools enabled</p>
            </div>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="flex gap-4 text-xs">
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">{apiToolsEnabled}</span> API
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">{sandboxToolsEnabled}</span> Sandbox
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={enableAll}
            className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            Enable All
          </button>
          <button
            type="button"
            onClick={disableAll}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
          >
            Disable All
          </button>
        </div>
      </div>

      {/* API-Based Tools */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Globe className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">API-Based Tools</h3>
            <p className="text-xs text-muted-foreground">Web search, data fetching, and interaction tools</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MVP_TOOLS.map((tool) => {
            const isEnabled = isToolEnabled(tool);
            const toolInfo = TOOLS_INFO[tool];
            const Icon = toolInfo?.icon || Box;

            return (
              <button
                key={tool}
                type="button"
                onClick={() => toggleTool(tool)}
                className={cn(
                  'group flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200',
                  isEnabled
                    ? 'border-primary bg-primary/5 shadow-glow-sm'
                    : 'border-border bg-card hover:border-border-strong hover:bg-card/80'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                  isEnabled ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground group-hover:bg-muted'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-medium', isEnabled ? 'text-foreground' : 'text-foreground')}>
                      {tool}
                    </span>
                    {isEnabled && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {toolInfo?.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sandbox Tools */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-success/10 flex items-center justify-center">
              <Terminal className="w-3.5 h-3.5 text-success" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Sandbox Tools</h3>
              <p className="text-xs text-muted-foreground">File operations and command execution in Docker</p>
            </div>
          </div>
          <span className="px-2 py-1 text-[10px] font-medium text-success bg-success/10 rounded-md border border-success/20">
            Docker Required
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SANDBOX_TOOLS.filter(tool => isToolImplemented(tool)).map((tool) => {
            const isEnabled = isToolEnabled(tool);
            const toolInfo = TOOLS_INFO[tool];
            const Icon = toolInfo?.icon || Box;

            return (
              <button
                key={tool}
                type="button"
                onClick={() => toggleTool(tool)}
                className={cn(
                  'group flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200',
                  isEnabled
                    ? 'border-success bg-success/5 shadow-[0_0_15px_-3px] shadow-success/20'
                    : 'border-border bg-card hover:border-border-strong hover:bg-card/80'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                  isEnabled ? 'bg-success/20 text-success' : 'bg-muted/50 text-muted-foreground group-hover:bg-muted'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-medium', isEnabled ? 'text-foreground' : 'text-foreground')}>
                      {tool}
                    </span>
                    {isEnabled && (
                      <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
                        <Check className="w-3 h-3 text-success-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {toolInfo?.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-xl border border-border bg-card/50">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground mb-1">
              About Sandbox Tools
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sandbox tools run in isolated Docker containers for safe file operations and command execution.
              Files are stored in <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">/scratch</code> workspace
              and persist across sessions. Make sure Docker Desktop is running to use these tools.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
