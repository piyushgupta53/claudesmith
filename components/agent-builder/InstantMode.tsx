'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { EXAMPLE_PROMPTS } from '@/lib/constants/examplePrompts';
import { AgentConfig } from '@/lib/types/agent';
import { ConfigPreview } from './ConfigPreview';
import { useAgentStore } from '@/lib/stores/agentStore';
import { storageService } from '@/lib/services/storageService';
import { useToast } from '@/components/ui/use-toast';

interface InstantModeProps {
  onConfigGenerated: (config: Partial<AgentConfig>) => void;
  onEditConfig: (config: Partial<AgentConfig>) => void;
}

export function InstantMode({ onConfigGenerated, onEditConfig }: InstantModeProps) {
  const router = useRouter();
  const { createAgent } = useAgentStore();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedConfig, setGeneratedConfig] = useState<Partial<AgentConfig> | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe what you want your agent to do');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedConfig(null);

    try {
      const response = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to generate agent');
      }

      if (!data.success || !data.config) {
        throw new Error('Invalid response from server');
      }

      setGeneratedConfig(data.config);
      onConfigGenerated(data.config);
    } catch (err: any) {
      console.error('Agent generation error:', err);
      setError(err.message || 'Failed to generate agent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadExample = (examplePrompt: string) => {
    setPrompt(examplePrompt);
    setShowExamples(false);
    setError(null);
    setGeneratedConfig(null);
  };

  const handleEditConfig = () => {
    if (generatedConfig) {
      onEditConfig(generatedConfig);
    }
  };

  const handleApproveConfig = async () => {
    if (!generatedConfig) return;

    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const newAgent: AgentConfig = {
        ...(generatedConfig as Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>),
        id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
        subagents: generatedConfig.subagents || {},
        settings: generatedConfig.settings || {
          maxTurns: 50,
          maxBudgetUsd: 1.0,
          permissionMode: 'default',
          enableFileCheckpointing: false,
        },
      } as AgentConfig;

      createAgent(newAgent);
      await storageService.saveAgent(newAgent);

      toast({
        variant: 'success',
        title: 'Agent created',
        description: `"${newAgent.name}" has been created successfully.`,
      });

      router.push(`/agents/${newAgent.id}`);
    } catch (err: any) {
      console.error('Failed to save agent:', err);
      setError('Failed to save agent. Please try again.');
      setSaving(false);
    }
  };

  if (generatedConfig) {
    return (
      <div className="space-y-6">
        {/* Success Header */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold text-sm">Agent Generated Successfully!</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review the configuration below and create your agent or edit the details.
              </p>
            </div>
          </div>
        </div>

        {/* Config Preview */}
        {saving ? (
          <div className="border border-border rounded-lg bg-card p-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
            <h3 className="font-semibold mb-2">Creating Agent...</h3>
            <p className="text-sm text-muted-foreground">
              Setting up your agent with the selected configuration.
            </p>
          </div>
        ) : (
          <ConfigPreview
            config={generatedConfig}
            onEdit={handleEditConfig}
            onApprove={handleApproveConfig}
          />
        )}

        {/* Generate Another */}
        <Button
          variant="outline"
          onClick={() => {
            setGeneratedConfig(null);
            setPrompt('');
            setError(null);
          }}
          className="w-full"
        >
          Generate Another Agent
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Describe Your Agent
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tell me what you want your agent to do, and I&apos;ll generate a complete configuration for you.
        </p>
      </div>

      {/* Example Prompts */}
      <div className="border border-border rounded-lg bg-card">
        <button
          onClick={() => setShowExamples(!showExamples)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors rounded-lg"
        >
          <div>
            <div className="font-medium text-sm">Example Agents</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Choose from pre-written examples to get started quickly
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              showExamples ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showExamples && (
          <div className="border-t border-border p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {EXAMPLE_PROMPTS.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleLoadExample(example.prompt)}
                  className="text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="font-medium text-sm">{example.label}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {example.prompt.substring(0, 100)}...
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Prompt Input */}
      <div>
        <Textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setError(null);
          }}
          placeholder="Example: Create an agent that analyzes my TypeScript code for security vulnerabilities and performance issues. It should check for common mistakes and suggest improvements."
          rows={6}
          className="resize-none"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Be specific about what your agent should do, what tools it needs, and how it should behave.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-destructive mb-1">
                Generation Failed
              </h4>
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating Agent...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Agent
          </>
        )}
      </Button>

      {/* How It Works */}
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <h4 className="font-semibold text-sm mb-2">How It Works</h4>
        <ul className="text-xs text-muted-foreground space-y-2">
          <li className="flex gap-2">
            <span>1.</span>
            <span>
              <strong>Describe your agent</strong>: Tell me what tasks you want it to perform,
              what data it should work with, and how it should behave.
            </span>
          </li>
          <li className="flex gap-2">
            <span>2.</span>
            <span>
              <strong>AI generates configuration</strong>: I&apos;ll analyze your description and
              create a complete agent configuration with tools, skills, and instructions.
            </span>
          </li>
          <li className="flex gap-2">
            <span>3.</span>
            <span>
              <strong>Review and customize</strong>: Preview the generated configuration and
              either create it as-is or edit the details in advanced mode.
            </span>
          </li>
          <li className="flex gap-2">
            <span>4.</span>
            <span>
              <strong>Start using your agent</strong>: Once created, your agent is ready to
              use with all the capabilities you requested.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
