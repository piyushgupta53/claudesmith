'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgentConfig } from '@/lib/types/agent';
import { useAgentStore } from '@/lib/stores/agentStore';
import { storageService } from '@/lib/services/storageService';
import { Button } from '@/components/ui/button';
import { BasicInfoTab } from './BasicInfoTab';
import { PromptEditorTab } from './PromptEditorTab';
import { ToolSelectorTab } from './ToolSelectorTab';
import { SkillsTab } from './SkillsTab';
import { McpTab } from './McpTab';
import { ConnectorsTab } from './ConnectorsTab';
import { SubagentEditorTab } from './SubagentEditorTab';
import { OutputFormatTab } from './OutputFormatTab';
import { HooksTab } from './HooksTab';
import { ContextTab } from './ContextTab';
import { CustomToolsTab } from './CustomToolsTab';
import { ErrorHandlingTab } from './ErrorHandlingTab';
import { AdvancedSettingsTab } from './AdvancedSettingsTab';
import { Save, AlertCircle, ArrowLeft, Bot, FileText, Wrench, Sparkles, Plug, PenTool, Users, Webhook, FileJson, Settings2, ShieldAlert, Cog, ChevronDown, Link2, Check, Settings, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// Navigation structure with grouped sections
const NAV_SECTIONS = [
  {
    id: 'basics',
    label: 'Basics',
    items: [
      { id: 'basic', label: 'Details', icon: Bot, description: 'Name, model & appearance' },
      { id: 'prompt', label: 'System Prompt', icon: FileText, description: 'Define behavior & personality' },
    ],
  },
  {
    id: 'capabilities',
    label: 'Capabilities',
    items: [
      { id: 'tools', label: 'Tools', icon: Wrench, description: 'API & sandbox tools' },
      { id: 'skills', label: 'Skills', icon: Sparkles, description: 'Pre-built skill packs' },
      { id: 'connectors', label: 'Connectors', icon: Link2, description: 'OAuth integrations' },
      { id: 'mcp', label: 'MCP Servers', icon: Plug, description: 'External tool servers' },
      { id: 'customTools', label: 'Custom Tools', icon: PenTool, description: 'Build your own tools' },
    ],
  },
  {
    id: 'behavior',
    label: 'Behavior',
    items: [
      { id: 'output', label: 'Output Format', icon: FileJson, description: 'Structured responses' },
      { id: 'subagents', label: 'Subagents', icon: Users, description: 'Orchestrate child agents' },
      { id: 'hooks', label: 'Hooks', icon: Webhook, description: 'Event handlers' },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    items: [
      { id: 'context', label: 'Context', icon: Settings2, description: 'Static & dynamic context' },
      { id: 'errorHandling', label: 'Error Handling', icon: ShieldAlert, description: 'Retry & fallback logic' },
      { id: 'settings', label: 'Settings', icon: Cog, description: 'Limits & permissions' },
    ],
  },
];

interface AgentBuilderFormProps {
  initialConfig?: Partial<AgentConfig>;
  mode: 'create' | 'edit';
  /** Current builder mode (instant/advanced) - only shown in create mode */
  builderMode?: 'instant' | 'advanced';
  /** Callback to switch builder mode */
  onBuilderModeChange?: (mode: 'instant' | 'advanced') => void;
}

export function AgentBuilderForm({ initialConfig, mode, builderMode, onBuilderModeChange }: AgentBuilderFormProps) {
  const router = useRouter();
  const { createAgent, updateAgent } = useAgentStore();
  const { toast } = useToast();

  const [config, setConfig] = useState<Partial<AgentConfig>>(
    initialConfig || {
      name: '',
      description: '',
      systemPrompt: '',
      model: 'sonnet',
      tools: {
        // Default to MVP tools only - sandbox tools require Docker
        enabled: ['WebSearch', 'WebFetch', 'ListMcpResources', 'ReadMcpResource'],
        disabled: [],
      },
      skills: {
        enabled: [],
      },
      subagents: {},
      settings: {
        maxTurns: 50,
        maxBudgetUsd: 1.0,
        permissionMode: 'default',
        enableFileCheckpointing: false,
      },
      ui: {
        color: '#10b981',
        icon: 'Bot',
        category: 'general',
      },
    }
  );

  const [activeTab, setActiveTab] = useState('basic');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const updateConfig = (updates: Partial<AgentConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setErrors([]); // Clear errors when user makes changes
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!config.name?.trim()) {
      newErrors.push('Agent name is required');
    }

    if (!config.description?.trim()) {
      newErrors.push('Description is required');
    }

    if (!config.systemPrompt?.trim()) {
      newErrors.push('System prompt is required');
    }

    if (!config.model) {
      newErrors.push('Model selection is required');
    }

    if (!config.tools?.enabled || config.tools.enabled.length === 0) {
      newErrors.push('At least one tool must be enabled');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setActiveTab('basic'); // Go to first tab if there are errors
      return;
    }

    setIsSaving(true);

    try {
      const now = new Date().toISOString();

      if (mode === 'create') {
        const newAgent: AgentConfig = {
          ...(config as Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>),
          id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: now,
          updatedAt: now,
        } as AgentConfig;

        createAgent(newAgent);
        await storageService.saveAgent(newAgent);

        toast({
          variant: 'success',
          title: 'Agent created',
          description: `"${newAgent.name}" has been created successfully.`,
        });

        router.push(`/agents/${newAgent.id}`);
      } else if (initialConfig?.id) {
        const updatedAgent: AgentConfig = {
          ...initialConfig,
          ...config,
          updatedAt: now,
        } as AgentConfig;

        updateAgent(initialConfig.id, updatedAgent);
        await storageService.saveAgent(updatedAgent);

        toast({
          variant: 'success',
          title: 'Agent updated',
          description: `Changes to "${updatedAgent.name}" have been saved.`,
        });

        router.push(`/agents/${initialConfig.id}`);
      }
    } catch (error) {
      console.error('Failed to save agent:', error);
      setErrors(['Failed to save agent. Please try again.']);
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: 'Failed to save agent. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Get current section and item labels for mobile dropdown
  const getCurrentNavLabel = () => {
    for (const section of NAV_SECTIONS) {
      const item = section.items.find(item => item.id === activeTab);
      if (item) return item.label;
    }
    return 'Details';
  };

  // Render the content based on activeTab
  const renderContent = () => {
    switch (activeTab) {
      case 'basic':
        return <BasicInfoTab config={config} onChange={updateConfig} />;
      case 'prompt':
        return <PromptEditorTab config={config} onChange={updateConfig} />;
      case 'tools':
        return <ToolSelectorTab config={config} onChange={updateConfig} />;
      case 'skills':
        return <SkillsTab config={config} onChange={updateConfig} />;
      case 'connectors':
        return <ConnectorsTab config={config} onChange={updateConfig} />;
      case 'mcp':
        return <McpTab config={config} onChange={updateConfig} />;
      case 'subagents':
        return <SubagentEditorTab config={config} onChange={updateConfig} />;
      case 'output':
        return <OutputFormatTab config={config} onChange={updateConfig} />;
      case 'hooks':
        return <HooksTab config={config} onChange={updateConfig} />;
      case 'context':
        return <ContextTab config={config} onChange={updateConfig} />;
      case 'customTools':
        return <CustomToolsTab config={config} onChange={updateConfig} />;
      case 'errorHandling':
        return <ErrorHandlingTab config={config} onChange={updateConfig} />;
      case 'settings':
        return <AdvancedSettingsTab config={config} onChange={updateConfig} />;
      default:
        return <BasicInfoTab config={config} onChange={updateConfig} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Unified Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-10">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push('/agents')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-sm font-medium text-foreground">
            {config.name || (mode === 'create' ? 'New Agent' : 'Edit Agent')}
          </h1>
        </div>

        {/* Right: Mode Toggle + Actions */}
        <div className="flex items-center gap-2">
          {/* Mode Toggle - only in create mode */}
          {mode === 'create' && onBuilderModeChange && (
            <div className="hidden sm:flex items-center gap-1 p-1 bg-secondary/50 rounded-lg mr-2">
              <button
                onClick={() => onBuilderModeChange('instant')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  builderMode === 'instant'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Instant
              </button>
              <button
                onClick={() => onBuilderModeChange('advanced')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  builderMode === 'advanced'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Settings className="w-3.5 h-3.5" />
                Advanced
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/agents')}
            disabled={isSaving}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 bg-primary hover:bg-primary/90 shadow-glow-sm hover:shadow-glow-md transition-all"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                <span className="hidden sm:inline">Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {mode === 'create' ? 'Create Agent' : 'Save Changes'}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="mx-4 sm:mx-6 mt-4 bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground">
                Please fix the following errors
              </p>
              <ul className="mt-2 space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-destructive" />
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation Dropdown */}
      <div className="md:hidden px-4 py-3 border-b border-border">
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium bg-card border border-border rounded-xl"
        >
          <div className="flex items-center gap-3">
            {(() => {
              const currentItem = NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === activeTab);
              const Icon = currentItem?.icon || Bot;
              return <Icon className="w-4 h-4 text-primary" />;
            })()}
            <span>{getCurrentNavLabel()}</span>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", mobileNavOpen && "rotate-180")} />
        </button>
        {mobileNavOpen && (
          <div className="mt-3 py-2 bg-card border border-border rounded-xl shadow-elevation-3 animate-fade-in">
            {NAV_SECTIONS.map((section, sectionIndex) => (
              <div key={section.id} className={cn(sectionIndex > 0 && "mt-2 pt-2 border-t border-border/50")}>
                <div className="px-4 py-2 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  {section.label}
                </div>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors",
                        isActive
                          ? "text-primary bg-primary/5"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      <Icon className={cn("w-4 h-4", isActive && "text-primary")} />
                      <span>{item.label}</span>
                      {isActive && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar Navigation */}
        <nav className="hidden md:flex flex-col w-64 border-r border-border bg-card/30 overflow-y-auto">
          {/* Agent Preview Card */}
          <div className="p-4 border-b border-border/50">
            <div
              className="p-4 rounded-xl border transition-all"
              style={{
                backgroundColor: `${config.ui?.color || '#10b981'}08`,
                borderColor: `${config.ui?.color || '#10b981'}20`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${config.ui?.color || '#10b981'}15`,
                  }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: config.ui?.color || '#10b981' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {config.name || 'Untitled Agent'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {config.model || 'sonnet'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Sections */}
          <div className="flex-1 py-4 space-y-6">
            {NAV_SECTIONS.map((section) => (
              <div key={section.id}>
                <div className="px-4 mb-2 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  {section.label}
                </div>
                <div className="space-y-0.5 px-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                          "group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200",
                          isActive
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        )}
                      >
                        <div className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                          isActive
                            ? "bg-primary/20 text-primary"
                            : "bg-muted/30 group-hover:bg-muted/50"
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className={cn("text-sm", isActive && "font-medium")}>
                            {item.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 truncate">
                            {item.description}
                          </p>
                        </div>
                        {isActive && (
                          <div className="w-1.5 h-8 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-background to-background/95">
          <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
            {/* Tab Header */}
            <div className="mb-8">
              {(() => {
                const currentSection = NAV_SECTIONS.find(s => s.items.some(i => i.id === activeTab));
                const currentItem = currentSection?.items.find(i => i.id === activeTab);
                const Icon = currentItem?.icon || Bot;
                return (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">{currentItem?.label}</h2>
                      <p className="text-sm text-muted-foreground">{currentItem?.description}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
