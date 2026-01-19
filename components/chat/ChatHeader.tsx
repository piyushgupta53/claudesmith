'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgentConfig } from '@/lib/types/agent';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Square,
  Zap,
  Settings,
  Activity,
  FolderOpen,
  History,
  Sparkles,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  sessionId: string;
  agent: AgentConfig;
  isStreaming: boolean;
  currentModel?: 'sonnet' | 'opus' | 'haiku';
  onModelChange?: (model: 'sonnet' | 'opus' | 'haiku') => void;
  onInterrupt?: () => void;
  showPanel?: boolean;
  onTogglePanel?: () => void;
  activePanel?: 'activity' | 'files' | 'checkpoints';
  onPanelChange?: (panel: 'activity' | 'files' | 'checkpoints') => void;
  activityCount?: number;
  checkpointCount?: number;
}

export function ChatHeader({
  sessionId,
  agent,
  isStreaming,
  currentModel,
  onModelChange,
  onInterrupt,
  showPanel,
  onTogglePanel,
  activePanel,
  onPanelChange,
  activityCount = 0,
  checkpointCount = 0,
}: ChatHeaderProps) {
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<string>(currentModel || agent.model || 'sonnet');

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    if (onModelChange) {
      onModelChange(value as 'sonnet' | 'opus' | 'haiku');
    }
  };

  return (
    <div className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-10">
      <div className="flex items-center gap-4 px-4 sm:px-6 py-3">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push(`/agents/${agent.id}`)}
          title="Back to agent"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {/* Agent Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border"
            style={{
              backgroundColor: `${agent.ui.color}15`,
              borderColor: `${agent.ui.color}30`,
            }}
          >
            <Sparkles className="w-4 h-4" style={{ color: agent.ui.color }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">{agent.name}</h1>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">{agent.description}</p>
          </div>
        </div>

        {/* Model Switcher */}
        {onModelChange && (
          <div className="hidden sm:flex items-center">
            <Select value={selectedModel} onValueChange={handleModelChange} disabled={isStreaming}>
              <SelectTrigger className="h-8 w-[140px] text-xs border-border/50 bg-card/50 hover:bg-card">
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-primary" />
                  <SelectValue placeholder="Model" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sonnet">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-xs">Sonnet 4.5</span>
                  </div>
                </SelectItem>
                <SelectItem value="opus">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-xs">Opus 4.5</span>
                  </div>
                </SelectItem>
                <SelectItem value="haiku">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning" />
                    <span className="text-xs">Haiku 4</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-border hidden sm:block" />

        {/* Panel Toggle Buttons */}
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
          <button
            onClick={() => {
              if (onPanelChange) onPanelChange('activity');
              if (onTogglePanel && (!showPanel || activePanel !== 'activity')) onTogglePanel();
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
              showPanel && activePanel === 'activity'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Activity</span>
            {activityCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full min-w-[18px] text-center font-semibold">
                {activityCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              if (onPanelChange) onPanelChange('files');
              if (onTogglePanel && (!showPanel || activePanel !== 'files')) onTogglePanel();
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
              showPanel && activePanel === 'files'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Files</span>
          </button>
          {agent.settings?.enableFileCheckpointing && (
            <button
              onClick={() => {
                if (onPanelChange) onPanelChange('checkpoints');
                if (onTogglePanel && (!showPanel || activePanel !== 'checkpoints')) onTogglePanel();
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                showPanel && activePanel === 'checkpoints'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">History</span>
              {checkpointCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded-full min-w-[18px] text-center">
                  {checkpointCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Interrupt Button */}
        {isStreaming && onInterrupt && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onInterrupt}
            className="gap-1.5 text-xs"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Stop</span>
          </Button>
        )}

        {/* Settings Button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push(`/agents/${agent.id}/edit`)}
          title="Agent settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
