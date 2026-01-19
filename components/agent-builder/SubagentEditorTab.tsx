'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { AgentConfig, SubagentConfig } from '@/lib/types/agent';
import { Plus, Edit, Trash2, Layers, Lightbulb, Copy, Check, Wand2, Wrench } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AVAILABLE_TOOLS } from '@/lib/types/agent';
import { ORCHESTRATOR_TEMPLATES, getOrchestratorSubagents } from '@/lib/utils/loadTemplates';

// Template metadata for display
const ORCHESTRATOR_TEMPLATE_INFO: Record<string, { label: string; description: string; workers: string[]; workflowHint: string }> = {
  'orchestrator-code-review': {
    label: 'Code Review Pattern',
    description: 'TestWriter, Implementer, and Reviewer for TDD workflows',
    workers: ['TestWriter', 'Implementer', 'Reviewer'],
    workflowHint: 'For new features: TestWriter -> Implementer -> Reviewer\nFor bug fixes: Reviewer -> Implementer -> TestWriter',
  },
  'orchestrator-research': {
    label: 'Research Pattern',
    description: 'WebSearcher, SourceAnalyzer, and Synthesizer for research tasks',
    workers: ['WebSearcher', 'SourceAnalyzer', 'Synthesizer'],
    workflowHint: 'Break research into subtopics, run parallel searches, then synthesize findings',
  },
  'orchestrator-implementation': {
    label: 'Implementation Pattern',
    description: 'Planner, Backend, Frontend, and Tester for full-stack features',
    workers: ['Planner', 'Backend', 'Frontend', 'Tester'],
    workflowHint: 'Planner first, then Backend/Frontend in parallel, finally Tester',
  },
};

// Generate orchestrator prompt suggestion based on imported workers
function generateOrchestratorPrompt(templateId: string, subagents: Record<string, SubagentConfig>): string {
  const info = ORCHESTRATOR_TEMPLATE_INFO[templateId];
  const workerList = Object.entries(subagents)
    .map(([name, config]) => `- ${name}: ${config.description}`)
    .join('\n');

  return `You are an orchestrator agent that coordinates specialized workers to complete tasks.

## Your Role
- Analyze requests and break them into subtasks
- Delegate work to appropriate workers using the Task tool
- Synthesize worker outputs into cohesive responses
- Do NOT implement tasks yourself - always delegate

## Available Workers
${workerList}

## How to Delegate
Use the Task tool with the worker name as subagent_type:
\`\`\`
Task(subagent_type: "WorkerName", prompt: "specific task description")
\`\`\`

## Workflow
${info?.workflowHint || 'Coordinate workers based on task requirements.'}

## Important
- Only use read-only tools yourself (Read, Glob, Grep)
- All writing/execution must go through workers
- Run independent worker tasks in parallel when possible`;
}

interface SubagentEditorTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

export function SubagentEditorTab({ config, onChange }: SubagentEditorTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [subagentName, setSubagentName] = useState('');
  const [subagentConfig, setSubagentConfig] = useState<SubagentConfig>({
    description: '',
    prompt: '',
    tools: [],
    model: 'inherit',
  });

  // Prompt suggestion state
  const [showPromptSuggestion, setShowPromptSuggestion] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  // Pattern selector state - use empty string to show placeholder
  const [selectedPattern, setSelectedPattern] = useState<string>('');

  const subagents = config.subagents || {};

  // Load subagents from an orchestrator template
  const loadFromTemplate = (templateId: string) => {
    const templateSubagents = getOrchestratorSubagents(templateId);
    if (templateSubagents) {
      onChange({ subagents: templateSubagents });

      // Generate and show prompt suggestion
      const prompt = generateOrchestratorPrompt(templateId, templateSubagents);
      setSuggestedPrompt(prompt);
      setShowPromptSuggestion(true);
      setCopied(false);
    }
    // Reset the selector after loading
    setSelectedPattern('');
  };

  // Copy prompt to clipboard
  const copyPrompt = async () => {
    await navigator.clipboard.writeText(suggestedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Apply prompt to agent's system prompt (replaces existing)
  const applyPrompt = () => {
    onChange({ systemPrompt: suggestedPrompt });
    setShowPromptSuggestion(false);
  };

  const openDialog = (key?: string) => {
    if (key && subagents[key]) {
      setEditingKey(key);
      setSubagentName(key);
      setSubagentConfig(subagents[key]);
    } else {
      setEditingKey(null);
      setSubagentName('');
      setSubagentConfig({
        description: '',
        prompt: '',
        tools: [],
        model: 'inherit',
      });
    }
    setIsDialogOpen(true);
  };

  const saveSubagent = () => {
    if (!subagentName.trim()) return;

    const updatedSubagents = { ...subagents };

    // If editing and name changed, delete old key
    if (editingKey && editingKey !== subagentName) {
      delete updatedSubagents[editingKey];
    }

    updatedSubagents[subagentName] = subagentConfig;

    onChange({ subagents: updatedSubagents });
    setIsDialogOpen(false);
  };

  const deleteSubagent = (key: string) => {
    const updatedSubagents = { ...subagents };
    delete updatedSubagents[key];
    onChange({ subagents: updatedSubagents });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Subagents</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Define specialized subagents for specific tasks
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPattern} onValueChange={loadFromTemplate}>
            <SelectTrigger className="w-[180px]">
              <Layers className="w-4 h-4 shrink-0" />
              <SelectValue placeholder="Load pattern..." />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Orchestrator Patterns
              </div>
              <SelectSeparator />
              {ORCHESTRATOR_TEMPLATES.map((templateId) => {
                const info = ORCHESTRATOR_TEMPLATE_INFO[templateId];
                return (
                  <SelectItem key={templateId} value={templateId} className="py-2">
                    <div className="flex flex-col">
                      <span className="font-medium">{info?.label || templateId}</span>
                      <span className="text-xs text-muted-foreground">
                        {info?.workers.join(', ')}
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={() => openDialog()}
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Subagent
          </Button>
        </div>
      </div>

      {/* Subagent List */}
      {Object.keys(subagents).length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            No subagents defined yet
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => openDialog()}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Subagent
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(subagents).map(([key, subagent]) => (
            <div
              key={key}
              className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{key}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {subagent.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">
                      {subagent.model || 'inherit'}
                    </span>
                    {subagent.tools && subagent.tools.length > 0 ? (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary cursor-help"
                        title={subagent.tools.join(', ')}
                      >
                        {subagent.tools.length <= 3
                          ? subagent.tools.join(', ')
                          : `${subagent.tools.slice(0, 2).join(', ')} +${subagent.tools.length - 2}`}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        inherits tools
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => openDialog(key)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSubagent(key)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subagent Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingKey ? 'Edit Subagent' : 'Add New Subagent'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="subagent-name">Subagent Name *</Label>
              <Input
                id="subagent-name"
                value={subagentName}
                onChange={(e) => setSubagentName(e.target.value)}
                placeholder="e.g., security-checker"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="subagent-description">Description *</Label>
              <Textarea
                id="subagent-description"
                value={subagentConfig.description}
                onChange={(e) => setSubagentConfig({ ...subagentConfig, description: e.target.value })}
                placeholder="What does this subagent do?"
                rows={2}
              />
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label htmlFor="subagent-prompt">System Prompt *</Label>
              <Textarea
                id="subagent-prompt"
                value={subagentConfig.prompt}
                onChange={(e) => setSubagentConfig({ ...subagentConfig, prompt: e.target.value })}
                placeholder="Define the subagent's behavior and expertise..."
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {/* Tool Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Tools
                </Label>
                {subagentConfig.tools && subagentConfig.tools.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {subagentConfig.tools.length} selected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Select which tools this subagent can use. If none selected, it inherits all tools from the parent agent.
              </p>
              <div className="border border-border rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_TOOLS.map((toolName) => {
                    const isChecked = subagentConfig.tools?.includes(toolName) || false;
                    return (
                      <div key={toolName} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tool-${toolName}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const currentTools = subagentConfig.tools || [];
                            if (checked) {
                              setSubagentConfig({
                                ...subagentConfig,
                                tools: [...currentTools, toolName],
                              });
                            } else {
                              setSubagentConfig({
                                ...subagentConfig,
                                tools: currentTools.filter((t) => t !== toolName),
                              });
                            }
                          }}
                        />
                        <label
                          htmlFor={`tool-${toolName}`}
                          className="text-sm cursor-pointer text-foreground"
                        >
                          {toolName}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
              {subagentConfig.tools && subagentConfig.tools.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setSubagentConfig({ ...subagentConfig, tools: [] })}
                >
                  Clear selection (inherit all)
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveSubagent}
              disabled={!subagentName.trim() || !subagentConfig.description || !subagentConfig.prompt}
            >
              {editingKey ? 'Update' : 'Add'} Subagent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Orchestrator Prompt Suggestion Dialog */}
      <Dialog open={showPromptSuggestion} onOpenChange={setShowPromptSuggestion}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-warning" />
              Orchestrator Prompt Suggestion
            </DialogTitle>
            <DialogDescription>
              Your agent needs an orchestrator prompt to effectively delegate tasks to the imported workers.
              You can copy this suggestion or apply it directly to your system prompt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Suggestion Preview */}
            <div className="relative">
              <Textarea
                value={suggestedPrompt}
                onChange={(e) => setSuggestedPrompt(e.target.value)}
                rows={16}
                className="font-mono text-xs bg-muted/50"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={copyPrompt}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Tips */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Tip:</strong> Make sure your agent has the{' '}
                <code className="px-1 py-0.5 bg-muted rounded text-primary">Task</code> tool enabled
                to call subagents. Orchestrators typically only need read-only tools (Read, Glob, Grep) plus Task.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPromptSuggestion(false)}
            >
              Skip for now
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={copyPrompt}
            >
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              type="button"
              onClick={applyPrompt}
            >
              <Wand2 className="w-4 h-4 mr-1" />
              Apply to System Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
