'use client';

import { useState } from 'react';
import { ExecutionNode } from '@/lib/types/execution';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Circle,
  Clock,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { formatDuration } from '@/lib/services/executionTracker';

interface SubagentExecutionTreeProps {
  node: ExecutionNode;
  level?: number;
}

const statusIcons = {
  initializing: Circle,
  running: Circle,
  waiting_for_user: Clock,
  waiting_for_permission: Clock,
  completed: CheckCircle2,
  failed: XCircle,
  interrupted: XCircle,
};

// Clean, minimal color scheme without blue/purple
const statusColors = {
  initializing: 'text-muted-foreground bg-muted',
  running: 'text-primary bg-primary/10',
  waiting_for_user: 'text-warning bg-warning/10',
  waiting_for_permission: 'text-warning bg-warning/10',
  completed: 'text-success bg-success/10',
  failed: 'text-destructive bg-destructive/10',
  interrupted: 'text-muted-foreground bg-muted',
};

export function SubagentExecutionTree({ node, level = 0 }: SubagentExecutionTreeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels

  const StatusIcon = statusIcons[node.status];
  const statusColor = statusColors[node.status];
  const hasSubagents = node.subagents && node.subagents.length > 0;

  return (
    <div className={level > 0 ? 'ml-6 border-l border-border pl-4' : ''}>
      {/* Node header */}
      <div className="mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
        >
          {/* Expand/Collapse */}
          {hasSubagents && (
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          )}

          {/* Agent Icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${statusColor} flex items-center justify-center`}>
            <Bot className="w-5 h-5" />
          </div>

          {/* Agent Info */}
          <div className="flex-1 text-left">
            <div className="font-medium text-sm text-foreground">
              {node.agentName}
              {level > 0 && <span className="text-muted-foreground ml-2">({node.agentType})</span>}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <StatusIcon className={`w-3 h-3 ${
                node.status === 'running' || node.status === 'initializing' ? 'animate-pulse' : ''
              }`} />
              <span className="capitalize">{node.status.replace('_', ' ')}</span>
              {node.duration && (
                <>
                  <span>•</span>
                  <Clock className="w-3 h-3" />
                  <span className="font-mono">{formatDuration(node.duration)}</span>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex-shrink-0 flex items-center gap-4 text-xs">
            {node.messages.length > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                <span className="font-mono">{node.messages.length}</span>
              </div>
            )}
            {node.toolCalls.length > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span className="font-mono">{node.toolCalls.length}</span>
              </div>
            )}
            {hasSubagents && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Bot className="w-3 h-3" />
                <span className="font-mono">{node.subagents.length}</span>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="space-y-3 mb-4">
          {/* Messages */}
          {node.messages.length > 0 && (
            <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Messages ({node.messages.length})
              </div>
              <div className="space-y-2">
                {node.messages.map((message) => (
                  <div
                    key={message.uuid}
                    className="text-sm bg-background rounded-md p-2 border border-border/50"
                  >
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      {message.type === 'user' ? 'User' : 'Assistant'}
                    </div>
                    <div className="text-xs line-clamp-3 text-foreground">
                      {typeof message.content === 'string'
                        ? message.content
                        : JSON.stringify(message.content)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tool Calls */}
          {node.toolCalls.length > 0 && (
            <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Tool Calls ({node.toolCalls.length})
              </div>
              <div className="space-y-2">
                {node.toolCalls.map((toolCall) => (
                  <div
                    key={toolCall.id}
                    className="text-sm bg-background rounded-md p-2 border border-border/50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs text-foreground">{toolCall.name}</span>
                      <span className={`text-xs capitalize font-mono ${
                        toolCall.status === 'completed' ? 'text-success' :
                        toolCall.status === 'failed' ? 'text-destructive' :
                        'text-muted-foreground'
                      }`}>
                        {toolCall.status}
                      </span>
                    </div>
                    {toolCall.duration && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {formatDuration(toolCall.duration)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subagents (recursive) */}
          {hasSubagents && (
            <div className="space-y-2">
              {node.subagents.map((subagent) => (
                <SubagentExecutionTree
                  key={subagent.id}
                  node={subagent}
                  level={level + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
