'use client';

import {
  Settings,
  Moon,
  Sun,
  Monitor,
  HardDrive,
  Trash2,
  Download,
  Info,
  ExternalLink,
  Sparkles,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentStore } from '@/lib/stores/agentStore';
import { useChatStore } from '@/lib/stores/chatStore';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/providers/ThemeProvider';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { listAgents } = useAgentStore();
  const { listSessions, clearAllSessions } = useChatStore();
  const { toast } = useToast();

  const agents = listAgents();
  const sessions = listSessions();

  const handleClearSessions = () => {
    if (confirm('Are you sure you want to delete all chat sessions? This cannot be undone.')) {
      clearAllSessions();
      toast({
        variant: 'success',
        title: 'Sessions cleared',
        description: 'All chat sessions have been deleted.',
      });
    }
  };

  const handleExportData = () => {
    const data = {
      agents: agents,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claudesmith-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      variant: 'success',
      title: 'Data exported',
      description: 'Your agents have been exported successfully.',
    });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your preferences and data
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Appearance */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card/50">
            <label className="text-sm font-medium text-foreground mb-3 block">Theme</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'dark', label: 'Dark', icon: Moon, description: 'Deep charcoal' },
                { id: 'light', label: 'Light', icon: Sun, description: 'Warm ivory' },
                { id: 'system', label: 'System', icon: Monitor, description: 'Match OS' },
              ].map((option) => {
                const isActive = theme === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setTheme(option.id as typeof theme)}
                    className={cn(
                      'relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border transition-all',
                      isActive
                        ? 'border-primary bg-primary/10 text-foreground shadow-glow-sm'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border-strong hover:bg-card/80'
                    )}
                  >
                    {isActive && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                      isActive ? 'bg-primary/20' : 'bg-muted/50'
                    )}>
                      <option.icon className={cn('w-5 h-5', isActive && 'text-primary')} />
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-medium block">{option.label}</span>
                      <span className="text-[10px] text-muted-foreground">{option.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Storage */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Storage</h2>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card/50">
              <div className="text-3xl font-bold text-foreground">{agents.length}</div>
              <div className="text-sm text-muted-foreground">Agents</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card/50">
              <div className="text-3xl font-bold text-foreground">{sessions.length}</div>
              <div className="text-sm text-muted-foreground">Sessions</div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleExportData}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-xl border transition-all',
                'border-border bg-card text-foreground',
                'hover:border-border-strong hover:bg-card/80'
              )}
            >
              <Download className="w-5 h-5 text-muted-foreground" />
              <div className="text-left flex-1">
                <div className="font-medium">Export Data</div>
                <div className="text-xs text-muted-foreground">Download all agents as JSON</div>
              </div>
            </button>

            <button
              onClick={handleClearSessions}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-xl border transition-all',
                'border-border bg-card text-foreground',
                'hover:border-destructive/50 hover:bg-destructive/5'
              )}
            >
              <Trash2 className="w-5 h-5 text-destructive" />
              <div className="text-left flex-1">
                <div className="font-medium">Clear Sessions</div>
                <div className="text-xs text-muted-foreground">Delete all chat history</div>
              </div>
            </button>
          </div>
        </section>

        {/* About */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">About</h2>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card/50">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Claudesmith</h3>
                <p className="text-sm text-muted-foreground">Agent Studio</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Version</span>
                <span className="text-foreground font-mono">1.0.0</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">SDK Version</span>
                <span className="text-foreground font-mono">0.2.7+</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Framework</span>
                <span className="text-foreground font-mono">Next.js 14</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-3">
            <a
              href="https://docs.anthropic.com/en/docs/claude-agent-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                'border border-border bg-card text-foreground text-sm font-medium',
                'hover:border-border-strong hover:bg-card/80 transition-colors'
              )}
            >
              SDK Docs
              <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href="https://github.com/anthropics/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                'border border-border bg-card text-foreground text-sm font-medium',
                'hover:border-border-strong hover:bg-card/80 transition-colors'
              )}
            >
              GitHub
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
