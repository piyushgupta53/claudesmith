'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AgentConfig } from '@/lib/types/agent';
import { AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AVAILABLE_TOOLS } from '@/lib/types/agent';

interface ErrorHandlingTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

export function ErrorHandlingTab({ config, onChange }: ErrorHandlingTabProps) {
  const errorHandling = config.errorHandling || {};
  const {
    retryOnFailure = false,
    maxRetries = 3,
    retryDelay = 1000,
    fallbackModel,
    fallbackTools = [],
  } = errorHandling;

  const updateErrorHandling = (updates: Partial<AgentConfig['errorHandling']>) => {
    onChange({
      errorHandling: {
        ...errorHandling,
        ...updates,
      },
    });
  };

  const toggleRetry = () => {
    updateErrorHandling({ retryOnFailure: !retryOnFailure });
  };

  const toggleFallbackTool = (tool: string) => {
    const isEnabled = fallbackTools.includes(tool);
    if (isEnabled) {
      updateErrorHandling({
        fallbackTools: fallbackTools.filter(t => t !== tool),
      });
    } else {
      updateErrorHandling({
        fallbackTools: [...fallbackTools, tool],
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Label>Error Handling</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how your agent handles errors and failures during execution
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">
              Error Handling Strategies
            </h4>
            <p className="text-xs text-muted-foreground">
              Configure retry logic to handle transient failures like network errors or rate limits.
              Set fallback options to gracefully degrade when primary tools or models fail.
            </p>
          </div>
        </div>
      </div>

      {/* Retry on Failure */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-start gap-3">
          <RefreshCw className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <Label>Retry on Failure</Label>
              <button
                type="button"
                onClick={toggleRetry}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  retryOnFailure ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    retryOnFailure ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Automatically retry failed operations like API calls, tool executions, or model requests
            </p>

            {retryOnFailure && (
              <div className="space-y-3 pt-3 border-t border-border">
                {/* Max Retries */}
                <div>
                  <Label className="text-xs">Max Retries</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={maxRetries}
                    onChange={(e) => updateErrorHandling({
                      maxRetries: parseInt(e.target.value) || 3
                    })}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum number of retry attempts (1-10)
                  </p>
                </div>

                {/* Retry Delay */}
                <div>
                  <Label className="text-xs">Retry Delay (ms)</Label>
                  <Input
                    type="number"
                    min={100}
                    max={10000}
                    step={100}
                    value={retryDelay}
                    onChange={(e) => updateErrorHandling({
                      retryDelay: parseInt(e.target.value) || 1000
                    })}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Delay between retry attempts in milliseconds (100-10000)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fallback Model */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <Label className="mb-2 block">Fallback Model</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Switch to this model if the primary model fails or is unavailable
            </p>

            <div className="grid grid-cols-3 gap-2">
              {['sonnet', 'haiku', 'opus'].map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => updateErrorHandling({
                    fallbackModel: fallbackModel === model ? undefined : model as any
                  })}
                  className={cn(
                    'p-3 rounded-lg border-2 text-sm font-medium transition-all',
                    fallbackModel === model
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent'
                  )}
                >
                  {model === 'sonnet' && 'Sonnet'}
                  {model === 'haiku' && 'Haiku'}
                  {model === 'opus' && 'Opus'}
                </button>
              ))}
            </div>

            {!fallbackModel && (
              <p className="text-xs text-muted-foreground mt-2">
                No fallback model selected. Agent will fail if primary model is unavailable.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Fallback Tools */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <Label className="mb-2 block">Fallback Tools</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Use these tools if MCP or custom tools fail. Useful for graceful degradation.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_TOOLS.filter(tool =>
                // Only show tools that could be fallbacks
                ['Read', 'Write', 'Bash', 'Grep', 'Glob', 'WebSearch', 'WebFetch'].includes(tool)
              ).map((tool) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => toggleFallbackTool(tool)}
                  className={cn(
                    'p-2 rounded-lg border-2 text-xs font-medium transition-all text-left',
                    fallbackTools.includes(tool)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent'
                  )}
                >
                  {tool}
                </button>
              ))}
            </div>

            {fallbackTools.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No fallback tools selected. Agent will fail if tools are unavailable.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <h4 className="font-semibold text-sm mb-2">How Error Handling Works</h4>
        <ul className="text-xs text-muted-foreground space-y-2">
          <li className="flex gap-2">
            <span>•</span>
            <span>
              <strong>Retry on Failure</strong>: When enabled, failed operations will be retried
              automatically with exponential backoff. Useful for handling rate limits and transient network errors.
            </span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>
              <strong>Fallback Model</strong>: If the primary model (configured in Basic tab) fails,
              the agent will automatically switch to the fallback model for subsequent requests.
            </span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>
              <strong>Fallback Tools</strong>: If MCP or custom tools fail, the agent can use these
              built-in tools instead. For example, if a database MCP tool fails, fallback to Read/Write tools.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
