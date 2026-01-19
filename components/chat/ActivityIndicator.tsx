'use client';

import { Bot, Loader2, BookOpen, Wrench, Search, ListChecks, CheckCircle, Brain, Users } from 'lucide-react';
import { getToolDisplayName, getToolIcon, getBashCommandDescription } from '@/lib/utils/toolDisplayNames';

export type ProgressPhase = 'gathering_context' | 'planning' | 'executing' | 'verifying' | 'completed';

export interface ProgressData {
  phase: ProgressPhase;
  completedTools: number;
  totalTools?: number;
  currentTool?: string;
  completedSteps?: number;
  pendingSteps?: number;
}

export interface Activity {
  type: 'thinking' | 'tool_start' | 'tool_running' | 'tool_complete' | 'searching' | 'fetching' | 'waiting_for_model' | 'subagent_running';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  description?: string;
  timestamp: string;
  elapsedSeconds?: number;
  lastToolName?: string;
  activeSubagents?: string[]; // Names of currently running subagents
}

interface ActivityIndicatorProps {
  agentName: string;
  activity: Activity;
  progressData?: ProgressData | null;
}

// Progress phase display info
const PHASE_INFO: Record<ProgressPhase, { label: string; icon: any; color: string }> = {
  gathering_context: { label: 'Gathering Context', icon: BookOpen, color: 'text-blue-500' },
  planning: { label: 'Planning', icon: ListChecks, color: 'text-amber-500' },
  executing: { label: 'Executing', icon: Wrench, color: 'text-primary' },
  verifying: { label: 'Verifying', icon: Search, color: 'text-purple-500' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
};

function getToolDescription(toolName: string, input?: Record<string, unknown>): string {
  switch (toolName) {
    case 'WebSearch':
      return `Searching: "${input?.query || '...'}"`;
    case 'WebFetch':
      const url = input?.url as string;
      if (url) {
        try {
          const hostname = new URL(url).hostname;
          return `Fetching: ${hostname}`;
        } catch {
          return `Fetching webpage...`;
        }
      }
      return 'Fetching webpage...';
    case 'Read':
      const filePath = input?.file_path as string;
      return filePath ? `Reading: ${filePath.split('/').pop()}` : 'Reading file...';
    case 'Write':
      const writePath = input?.file_path as string;
      return writePath ? `Writing: ${writePath.split('/').pop()}` : 'Writing file...';
    case 'Edit':
      const editPath = input?.file_path as string;
      return editPath ? `Editing: ${editPath.split('/').pop()}` : 'Editing file...';
    case 'Bash':
      const cmd = input?.command as string;
      return cmd ? getBashCommandDescription(cmd) : 'Running command...';
    case 'Grep':
      return `Searching code: "${input?.pattern || '...'}"`;
    case 'Glob':
      return `Finding files: ${input?.pattern || '...'}`;
    case 'TodoWrite':
      return 'Updating task list...';
    case 'AskUserQuestion':
      return 'Waiting for your response...';
    default:
      return `Running ${getToolDisplayName(toolName)}...`;
  }
}

export function ActivityIndicator({ agentName, activity, progressData }: ActivityIndicatorProps) {
  // Determine icon based on activity type
  const isSubagentRunning = activity.type === 'subagent_running' || (activity.activeSubagents && activity.activeSubagents.length > 0);
  const ToolIcon = isSubagentRunning
    ? Users
    : activity.type === 'waiting_for_model'
      ? Brain
      : activity.toolName
        ? getToolIcon(activity.toolName)
        : Bot;

  // Build description based on activity
  let description: string;
  if (isSubagentRunning && activity.activeSubagents && activity.activeSubagents.length > 0) {
    const subagentNames = activity.activeSubagents.join(', ');
    const elapsedStr = activity.elapsedSeconds ? ` (${activity.elapsedSeconds}s)` : '';
    description = `${subagentNames} working...${elapsedStr}`;
  } else if (activity.toolName) {
    description = getToolDescription(activity.toolName, activity.toolInput);
  } else {
    description = activity.description || 'Thinking...';
  }

  const isWaiting = activity.toolName === 'AskUserQuestion';
  const isAnalyzing = activity.type === 'waiting_for_model';

  // Get phase info if progress data is available
  const phaseInfo = progressData?.phase ? PHASE_INFO[progressData.phase] : null;
  const PhaseIcon = phaseInfo?.icon || null;

  return (
    <div className="flex gap-4">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <Bot className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1">
        {/* Name and Progress Badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-foreground">{agentName}</span>
          {phaseInfo && (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted ${phaseInfo.color}`}>
              <PhaseIcon className="w-3 h-3" />
              {phaseInfo.label}
              {progressData?.completedTools ? ` (${progressData.completedTools} tools)` : ''}
            </span>
          )}
        </div>

        {/* Activity Animation */}
        <div className={`inline-flex items-center gap-3 rounded-lg px-4 py-2.5 border ${
          isWaiting
            ? 'bg-warning/10 border-warning/30'
            : isSubagentRunning
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : isAnalyzing
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-muted/50 border-border/50'
        }`}>
          {/* Tool/Activity Icon */}
          <div className="relative flex items-center justify-center w-5 h-5">
            {!isWaiting && (
              <span className={`absolute w-full h-full rounded-full ${
                isSubagentRunning ? 'bg-emerald-500/20' : isAnalyzing ? 'bg-amber-500/20' : 'bg-primary/20'
              } animate-ping`} />
            )}
            <ToolIcon className={`relative w-4 h-4 ${
              isWaiting ? 'text-warning' : isSubagentRunning ? 'text-emerald-500' : isAnalyzing ? 'text-amber-500' : 'text-primary'
            } ${!isWaiting ? 'animate-pulse' : ''}`} />
          </div>

          {/* Activity description */}
          <span className={`text-sm font-mono ${
            isWaiting ? 'text-warning' : isSubagentRunning ? 'text-emerald-500' : isAnalyzing ? 'text-amber-500' : 'text-muted-foreground'
          }`}>
            {description}
          </span>

          {/* Animated dots (only if not waiting for user) */}
          {!isWaiting && (
            <div className="flex gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${
                isSubagentRunning ? 'bg-emerald-500' : isAnalyzing ? 'bg-amber-500' : 'bg-primary'
              } animate-bounce [animation-delay:0ms]`} />
              <span className={`w-1.5 h-1.5 rounded-full ${
                isSubagentRunning ? 'bg-emerald-500' : isAnalyzing ? 'bg-amber-500' : 'bg-primary'
              } animate-bounce [animation-delay:150ms]`} />
              <span className={`w-1.5 h-1.5 rounded-full ${
                isSubagentRunning ? 'bg-emerald-500' : isAnalyzing ? 'bg-amber-500' : 'bg-primary'
              } animate-bounce [animation-delay:300ms]`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
