'use client';

import { ExecutionEvent } from '@/lib/types/execution';
import {
  User,
  Bot,
  Brain,
  Play,
  CheckCircle2,
  XCircle,
  Zap,
  FileSearch,
  AlertCircle,
} from 'lucide-react';

interface TimelineEventProps {
  event: ExecutionEvent;
  isLast?: boolean;
}

const eventIcons = {
  session_start: Play,
  user_prompt: User,
  assistant_thinking: Brain,
  tool_call_start: Zap,
  tool_call_end: CheckCircle2,
  subagent_start: Bot,
  subagent_end: CheckCircle2,
  permission_request: AlertCircle,
  permission_response: CheckCircle2,
  session_end: CheckCircle2,
  error: XCircle,
};

// Clean, minimal color scheme without blue/purple
const eventColors = {
  session_start: 'text-foreground bg-muted',
  user_prompt: 'text-primary bg-primary/10',
  assistant_thinking: 'text-foreground bg-muted',
  tool_call_start: 'text-warning bg-warning/10',
  tool_call_end: 'text-success bg-success/10',
  subagent_start: 'text-foreground bg-muted',
  subagent_end: 'text-success bg-success/10',
  permission_request: 'text-warning bg-warning/10',
  permission_response: 'text-success bg-success/10',
  session_end: 'text-success bg-success/10',
  error: 'text-destructive bg-destructive/10',
};

const eventLabels = {
  session_start: 'Session Started',
  user_prompt: 'User Message',
  assistant_thinking: 'Assistant Response',
  tool_call_start: 'Tool Call Started',
  tool_call_end: 'Tool Call Completed',
  subagent_start: 'Subagent Started',
  subagent_end: 'Subagent Completed',
  permission_request: 'Permission Requested',
  permission_response: 'Permission Response',
  session_end: 'Session Ended',
  error: 'Error',
};

export function TimelineEvent({ event, isLast = false }: TimelineEventProps) {
  const Icon = eventIcons[event.type] || FileSearch;
  const colorClass = eventColors[event.type] || 'text-muted-foreground bg-muted';
  const label = eventLabels[event.type] || event.type;

  const renderEventContent = () => {
    switch (event.type) {
      case 'user_prompt':
        return (
          <div className="text-sm">
            <p className="font-medium text-foreground">User:</p>
            <p className="text-muted-foreground mt-1 line-clamp-2">
              {typeof event.data.content === 'string'
                ? event.data.content
                : JSON.stringify(event.data.content)}
            </p>
          </div>
        );

      case 'assistant_thinking':
        return (
          <div className="text-sm">
            <p className="font-medium text-foreground">Assistant:</p>
            <p className="text-muted-foreground mt-1 line-clamp-2 font-mono text-xs">
              {typeof event.data.content === 'string'
                ? event.data.content
                : 'Processing...'}
            </p>
          </div>
        );

      case 'tool_call_start':
        return (
          <div className="text-sm">
            <p className="font-medium text-foreground">Tool: {event.data.name}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Status: {event.data.status}
            </p>
          </div>
        );

      case 'tool_call_end':
        return (
          <div className="text-sm">
            <p className="font-medium text-foreground">Tool: {event.data.name}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {event.data.status === 'completed' ? 'Completed' : 'Failed'}
              {event.data.duration && ` • ${event.data.duration}ms`}
            </p>
          </div>
        );

      case 'subagent_start':
        return (
          <div className="text-sm">
            <p className="font-medium text-foreground">Subagent: {event.data.agentType}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {event.data.agentName}
            </p>
          </div>
        );

      case 'subagent_end':
        return (
          <div className="text-sm">
            <p className="font-medium text-foreground">Subagent: {event.data.agentType}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {event.data.status}
              {event.data.duration && ` • ${event.data.duration}ms`}
            </p>
          </div>
        );

      case 'session_end':
        return (
          <div className="text-sm">
            <p className="font-medium text-foreground">Session Completed</p>
            {event.data.metrics && (
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5 font-mono">
                <p>Turns: {event.data.metrics.totalTurns}</p>
                <p>Tool Calls: {event.data.metrics.toolCallCount}</p>
                {event.data.metrics.subagentCount > 0 && (
                  <p>Subagents: {event.data.metrics.subagentCount}</p>
                )}
              </div>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="text-sm">
            <p className="font-medium text-destructive">Error</p>
            <p className="text-xs text-destructive mt-1 font-mono">
              {event.data.message || 'An error occurred'}
            </p>
          </div>
        );

      default:
        return (
          <div className="text-sm">
            <p className="font-medium text-foreground">{label}</p>
          </div>
        );
    }
  };

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-10 w-px h-full bg-border" />
      )}

      {/* Event icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClass} z-10`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Event content */}
      <div className="flex-1 pb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
          {renderEventContent()}
        </div>
      </div>
    </div>
  );
}
