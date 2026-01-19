'use client';

import { ExecutionNode } from '@/lib/types/execution';
import {
  Clock,
  MessageSquare,
  Zap,
  Bot,
  Coins,
  Activity,
} from 'lucide-react';
import { formatDuration } from '@/lib/services/executionTracker';

interface ExecutionStatsProps {
  execution: ExecutionNode;
}

export function ExecutionStats({ execution }: ExecutionStatsProps) {
  const metrics = execution.metrics;

  // Clean color scheme without blue/purple
  const stats = [
    {
      label: 'Duration',
      value: execution.duration ? formatDuration(execution.duration) : 'Running...',
      icon: Clock,
      color: 'text-foreground bg-muted',
    },
    {
      label: 'Total Turns',
      value: metrics?.totalTurns || 0,
      icon: MessageSquare,
      color: 'text-foreground bg-muted',
    },
    {
      label: 'Tool Calls',
      value: metrics?.toolCallCount || execution.toolCalls.length,
      icon: Zap,
      color: 'text-warning bg-warning/10',
    },
    {
      label: 'Subagents',
      value: metrics?.subagentCount || execution.subagents.length,
      icon: Bot,
      color: 'text-success bg-success/10',
    },
  ];

  if (metrics?.totalTokens) {
    stats.push({
      label: 'Total Tokens',
      value: metrics.totalTokens.toLocaleString(),
      icon: Activity,
      color: 'text-warning bg-warning/10',
    });
  }

  if (metrics?.costUsd) {
    stats.push({
      label: 'Estimated Cost',
      value: `$${metrics.costUsd.toFixed(4)}`,
      icon: Coins,
      color: 'text-primary bg-primary/10',
    });
  }

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={`p-4 rounded-lg border ${
        execution.status === 'completed' ? 'bg-success/10 border-success/20' :
        execution.status === 'failed' ? 'bg-destructive/10 border-destructive/20' :
        execution.status === 'interrupted' ? 'bg-muted border-border' :
        'bg-primary/10 border-primary/20'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Execution Status
            </div>
            <div className={`text-lg font-semibold capitalize ${
              execution.status === 'completed' ? 'text-success' :
              execution.status === 'failed' ? 'text-destructive' :
              execution.status === 'interrupted' ? 'text-muted-foreground' :
              'text-primary'
            }`}>
              {execution.status.replace('_', ' ')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-muted-foreground">
              Agent
            </div>
            <div className="text-lg font-semibold text-foreground">
              {execution.agentName}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground truncate">
                    {stat.label}
                  </div>
                  <div className="text-lg font-semibold truncate font-mono">
                    {stat.value}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Token Breakdown (if available) */}
      {metrics && (metrics.inputTokens || metrics.outputTokens) && (
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
            Token Usage Breakdown
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Input Tokens</div>
              <div className="text-lg font-semibold font-mono">
                {metrics.inputTokens?.toLocaleString() || 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Output Tokens</div>
              <div className="text-lg font-semibold font-mono">
                {metrics.outputTokens?.toLocaleString() || 0}
              </div>
            </div>
          </div>
          {metrics.totalTokens > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Efficiency Ratio</span>
                <span className="font-medium font-mono">
                  {metrics.inputTokens && metrics.outputTokens
                    ? (metrics.outputTokens / metrics.inputTokens).toFixed(2)
                    : 'N/A'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Time Information */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Timeline
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Started:</span>
            <span className="font-mono">
              {new Date(execution.startTime).toLocaleString()}
            </span>
          </div>
          {execution.endTime && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ended:</span>
              <span className="font-mono">
                {new Date(execution.endTime).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
