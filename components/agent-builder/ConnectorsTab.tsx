'use client';

import { useEffect, useState } from 'react';
import { useConnectorStore } from '@/lib/stores/connectorStore';
import { PROVIDER_CONFIGS, getConnectorToolNames } from '@/lib/connectors/providers';
import { Label } from '@/components/ui/label';
import { AgentConfig } from '@/lib/types/agent';
import { Plug, ExternalLink, Check, Info, Mail, MessageSquare, FileText, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ConnectorStatusBadge } from '@/components/connectors/ConnectorStatusBadge';
import type { OAuthProvider, OAuthConnection } from '@/lib/types/connector';

interface ConnectorsTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

// Map provider icon names to Lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  Mail: Mail,
  MessageSquare: MessageSquare,
  FileText: FileText,
  Github: Github,
};

export function ConnectorsTab({ config, onChange }: ConnectorsTabProps) {
  const { connections } = useConnectorStore();
  const enabledConnectors = config.connectors || [];

  // Only show connected connectors
  const connectedList = Array.from(connections.values()).filter(
    (conn) => conn.status === 'connected'
  );

  const toggleConnector = (connectionId: string) => {
    const isEnabled = enabledConnectors.includes(connectionId);

    if (isEnabled) {
      // Disable connector
      onChange({
        connectors: enabledConnectors.filter((id) => id !== connectionId),
      });
    } else {
      // Enable connector
      onChange({
        connectors: [...enabledConnectors, connectionId],
      });
    }
  };

  // Get tools available for enabled connectors
  const getEnabledTools = () => {
    const tools: string[] = [];
    for (const connId of enabledConnectors) {
      const conn = connections.get(connId);
      if (conn) {
        const providerTools = getConnectorToolNames(conn.provider);
        tools.push(...providerTools);
      }
    }
    return [...new Set(tools)];
  };

  const enabledTools = getEnabledTools();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Label>OAuth Connectors</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Enable connected services to give your agent access to Gmail, Drive, Slack, Notion, and GitHub
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">What are OAuth Connectors?</h4>
            <p className="text-xs text-muted-foreground mb-2">
              OAuth connectors let your agent securely access external services using your
              authenticated accounts. Connect services in Settings, then enable them here.
            </p>
            <Link href="/settings" target="_blank">
              <Button variant="outline" size="sm" className="text-xs">
                <Plug className="w-3 h-3 mr-1" />
                Manage Connectors
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Connectors List */}
      {connectedList.length === 0 ? (
        <div className="border border-border rounded-lg p-8 text-center">
          <Plug className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-sm mb-2">No connectors available</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Connect to OAuth services first, then enable them for your agents.
          </p>
          <Link href="/settings" target="_blank">
            <Button variant="outline" size="sm">
              <Plug className="w-3 h-3 mr-2" />
              Connect Services
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {connectedList.map((connection) => {
            const isEnabled = enabledConnectors.includes(connection.id);
            const providerConfig = PROVIDER_CONFIGS[connection.provider];
            const Icon = ICON_MAP[providerConfig.icon] || Plug;
            const providerTools = getConnectorToolNames(connection.provider);

            return (
              <button
                key={connection.id}
                type="button"
                onClick={() => toggleConnector(connection.id)}
                className={cn(
                  'w-full p-4 rounded-lg border-2 text-left transition-all hover:shadow-md',
                  isEnabled
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-accent'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${providerConfig.color}15` }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: providerConfig.color }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{providerConfig.name}</h3>
                      <ConnectorStatusBadge status={connection.status} />
                      {isEnabled && (
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </div>

                    {/* User info */}
                    {connection.userInfo && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {connection.userInfo.email || connection.userInfo.name}
                      </p>
                    )}

                    {/* Available tools */}
                    <div className="flex flex-wrap gap-1.5">
                      {providerTools.map((toolName) => (
                        <span
                          key={toolName}
                          className={cn(
                            'text-xs px-2 py-0.5 rounded font-mono',
                            isEnabled
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {toolName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {enabledConnectors.length} of {connectedList.length} connectors enabled
      </div>

      {/* Tools Summary */}
      {enabledTools.length > 0 && (
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">Available Tools</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Your agent will have access to these tools:
          </p>
          <div className="flex flex-wrap gap-2">
            {enabledTools.map((toolName) => (
              <span
                key={toolName}
                className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-mono"
              >
                {toolName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      {enabledConnectors.length > 0 && (
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">How Connectors Work</h4>
          <ul className="text-xs text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span>•</span>
              <span>
                Connector tools (like <code className="font-mono">gmail_list</code>,{' '}
                <code className="font-mono">drive_search</code>) are automatically available
                to your agent when connectors are enabled.
              </span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>
                Your agent accesses external services using your authenticated credentials.
                Token refresh is handled automatically.
              </span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>
                Access permissions are limited to the scopes you granted during OAuth
                (e.g., read-only Gmail access).
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
