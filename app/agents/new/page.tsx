'use client';

import { useState } from 'react';
import { AgentBuilderForm } from '@/components/agent-builder/AgentBuilderForm';
import { InstantMode } from '@/components/agent-builder/InstantMode';
import { ArrowLeft, Sparkles, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AgentConfig } from '@/lib/types/agent';

type Mode = 'instant' | 'advanced';

export default function NewAgentPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('instant');
  const [prefilledConfig, setPrefilledConfig] = useState<Partial<AgentConfig> | null>(null);

  const handleConfigGenerated = (config: Partial<AgentConfig>) => {
    setPrefilledConfig(config);
  };

  const handleEditConfig = (config: Partial<AgentConfig>) => {
    setPrefilledConfig(config);
    setMode('advanced');
  };

  // Advanced mode - AgentBuilderForm handles its own header with mode toggle
  if (mode === 'advanced') {
    return (
      <div className="h-screen overflow-hidden">
        <AgentBuilderForm
          mode="create"
          initialConfig={prefilledConfig || undefined}
          builderMode={mode}
          onBuilderModeChange={setMode}
        />
      </div>
    );
  }

  // Instant mode uses centered layout
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Create New Agent</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Describe what you want, and AI will generate your agent
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg mb-8 w-fit">
          <button
            onClick={() => setMode('instant')}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all bg-background shadow-sm text-foreground"
          >
            <Sparkles className="w-4 h-4" />
            Instant Mode
          </button>
          <button
            onClick={() => setMode('advanced')}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4" />
            Advanced Mode
          </button>
        </div>

        {/* Instant Mode Content */}
        <InstantMode
          onConfigGenerated={handleConfigGenerated}
          onEditConfig={handleEditConfig}
        />
      </div>
    </div>
  );
}
