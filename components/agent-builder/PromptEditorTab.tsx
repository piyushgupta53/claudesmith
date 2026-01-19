'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AgentConfig } from '@/lib/types/agent';
import { FileText, Code, Search, BarChart3, BookOpen, Bug, Sparkles, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';

interface PromptEditorTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

const PROMPT_TEMPLATES = [
  {
    id: 'code-reviewer',
    label: 'Code Reviewer',
    icon: Code,
    description: 'Reviews code for quality & bugs',
    prompt: `You are an expert code reviewer with deep knowledge of software engineering best practices.

Your responsibilities:
- Review code for bugs, security vulnerabilities, and performance issues
- Suggest improvements for readability and maintainability
- Ensure code follows established patterns and conventions
- Provide constructive feedback with clear explanations

When reviewing code:
1. First understand the context and purpose
2. Check for potential bugs and edge cases
3. Evaluate code structure and organization
4. Suggest specific improvements with examples`,
  },
  {
    id: 'research',
    label: 'Research Assistant',
    icon: Search,
    description: 'Finds and synthesizes information',
    prompt: `You are a meticulous research assistant skilled at finding and synthesizing information.

Your capabilities:
- Search the web for relevant, authoritative sources
- Analyze and cross-reference multiple sources
- Summarize findings in clear, structured formats
- Cite sources and highlight confidence levels

Research methodology:
1. Understand the research question thoroughly
2. Identify key search terms and concepts
3. Gather information from multiple sources
4. Synthesize findings and present conclusions`,
  },
  {
    id: 'data-analyst',
    label: 'Data Analyst',
    icon: BarChart3,
    description: 'Analyzes data and creates insights',
    prompt: `You are a skilled data analyst who transforms raw data into actionable insights.

Your expertise includes:
- Data exploration and cleaning
- Statistical analysis and visualization
- Pattern recognition and trend identification
- Creating clear, compelling data narratives

Analysis approach:
1. Understand the data structure and context
2. Clean and validate the data
3. Perform exploratory analysis
4. Generate visualizations and insights`,
  },
  {
    id: 'documentation',
    label: 'Documentation Writer',
    icon: BookOpen,
    description: 'Creates clear technical docs',
    prompt: `You are a technical documentation specialist who creates clear, user-friendly documentation.

Your skills include:
- Writing clear, concise technical content
- Organizing information logically
- Creating examples and tutorials
- Adapting content for different audiences

Documentation standards:
1. Start with a clear overview
2. Use consistent formatting and structure
3. Include practical examples
4. Anticipate common questions`,
  },
  {
    id: 'debugging',
    label: 'Debug Expert',
    icon: Bug,
    description: 'Diagnoses and fixes issues',
    prompt: `You are a debugging expert who systematically diagnoses and resolves software issues.

Your approach:
- Analyze error messages and stack traces
- Identify root causes through systematic investigation
- Propose and test potential fixes
- Document solutions for future reference

Debugging methodology:
1. Reproduce the issue consistently
2. Isolate the problem area
3. Form and test hypotheses
4. Implement and verify the fix`,
  },
];

export function PromptEditorTab({ config, onChange }: PromptEditorTabProps) {
  const [copied, setCopied] = useState(false);

  const loadTemplate = (template: typeof PROMPT_TEMPLATES[0]) => {
    onChange({ systemPrompt: template.prompt });
  };

  const copyPrompt = useCallback(async () => {
    if (config.systemPrompt) {
      await navigator.clipboard.writeText(config.systemPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [config.systemPrompt]);

  const charCount = config.systemPrompt?.length || 0;
  const wordCount = config.systemPrompt?.trim().split(/\s+/).filter(Boolean).length || 0;

  return (
    <div className="space-y-8">
      {/* Template Selector */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Quick Templates</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Start with a pre-built template and customize it
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROMPT_TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => loadTemplate(template)}
                className={cn(
                  'group flex items-start gap-3 p-4 rounded-xl border border-border bg-card',
                  'hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-left'
                )}
              >
                <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{template.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* System Prompt Editor */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="systemPrompt" className="text-sm font-medium">
              System Prompt <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Define your agent&apos;s behavior, personality, and capabilities
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyPrompt}
            disabled={!config.systemPrompt}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-success" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>

        <div className="relative">
          <Textarea
            id="systemPrompt"
            value={config.systemPrompt || ''}
            onChange={(e) => onChange({ systemPrompt: e.target.value })}
            placeholder="Enter the system prompt that defines your agent's behavior, expertise, and instructions..."
            rows={20}
            className="font-mono text-sm min-h-[400px] resize-y pb-12"
            required
          />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10px] text-muted-foreground/60 font-mono">
            <span>{wordCount} words</span>
            <span>{charCount.toLocaleString()} characters</span>
          </div>
        </div>
      </div>

      {/* Writing Tips */}
      <div className="p-4 rounded-xl border border-border bg-card/50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Writing Tips</h4>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
                <span>Be specific about the agent&apos;s role and expertise</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
                <span>Define how it should respond (tone, format, length)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
                <span>List the tools and capabilities it has access to</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
                <span>Set clear boundaries and constraints</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
