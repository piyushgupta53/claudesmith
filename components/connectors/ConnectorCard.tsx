'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConnectorStatusBadge } from './ConnectorStatusBadge';
import type { OAuthConnection, OAuthProviderConfig } from '@/lib/types/connector';
import { getProviderConfig } from '@/lib/connectors/providers';
import {
  Mail,
  MessageSquare,
  FileText,
  Github,
  Trash2,
  RefreshCw,
  ExternalLink,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectorCardProps {
  connection: OAuthConnection;
  onDisconnect: () => void;
  onRefresh: () => void;
  disconnectConfirm: boolean;
  isRefreshing?: boolean;
}

// Map provider icon names to Lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  Mail: Mail,
  MessageSquare: MessageSquare,
  FileText: FileText,
  Github: Github,
};

export function ConnectorCard({
  connection,
  onDisconnect,
  onRefresh,
  disconnectConfirm,
  isRefreshing,
}: ConnectorCardProps) {
  const config = getProviderConfig(connection.provider);
  const Icon = ICON_MAP[config.icon] || FileText;

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Provider info */}
        <div className="flex items-start gap-3 flex-1">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${config.color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm">{config.name}</h3>
              <ConnectorStatusBadge status={connection.status} />
            </div>

            {connection.userInfo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                {connection.userInfo.avatar ? (
                  <img
                    src={connection.userInfo.avatar}
                    alt=""
                    className="w-4 h-4 rounded-full"
                  />
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span className="truncate">
                  {connection.userInfo.email || connection.userInfo.name}
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {config.description}
            </p>

            {/* Granted scopes */}
            {connection.grantedScopes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {connection.grantedScopes.slice(0, 3).map((scope, index) => (
                  <span
                    key={index}
                    className="text-xs bg-muted px-1.5 py-0.5 rounded"
                  >
                    {formatScope(scope)}
                  </span>
                ))}
                {connection.grantedScopes.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{connection.grantedScopes.length - 3} more
                  </span>
                )}
              </div>
            )}

            {/* Error message */}
            {connection.status === 'error' && connection.errorMessage && (
              <p className="mt-2 text-xs text-red-500">
                {connection.errorMessage}
              </p>
            )}

            {/* Last used */}
            {connection.lastUsedAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                Last used: {formatDate(connection.lastUsedAt)}
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {(connection.status === 'expired' || connection.status === 'error') && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-xs"
            >
              <RefreshCw className={cn('w-3 h-3 mr-1', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
          )}

          <Button
            variant={disconnectConfirm ? 'destructive' : 'ghost'}
            size="sm"
            onClick={onDisconnect}
            className="text-xs"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {disconnectConfirm ? 'Confirm' : 'Disconnect'}
          </Button>
        </div>
      </div>

      {/* Available tools */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs font-medium mb-2">Available Tools</p>
        <div className="flex flex-wrap gap-2">
          {config.tools.map((tool) => (
            <div
              key={tool.name}
              className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded"
            >
              <span className="font-mono">{tool.name}</span>
              <span
                className={cn(
                  'px-1 rounded text-[10px]',
                  tool.access === 'read'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : tool.access === 'write'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-primary/10 text-primary'
                )}
              >
                {tool.access}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Provider card for connecting (not yet connected)
 */
interface ProviderCardProps {
  config: OAuthProviderConfig;
  onConnect: () => void;
  isConnecting?: boolean;
  isConfigured: boolean;
}

export function ProviderCard({
  config,
  onConnect,
  isConnecting,
  isConfigured,
}: ProviderCardProps) {
  const Icon = ICON_MAP[config.icon] || FileText;

  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Provider info */}
        <div className="flex items-start gap-3 flex-1">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${config.color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">{config.name}</h3>
            <p className="text-xs text-muted-foreground">
              {config.description}
            </p>

            {/* Tools preview */}
            <div className="mt-2 flex flex-wrap gap-1">
              {config.tools.slice(0, 3).map((tool) => (
                <span
                  key={tool.name}
                  className="text-xs bg-muted/50 px-1.5 py-0.5 rounded font-mono"
                >
                  {tool.name}
                </span>
              ))}
              {config.tools.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{config.tools.length - 3} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Connect button */}
        <Button
          onClick={onConnect}
          disabled={isConnecting || !isConfigured}
          size="sm"
        >
          {isConnecting ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Connecting...
            </>
          ) : !isConfigured ? (
            'Not Configured'
          ) : (
            <>
              <ExternalLink className="w-3 h-3 mr-1" />
              Connect
            </>
          )}
        </Button>
      </div>

      {!isConfigured && (
        <p className="mt-3 text-xs text-amber-500">
          OAuth credentials not configured. Add {config.name} client ID and secret to environment variables.
        </p>
      )}
    </div>
  );
}

/**
 * Format scope string for display
 */
function formatScope(scope: string): string {
  // Extract the last part of URL-style scopes
  const parts = scope.split('/');
  const lastPart = parts[parts.length - 1];

  // Convert snake_case/camelCase to readable format
  return lastPart
    .replace(/[._:]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
