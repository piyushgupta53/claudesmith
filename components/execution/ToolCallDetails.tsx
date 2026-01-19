'use client';

import { ToolCall } from '@/lib/types/chat';
import {
  CheckCircle2,
  XCircle,
  Circle,
  Clock,
} from 'lucide-react';
import { formatDuration } from '@/lib/services/executionTracker';
import { getToolDisplayName, getToolIcon } from '@/lib/utils/toolDisplayNames';

interface ToolCallDetailsProps {
  toolCall: ToolCall;
}

const statusIcons = {
  pending: Circle,
  running: Circle,
  completed: CheckCircle2,
  failed: XCircle,
};

// Clean color scheme without blue/purple
const statusColors = {
  pending: 'text-muted-foreground bg-muted',
  running: 'text-primary bg-primary/10',
  completed: 'text-success bg-success/10',
  failed: 'text-destructive bg-destructive/10',
};

export function ToolCallDetails({ toolCall }: ToolCallDetailsProps) {
  const ToolIcon = getToolIcon(toolCall.name);
  const StatusIcon = statusIcons[toolCall.status];
  const statusColor = statusColors[toolCall.status];
  const displayName = getToolDisplayName(toolCall.name);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`p-4 ${statusColor}`}>
        <div className="flex items-center gap-3">
          {/* Tool Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center">
            <ToolIcon className="w-5 h-5" />
          </div>

          {/* Tool Info */}
          <div className="flex-1">
            <h3 className="font-medium text-foreground">{displayName}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <StatusIcon className={`w-3 h-3 ${toolCall.status === 'running' ? 'animate-pulse' : ''}`} />
              <span className="capitalize">{toolCall.status}</span>
              {toolCall.duration && (
                <>
                  <span>•</span>
                  <Clock className="w-3 h-3" />
                  <span className="font-mono">{formatDuration(toolCall.duration)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 bg-card">
        {/* Timestamp */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
            Timestamp
          </div>
          <div className="text-sm font-mono">
            {new Date(toolCall.timestamp).toLocaleString()}
          </div>
        </div>

        {/* Input */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
            Input
          </div>
          <div className="bg-muted/50 rounded-md p-3 overflow-x-auto border border-border/50">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
        </div>

        {/* Output */}
        {toolCall.output && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Output
            </div>
            <div className="bg-muted/50 rounded-md p-3 overflow-x-auto max-h-96 overflow-y-auto border border-border/50">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground">
                {typeof toolCall.output === 'string'
                  ? toolCall.output
                  : JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Error */}
        {toolCall.error && (
          <div>
            <div className="text-xs font-medium text-destructive mb-1.5 uppercase tracking-wide">
              Error
            </div>
            <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
              <p className="text-sm text-destructive">{toolCall.error}</p>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-3 border-t border-border">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Tool ID</div>
              <div className="font-mono text-xs truncate">{toolCall.id}</div>
            </div>
            {toolCall.duration && (
              <div>
                <div className="text-xs text-muted-foreground">Duration</div>
                <div className="font-mono text-xs">{formatDuration(toolCall.duration)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
