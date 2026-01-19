'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgentConfig, AgentCategory } from '@/lib/types/agent';
import {
  Bot,
  FileSearch,
  Search,
  BarChart3,
  FileText,
  Bug,
  Sparkles,
  Code,
  Wrench,
  Globe,
  Database,
  Lightbulb,
  Zap,
  Cpu,
  Clock,
  Check,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BasicInfoTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

const MODELS = [
  { id: 'sonnet', label: 'Sonnet 4.5', description: 'Balanced performance', icon: Zap, color: 'bg-primary' },
  { id: 'opus', label: 'Opus 4.5', description: 'Most capable', icon: Cpu, color: 'bg-success' },
  { id: 'haiku', label: 'Haiku 4', description: 'Fastest response', icon: Clock, color: 'bg-warning' },
] as const;

const CATEGORIES: { id: AgentCategory; label: string; description: string }[] = [
  { id: 'general', label: 'General', description: 'Multi-purpose assistant' },
  { id: 'code', label: 'Code', description: 'Development & debugging' },
  { id: 'research', label: 'Research', description: 'Analysis & discovery' },
  { id: 'analysis', label: 'Analysis', description: 'Data & insights' },
  { id: 'custom', label: 'Custom', description: 'Your own category' },
];

// Warm palette - no blue/purple per style guide
const COLORS = [
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#059669', name: 'Green' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#d97706', name: 'Orange' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#8b5cf6', name: 'Violet' },
];

// Icon options with their Lucide components
const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'Bot', icon: Bot },
  { name: 'Code', icon: Code },
  { name: 'FileSearch', icon: FileSearch },
  { name: 'Search', icon: Search },
  { name: 'BarChart3', icon: BarChart3 },
  { name: 'FileText', icon: FileText },
  { name: 'Bug', icon: Bug },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Wrench', icon: Wrench },
  { name: 'Globe', icon: Globe },
  { name: 'Database', icon: Database },
  { name: 'Lightbulb', icon: Lightbulb },
];

export function BasicInfoTab({ config, onChange }: BasicInfoTabProps) {
  return (
    <div className="space-y-8">
      {/* Name & Description Section */}
      <div className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="name" className="text-sm font-medium">
            Agent Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={config.name || ''}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g., Code Reviewer"
            className="h-11"
            required
          />
          <p className="text-xs text-muted-foreground">
            A memorable name that describes your agent&apos;s purpose
          </p>
        </div>

        <div className="space-y-3">
          <Label htmlFor="description" className="text-sm font-medium">
            Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            value={config.description || ''}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Describe what your agent does and when to use it..."
            rows={3}
            className="resize-none"
            required
          />
          <p className="text-xs text-muted-foreground">
            Help users understand when to use this agent
          </p>
        </div>
      </div>

      {/* Model Selection - Card Grid */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">
          Model <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODELS.map((model) => {
            const Icon = model.icon;
            const isSelected = config.model === model.id;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => onChange({ model: model.id as any })}
                className={cn(
                  'relative flex flex-col items-start p-4 rounded-xl border-2 transition-all duration-200 text-left',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-glow-sm'
                    : 'border-border bg-card hover:border-border-strong hover:bg-card/80'
                )}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center mb-3',
                  model.color + '/20'
                )}>
                  <Icon className={cn('w-4 h-4', model.color.replace('bg-', 'text-'))} />
                </div>
                <p className={cn('text-sm font-medium', isSelected && 'text-foreground')}>
                  {model.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Selection */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Category</Label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {CATEGORIES.map((category) => {
            const isSelected = config.ui?.category === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onChange({ ui: { ...config.ui!, category: category.id } })}
                className={cn(
                  'px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border-strong'
                )}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Appearance Section */}
      <div className="space-y-6 pt-6 border-t border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Appearance</h3>
          <p className="text-xs text-muted-foreground">Customize how your agent looks</p>
        </div>

        {/* Color Picker */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Accent Color</Label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((color) => {
              const isSelected = config.ui?.color === color.hex;
              return (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => onChange({ ui: { ...config.ui!, color: color.hex } })}
                  className={cn(
                    'group relative w-10 h-10 rounded-xl transition-all duration-200',
                    isSelected ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white drop-shadow-md" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Icon Picker */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Icon</Label>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
            {ICON_OPTIONS.map(({ name, icon: Icon }) => {
              const isSelected = config.ui?.icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onChange({ ui: { ...config.ui!, icon: name } })}
                  className={cn(
                    'w-10 h-10 flex items-center justify-center rounded-lg border transition-all duration-200',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border-strong hover:bg-card/80'
                  )}
                  title={name}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Preview</Label>
          <div className="p-4 rounded-xl border border-border bg-card/50">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center border"
                style={{
                  backgroundColor: `${config.ui?.color || '#10b981'}15`,
                  borderColor: `${config.ui?.color || '#10b981'}30`,
                }}
              >
                {(() => {
                  const iconConfig = ICON_OPTIONS.find(i => i.name === config.ui?.icon);
                  const IconComponent = iconConfig?.icon || Sparkles;
                  return <IconComponent className="w-7 h-7" style={{ color: config.ui?.color || '#10b981' }} />;
                })()}
              </div>
              <div>
                <p className="font-semibold text-foreground">{config.name || 'Your Agent Name'}</p>
                <p className="text-sm text-muted-foreground">{config.description || 'Agent description will appear here'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
