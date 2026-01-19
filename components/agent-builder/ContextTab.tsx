'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AgentConfig } from '@/lib/types/agent';
import { Database, Code, Info, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

// Example contexts
const EXAMPLE_CONTEXTS = {
  userPrefs: {
    label: 'User Preferences',
    static: {
      user: {
        name: 'John Doe',
        timezone: 'America/New_York',
        preferences: {
          codeStyle: 'prettier',
          testFramework: 'jest',
          language: 'TypeScript'
        }
      }
    }
  },
  projectMetadata: {
    label: 'Project Metadata',
    static: {
      project: {
        name: 'My App',
        version: '1.0.0',
        framework: 'Next.js',
        language: 'TypeScript',
        repository: 'https://github.com/user/repo'
      }
    }
  },
  dynamicFromFile: {
    label: 'Dynamic from package.json',
    dynamicLoader: `async function loadContext() {
  const pkg = await read("/project/package.json");
  const data = JSON.parse(pkg);
  return {
    dependencies: data.dependencies,
    devDependencies: data.devDependencies,
    scripts: data.scripts
  };
}`
  }
};

export function ContextTab({ config, onChange }: ContextTabProps) {
  const [staticContext, setStaticContext] = useState(
    config.context?.static
      ? JSON.stringify(config.context.static, null, 2)
      : ''
  );
  const [dynamicLoader, setDynamicLoader] = useState(
    config.context?.dynamicLoader || ''
  );
  const [staticError, setStaticError] = useState<string | null>(null);
  const [copiedStatic, setCopiedStatic] = useState(false);
  const [copiedDynamic, setCopiedDynamic] = useState(false);

  const hasStatic = !!staticContext.trim();
  const hasDynamic = !!dynamicLoader.trim();

  const handleStaticChange = (value: string) => {
    setStaticContext(value);
    setStaticError(null);

    if (!value.trim()) {
      const { static: _, ...rest } = config.context || {};
      onChange({
        context: Object.keys(rest).length > 0 ? rest : undefined
      });
      return;
    }

    try {
      const parsed = JSON.parse(value);
      onChange({
        context: {
          ...config.context,
          static: parsed
        }
      });
    } catch (err: any) {
      setStaticError(err.message);
    }
  };

  const handleDynamicChange = (value: string) => {
    setDynamicLoader(value);

    if (!value.trim()) {
      const { dynamicLoader: _, ...rest } = config.context || {};
      onChange({
        context: Object.keys(rest).length > 0 ? rest : undefined
      });
      return;
    }

    onChange({
      context: {
        ...config.context,
        dynamicLoader: value
      }
    });
  };

  const loadExample = (exampleKey: string) => {
    const example = EXAMPLE_CONTEXTS[exampleKey as keyof typeof EXAMPLE_CONTEXTS];
    if (!example) return;

    if ('static' in example) {
      const staticStr = JSON.stringify(example.static, null, 2);
      setStaticContext(staticStr);
      handleStaticChange(staticStr);
    }

    if ('dynamicLoader' in example) {
      setDynamicLoader(example.dynamicLoader);
      handleDynamicChange(example.dynamicLoader);
    }
  };

  const copyStatic = () => {
    navigator.clipboard.writeText(staticContext);
    setCopiedStatic(true);
    setTimeout(() => setCopiedStatic(false), 2000);
  };

  const copyDynamic = () => {
    navigator.clipboard.writeText(dynamicLoader);
    setCopiedDynamic(true);
    setTimeout(() => setCopiedDynamic(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Label>Context</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Inject static or dynamic data into your agent&apos;s context
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">
              What is Context?
            </h4>
            <p className="text-xs text-muted-foreground">
              Context allows you to provide additional data to your agent. Use static context
              for fixed data like user preferences, or dynamic context to load data at runtime
              from files or APIs.
            </p>
          </div>
        </div>
      </div>

      {/* Example Contexts */}
      <div>
        <Label className="mb-2 block">Example Contexts</Label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(EXAMPLE_CONTEXTS).map(([key, example]) => (
            <button
              key={key}
              type="button"
              onClick={() => loadExample(key)}
              className="p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
            >
              <div className="font-medium text-sm">{example.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Static Context */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-start gap-3 mb-3">
          <Database className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <Label className="mb-1 block">Static Context</Label>
            <p className="text-xs text-muted-foreground">
              Fixed data available to your agent (JSON format)
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={copyStatic}
              disabled={!hasStatic}
            >
              {copiedStatic ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>

          <textarea
            value={staticContext}
            onChange={(e) => handleStaticChange(e.target.value)}
            placeholder={`{\n  "user": {\n    "name": "John Doe",\n    "preferences": {\n      "theme": "dark"\n    }\n  }\n}`}
            className="w-full h-48 p-3 rounded-lg border border-border bg-muted/30 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            spellCheck={false}
          />

          {staticError && (
            <p className="text-xs text-destructive">
              Invalid JSON: {staticError}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            This data will be available in your agent&apos;s context object
          </p>
        </div>
      </div>

      {/* Dynamic Context Loader */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-start gap-3 mb-3">
          <Code className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <Label className="mb-1 block">Dynamic Context Loader</Label>
            <p className="text-xs text-muted-foreground">
              JavaScript function to load data at runtime
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={copyDynamic}
              disabled={!hasDynamic}
            >
              {copiedDynamic ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>

          <textarea
            value={dynamicLoader}
            onChange={(e) => handleDynamicChange(e.target.value)}
            placeholder={`async function loadContext() {\n  // Load data from files, APIs, etc.\n  const data = await fetch('https://api.example.com/config');\n  return await data.json();\n}`}
            className="w-full h-48 p-3 rounded-lg border border-border bg-muted/30 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            spellCheck={false}
          />

          <p className="text-xs text-muted-foreground">
            This function will be called when the agent starts. Return an object to add to context.
          </p>
        </div>
      </div>

      {/* How Context Works */}
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <h4 className="font-semibold text-sm mb-2">How Context Works</h4>
        <ul className="text-xs text-muted-foreground space-y-2">
          <li className="flex gap-2">
            <span>•</span>
            <span>
              <strong>Static Context</strong>: Fixed data that never changes. Good for user preferences,
              project metadata, configuration values, etc.
            </span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>
              <strong>Dynamic Context</strong>: Loaded at runtime when the agent starts. Good for
              reading files, fetching API data, checking environment variables, etc.
            </span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>
              <strong>Accessing Context</strong>: Your agent can access context data through the
              <code className="font-mono">context</code> object in tool handlers and hooks.
            </span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>
              <strong>Combining Both</strong>: Both static and dynamic context can be used together.
              Dynamic context is loaded first, then merged with static context.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
