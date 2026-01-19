'use client';

import { GlobalMcpConnection } from '@/lib/stores/mcpStore';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Copy, Terminal, Key, Globe, Radio } from 'lucide-react';

interface McpConnectionCardProps {
  connection: GlobalMcpConnection;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  deleteConfirm: boolean;
}

/**
 * Get icon component based on transport type
 */
function getTransportIcon(type: GlobalMcpConnection['type']) {
  switch (type) {
    case 'stdio':
      return Terminal;
    case 'http':
      return Globe;
    case 'sse':
      return Radio;
    default:
      return Terminal;
  }
}

/**
 * Get badge color class based on transport type
 */
function getTypeBadgeClass(type: GlobalMcpConnection['type']) {
  switch (type) {
    case 'stdio':
      return 'bg-muted/50 text-muted-foreground';
    case 'http':
      return 'bg-primary/10 text-primary';
    case 'sse':
      return 'bg-warning/10 text-warning';
    default:
      return 'bg-muted/50 text-muted-foreground';
  }
}

export function McpConnectionCard({
  connection,
  onEdit,
  onDelete,
  onDuplicate,
  deleteConfirm,
}: McpConnectionCardProps) {
  const isStdio = connection.type === 'stdio';
  const hasEnvVars = isStdio && connection.env && Object.keys(connection.env).length > 0;
  const hasHeaders = !isStdio && connection.headers && Object.keys(connection.headers).length > 0;
  const TransportIcon = getTransportIcon(connection.type);

  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <TransportIcon className="w-4 h-4 text-primary flex-shrink-0" />
            <h3 className="font-semibold text-sm">{connection.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded ${getTypeBadgeClass(connection.type)}`}>
              {connection.type.toUpperCase()}
            </span>
            {hasEnvVars && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                <Key className="w-3 h-3" />
                Env Vars
              </span>
            )}
            {hasHeaders && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                <Key className="w-3 h-3" />
                Headers
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            {connection.description}
          </p>

          {/* Command/URL based on type */}
          <div className="bg-muted/50 rounded-md p-2 border border-border/50">
            <code className="text-xs font-mono block break-all">
              {isStdio ? (
                <>
                  {connection.command}
                  {connection.args && connection.args.length > 0 && (
                    <> {connection.args.join(' ')}</>
                  )}
                </>
              ) : (
                connection.url
              )}
            </code>
          </div>

          {/* Environment Variables (stdio only) */}
          {hasEnvVars && isStdio && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium">Environment variables: </span>
              {Object.keys(connection.env!).join(', ')}
            </div>
          )}

          {/* Headers (HTTP/SSE only) */}
          {hasHeaders && !isStdio && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium">Headers: </span>
              {Object.keys(connection.headers!).join(', ')}
            </div>
          )}

          {/* Metadata */}
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Created {new Date(connection.createdAt).toLocaleDateString()}
            </span>
            {connection.updatedAt !== connection.createdAt && (
              <span>
                Updated {new Date(connection.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onDuplicate}
            title="Duplicate connection"
          >
            <Copy className="w-3 h-3" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            title="Edit connection"
          >
            <Edit className="w-3 h-3" />
          </Button>

          <Button
            variant={deleteConfirm ? 'destructive' : 'outline'}
            size="sm"
            onClick={onDelete}
            title={deleteConfirm ? 'Click again to confirm' : 'Delete connection'}
          >
            <Trash2 className="w-3 h-3" />
            {deleteConfirm && (
              <span className="ml-1 text-xs">Confirm?</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
