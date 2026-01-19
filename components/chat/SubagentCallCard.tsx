'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Circle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SubagentCallCardProps {
  subagentInfo: {
    type: string;
    description: string;
    status: 'running' | 'completed' | 'failed';
    timestamp: string;
    sessionId?: string;
    error?: string;
  };
}

const statusIcons = {
  running: Circle,
  completed: CheckCircle2,
  failed: XCircle,
};

// Clean color scheme without blue/purple
const statusColors = {
  running: 'text-primary',
  completed: 'text-success',
  failed: 'text-destructive',
};

const statusBgColors = {
  running: 'bg-primary/10',
  completed: 'bg-success/10',
  failed: 'bg-destructive/10',
};

export function SubagentCallCard({ subagentInfo }: SubagentCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  const StatusIcon = statusIcons[subagentInfo.status];
  const statusColor = statusColors[subagentInfo.status];
  const statusBgColor = statusBgColors[subagentInfo.status];

  return (
    <div className={`border border-border rounded-lg overflow-hidden ${statusBgColor}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
      >
        {/* Expand/Collapse Icon */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

        {/* Subagent Icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${statusBgColor} flex items-center justify-center`}>
          <Bot className={`w-4 h-4 ${statusColor}`} />
        </div>

        {/* Subagent Info */}
        <div className="flex-1 text-left">
          <div className="font-medium text-sm text-foreground">
            Subagent: {subagentInfo.type}
          </div>
          <div className="text-xs text-muted-foreground">
            {subagentInfo.description}
          </div>
        </div>

        {/* Status Icon */}
        <div className="flex-shrink-0">
          <StatusIcon className={`w-5 h-5 ${statusColor} ${
            subagentInfo.status === 'running' ? 'animate-pulse' : ''
          }`} />
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-3 space-y-3 bg-card">
          {/* Status */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Status
            </div>
            <div className={`text-sm font-medium ${statusColor} capitalize`}>
              {subagentInfo.status}
            </div>
          </div>

          {/* Timestamp */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Started
            </div>
            <div className="text-sm font-mono">
              {new Date(subagentInfo.timestamp).toLocaleString()}
            </div>
          </div>

          {/* Error */}
          {subagentInfo.error && (
            <div>
              <div className="text-xs font-medium text-destructive mb-1.5 uppercase tracking-wide">
                Error
              </div>
              <div className="bg-destructive/5 border border-destructive/20 rounded-md p-2 text-xs text-destructive">
                {subagentInfo.error}
              </div>
            </div>
          )}

          {/* View Execution Button */}
          {subagentInfo.sessionId && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/executions/${subagentInfo.sessionId}`);
              }}
              className="w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Execution Details
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
