'use client';

import { useState, useEffect } from 'react';
import {
  Loader2, CheckCircle2, X, Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getToolDisplayName, getToolIcon, getBashCommandDescription } from '@/lib/utils/toolDisplayNames';

export interface ToolActivity {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed' | 'slow';
  startTime: string;
  endTime?: string;
  duration?: number;
  outputPreview?: string;
}

interface ExecutionStatusBarProps {
  activities: ToolActivity[];
  isStreaming: boolean;
  agentName: string;
}

function getToolDescription(toolName: string, input?: Record<string, unknown>): string {
  const displayName = getToolDisplayName(toolName);

  if (toolName.includes('Write') || toolName.includes('Edit')) {
    const filePath = input?.file_path as string;
    if (filePath) {
      const fileName = filePath.split('/').pop();
      return `Writing ${fileName}`;
    }
  }

  if (toolName.includes('Read')) {
    const filePath = input?.file_path as string;
    if (filePath) {
      const fileName = filePath.split('/').pop();
      return `Reading ${fileName}`;
    }
  }

  if (toolName.includes('Bash')) {
    const cmd = input?.command as string;
    if (cmd) {
      return getBashCommandDescription(cmd);
    }
  }

  if (toolName === 'TodoWrite') {
    return 'Updating tasks';
  }

  if (toolName === 'AskUserQuestion') {
    return 'Waiting for response';
  }

  if (toolName.includes('generate_tree')) {
    return 'Generating file tree';
  }

  if (toolName.includes('validate_structure')) {
    return 'Validating structure';
  }

  return displayName;
}

export function ExecutionStatusBar({ activities, isStreaming, agentName }: ExecutionStatusBarProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);

  // Get current running activity (running or slow)
  const runningActivity = activities.find(a => a.status === 'running' || a.status === 'slow');
  const recentCompleted = activities
    .filter(a => a.status === 'completed' || a.status === 'failed')
    .slice(-3)
    .reverse();

  // Get the last completed tool for context
  const lastCompletedTool = recentCompleted.length > 0 ? recentCompleted[0] : null;

  // Extract stable values for useEffect dependencies
  const runningActivityId = runningActivity?.id;
  const runningActivityStartTime = runningActivity?.startTime;
  const hasRunningActivity = !!runningActivity;

  // Update elapsed time for running activity
  useEffect(() => {
    if (!runningActivityStartTime) {
      setElapsedTime(0);
      return;
    }

    const startTime = new Date(runningActivityStartTime).getTime();
    const updateTimer = () => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [runningActivityId, runningActivityStartTime]);

  // Update thinking elapsed time when no tool is running but still streaming
  useEffect(() => {
    if (!isStreaming || hasRunningActivity) {
      setThinkingElapsed(0);
      return;
    }

    const startTime = Date.now();
    const updateTimer = () => {
      setThinkingElapsed(Math.floor((Date.now() - startTime) / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isStreaming, hasRunningActivity]);

  if (!isStreaming || activities.length === 0) {
    return null;
  }

  const ToolIcon = runningActivity ? getToolIcon(runningActivity.name) : Loader2;
  const totalCompleted = activities.filter(a => a.status === 'completed').length;
  const totalRunning = activities.filter(a => a.status === 'running' || a.status === 'slow').length;

  return (
    <div className="border border-border/60 rounded-xl bg-card/50 backdrop-blur-sm overflow-hidden animate-fade-in">
      {/* Main status bar */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Animated icon */}
          <div className="relative flex-shrink-0">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              runningActivity ? "bg-primary/10" : "bg-amber-500/10"
            )}>
              {runningActivity ? (
                <>
                  <span className="absolute inset-0 rounded-lg bg-primary/20 animate-ping" />
                  <ToolIcon className="relative w-5 h-5 text-primary" />
                </>
              ) : (
                <>
                  <span className="absolute inset-0 rounded-lg bg-amber-500/20 animate-ping" />
                  <Brain className="relative w-5 h-5 text-amber-500 animate-pulse" />
                </>
              )}
            </div>
          </div>

          {/* Status text */}
          <div className="flex-1 min-w-0">
            {runningActivity ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {getToolDescription(runningActivity.name, runningActivity.input)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {elapsedTime}s
                  </span>
                  {runningActivity.status === 'slow' && (
                    <span className="text-xs text-warning font-medium">(slow)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {getToolDisplayName(runningActivity.name)}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-amber-500">
                    {thinkingElapsed < 60 && lastCompletedTool
                      ? `Analyzing ${getToolDisplayName(lastCompletedTool.name)} results...`
                      : 'Thinking...'}
                  </span>
                  <span className="text-xs font-mono text-amber-500/70">
                    {thinkingElapsed}s
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {thinkingElapsed < 60 && lastCompletedTool
                    ? 'Processing model response'
                    : 'Generating response'}
                </div>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 text-xs">
            {totalCompleted > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-success/10 text-success">
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-medium">{totalCompleted}</span>
              </div>
            )}
            {totalRunning > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="font-medium">{totalRunning}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity mini-timeline */}
      {recentCompleted.length > 0 && (
        <div className="px-4 py-2 border-t border-border/40 bg-muted/30">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex-shrink-0">
              Recent
            </span>
            {recentCompleted.map((activity) => {
              const Icon = getToolIcon(activity.name);
              const isError = activity.status === 'failed';
              return (
                <div
                  key={activity.id}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs flex-shrink-0",
                    isError ? "bg-destructive/10" : "bg-background/60"
                  )}
                >
                  <Icon className={cn("w-3 h-3", isError ? "text-destructive" : "text-muted-foreground")} />
                  <span className={cn("truncate max-w-[100px]", isError ? "text-destructive" : "text-muted-foreground")}>
                    {getToolDisplayName(activity.name)}
                  </span>
                  {activity.duration && (
                    <span className="text-muted-foreground/60 font-mono text-[10px]">
                      {activity.duration}ms
                    </span>
                  )}
                  {isError ? (
                    <X className="w-3 h-3 text-destructive" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-success" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
