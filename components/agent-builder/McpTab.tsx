'use client';

import { useMcpStore } from '@/lib/stores/mcpStore';
import { Label } from '@/components/ui/label';
import { AgentConfig } from '@/lib/types/agent';
import { Settings2, ExternalLink, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface McpTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

export function McpTab({ config, onChange }: McpTabProps) {
  const { connections } = useMcpStore();
  const enabledConnections = config.mcpConnections || [];
  const connectionsList = Array.from(connections.values());

  const toggleConnection = (connectionId: string) => {
    const isEnabled = enabledConnections.includes(connectionId);

    if (isEnabled) {
      // Disable connection
      onChange({
        mcpConnections: enabledConnections.filter(id => id !== connectionId)
      });
    } else {
      // Enable connection
      onChange({
        mcpConnections: [...enabledConnections, connectionId]
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Label>MCP Connections</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Enable Model Context Protocol connections to give your agent access to external services
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">
              What are MCP Connections?
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              MCP (Model Context Protocol) allows agents to interact with databases, APIs,
              file systems, and other external services. Enable connections here to make them
              available to this agent.
            </p>
            <Link href="/settings" target="_blank">
              <Button variant="outline" size="sm" className="text-xs">
                <Settings2 className="w-3 h-3 mr-1" />
                Manage Global Connections
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Connections List */}
      {connectionsList.length === 0 ? (
        <div className="border border-border rounded-lg p-8 text-center">
          <Settings2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-sm mb-2">No MCP connections available</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Create global MCP connections first, then enable them for your agents.
          </p>
          <Link href="/settings" target="_blank">
            <Button variant="outline" size="sm">
              <Settings2 className="w-3 h-3 mr-2" />
              Create MCP Connection
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {connectionsList.map((connection) => {
            const isEnabled = enabledConnections.includes(connection.id);

            return (
              <button
                key={connection.id}
                type="button"
                onClick={() => toggleConnection(connection.id)}
                className={cn(
                  'w-full p-4 rounded-lg border-2 text-left transition-all hover:shadow-md',
                  isEnabled
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-accent'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    <Settings2 className={cn(
                      'w-5 h-5',
                      isEnabled ? 'text-primary' : 'text-muted-foreground'
                    )} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">
                        {connection.name}
                      </h3>
                      {isEnabled && (
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {connection.description}
                    </p>
                    <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                      {connection.type === 'stdio' ? (
                        <>
                          {connection.command}
                          {connection.args && connection.args.length > 0 && (
                            <> {connection.args[0]}</>
                          )}
                          {connection.args && connection.args.length > 1 && ' ...'}
                        </>
                      ) : (
                        connection.url
                      )}
                    </code>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {enabledConnections.length} of {connectionsList.length} connections enabled
      </div>

      {/* Help Text */}
      {enabledConnections.length > 0 && (
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">How MCP Works</h4>
          <ul className="text-xs text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span>•</span>
              <span>
                When your agent runs, it can use tools like <code className="font-mono">ListMcpResources</code> and{' '}
                <code className="font-mono">ReadMcpResource</code> to interact with connected services.
              </span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>
                Each MCP connection provides its own resources (files, database records, API data, etc.)
                that your agent can query and manipulate.
              </span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>
                MCP connections are started automatically when the agent begins execution and
                shut down when the session ends.
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
