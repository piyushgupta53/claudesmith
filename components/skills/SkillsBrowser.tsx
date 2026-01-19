'use client';

import { useState, useEffect } from 'react';
import { Search, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SkillInfo {
  name: string;
  description: string;
  category: string;
  path: string;
}

interface SkillsBrowserProps {
  enabledSkills: string[];
  onToggleSkill: (skillName: string) => void;
  onPreview?: (skillName: string) => void;
}

// Custom skill icons as SVG components with unique designs
const SkillIcons = {
  'data-analysis': ({ className, enabled }: { className?: string; enabled?: boolean }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background pattern - bar chart visualization */}
      <rect x="4" y="24" width="6" height="12" rx="1" className={enabled ? 'fill-amber-400' : 'fill-amber-500/30'} />
      <rect x="12" y="16" width="6" height="20" rx="1" className={enabled ? 'fill-amber-300' : 'fill-amber-500/20'} />
      <rect x="20" y="8" width="6" height="28" rx="1" className={enabled ? 'fill-amber-400' : 'fill-amber-500/30'} />
      <rect x="28" y="12" width="6" height="24" rx="1" className={enabled ? 'fill-amber-300' : 'fill-amber-500/20'} />
      {/* Trend line */}
      <path d="M7 22 L15 14 L23 6 L31 10" stroke={enabled ? '#f59e0b' : '#78716c'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={enabled ? 'opacity-100' : 'opacity-40'} />
      {/* Data points */}
      <circle cx="7" cy="22" r="2.5" className={enabled ? 'fill-amber-500' : 'fill-muted-foreground/40'} />
      <circle cx="15" cy="14" r="2.5" className={enabled ? 'fill-amber-500' : 'fill-muted-foreground/40'} />
      <circle cx="23" cy="6" r="2.5" className={enabled ? 'fill-amber-500' : 'fill-muted-foreground/40'} />
      <circle cx="31" cy="10" r="2.5" className={enabled ? 'fill-amber-500' : 'fill-muted-foreground/40'} />
    </svg>
  ),
  'code-review': ({ className, enabled }: { className?: string; enabled?: boolean }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Code brackets */}
      <path d="M12 8 L4 20 L12 32" stroke={enabled ? '#10b981' : '#78716c'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={enabled ? 'opacity-100' : 'opacity-40'} />
      <path d="M28 8 L36 20 L28 32" stroke={enabled ? '#10b981' : '#78716c'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={enabled ? 'opacity-100' : 'opacity-40'} />
      {/* Check mark in center */}
      <circle cx="20" cy="20" r="8" className={enabled ? 'fill-emerald-500/20' : 'fill-muted/30'} />
      <path d="M15 20 L18 23 L25 16" stroke={enabled ? '#10b981' : '#78716c'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={enabled ? 'opacity-100' : 'opacity-40'} />
      {/* Decorative dots */}
      <circle cx="20" cy="6" r="1.5" className={enabled ? 'fill-emerald-400' : 'fill-muted-foreground/30'} />
      <circle cx="20" cy="34" r="1.5" className={enabled ? 'fill-emerald-400' : 'fill-muted-foreground/30'} />
    </svg>
  ),
  'research': ({ className, enabled }: { className?: string; enabled?: boolean }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Magnifying glass */}
      <circle cx="17" cy="17" r="10" stroke={enabled ? '#14b8a6' : '#78716c'} strokeWidth="2.5" className={enabled ? 'opacity-100' : 'opacity-40'} />
      <line x1="24" y1="24" x2="34" y2="34" stroke={enabled ? '#14b8a6' : '#78716c'} strokeWidth="2.5" strokeLinecap="round" className={enabled ? 'opacity-100' : 'opacity-40'} />
      {/* Inner discovery sparkles */}
      <circle cx="14" cy="14" r="2" className={enabled ? 'fill-teal-400' : 'fill-muted-foreground/30'} />
      <circle cx="20" cy="12" r="1.5" className={enabled ? 'fill-teal-300' : 'fill-muted-foreground/20'} />
      <circle cx="17" cy="19" r="1.5" className={enabled ? 'fill-teal-300' : 'fill-muted-foreground/20'} />
      {/* Document lines behind */}
      <rect x="26" y="4" width="10" height="2" rx="1" className={enabled ? 'fill-teal-500/40' : 'fill-muted-foreground/20'} />
      <rect x="28" y="8" width="8" height="2" rx="1" className={enabled ? 'fill-teal-500/30' : 'fill-muted-foreground/15'} />
    </svg>
  ),
  'scripting': ({ className, enabled }: { className?: string; enabled?: boolean }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Terminal window frame */}
      <rect x="2" y="6" width="36" height="28" rx="4" stroke={enabled ? '#f97316' : '#78716c'} strokeWidth="2" className={enabled ? 'opacity-100' : 'opacity-40'} />
      {/* Title bar dots */}
      <circle cx="8" cy="12" r="2" className={enabled ? 'fill-red-400' : 'fill-muted-foreground/30'} />
      <circle cx="14" cy="12" r="2" className={enabled ? 'fill-amber-400' : 'fill-muted-foreground/30'} />
      <circle cx="20" cy="12" r="2" className={enabled ? 'fill-emerald-400' : 'fill-muted-foreground/30'} />
      {/* Command prompt */}
      <path d="M8 22 L14 26 L8 30" stroke={enabled ? '#f97316' : '#78716c'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={enabled ? 'opacity-100' : 'opacity-40'} />
      {/* Cursor/command line */}
      <rect x="18" y="24" width="14" height="3" rx="1" className={enabled ? 'fill-orange-400/60' : 'fill-muted-foreground/20'} />
      {/* Blinking cursor */}
      <rect x="34" y="24" width="2" height="3" rx="0.5" className={enabled ? 'fill-orange-400 animate-pulse' : 'fill-muted-foreground/30'} />
    </svg>
  ),
  // Default icon for unknown skills
  'default': ({ className, enabled }: { className?: string; enabled?: boolean }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14" stroke={enabled ? '#10b981' : '#78716c'} strokeWidth="2" className={enabled ? 'opacity-100' : 'opacity-40'} />
      <path d="M20 12 L20 20 L26 24" stroke={enabled ? '#10b981' : '#78716c'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={enabled ? 'opacity-100' : 'opacity-40'} />
      <circle cx="20" cy="20" r="3" className={enabled ? 'fill-emerald-400' : 'fill-muted-foreground/40'} />
    </svg>
  ),
};

// Skill visual themes
const SKILL_THEMES: Record<string, { gradient: string; glow: string; badge: string; text: string }> = {
  'data-analysis': {
    gradient: 'from-amber-500/20 to-orange-500/10',
    glow: 'shadow-[0_0_30px_-5px] shadow-amber-500/30',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
  },
  'code-review': {
    gradient: 'from-emerald-500/20 to-teal-500/10',
    glow: 'shadow-[0_0_30px_-5px] shadow-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  'research': {
    gradient: 'from-teal-500/20 to-cyan-500/10',
    glow: 'shadow-[0_0_30px_-5px] shadow-teal-500/30',
    badge: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
    text: 'text-teal-600 dark:text-teal-400',
  },
  'scripting': {
    gradient: 'from-orange-500/20 to-red-500/10',
    glow: 'shadow-[0_0_30px_-5px] shadow-orange-500/30',
    badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
    text: 'text-orange-600 dark:text-orange-400',
  },
};

const DEFAULT_THEME = {
  gradient: 'from-primary/20 to-primary/5',
  glow: 'shadow-glow-sm',
  badge: 'bg-primary/15 text-primary border-primary/30',
  text: 'text-primary',
};

export function SkillsBrowser({ enabledSkills, onToggleSkill, onPreview }: SkillsBrowserProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      setLoading(true);
      // Fetch SDK-native skills from API
      const response = await fetch('/api/skills');
      if (!response.ok) {
        throw new Error('Failed to fetch skills');
      }
      const data = await response.json();
      setSkills(data.skills || []);
    } catch (error) {
      console.error('Failed to load skills:', error);
      // Fallback to hardcoded skills if API fails
      const fallbackSkills: SkillInfo[] = [
        {
          name: 'data-analysis',
          description: 'Analyze datasets, find patterns, perform statistical analysis, and generate insights from CSV, JSON, or text data',
          category: 'analysis',
          path: '.claude/skills/data-analysis'
        },
        {
          name: 'code-review',
          description: 'Review code for quality, security vulnerabilities, performance issues, and adherence to best practices',
          category: 'code',
          path: '.claude/skills/code-review'
        },
        {
          name: 'research',
          description: 'Gather information from multiple sources, synthesize findings, verify facts, and create comprehensive reports',
          category: 'research',
          path: '.claude/skills/research'
        },
        {
          name: 'scripting',
          description: 'Compose effective bash commands safely, efficiently, and correctly for automation and data processing',
          category: 'code',
          path: '.claude/skills/scripting'
        }
      ];
      setSkills(fallbackSkills);
    } finally {
      setLoading(false);
    }
  };

  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isEnabled = (skillName: string) => enabledSkills.includes(skillName);

  const getSkillIcon = (skillName: string) => {
    return SkillIcons[skillName as keyof typeof SkillIcons] || SkillIcons.default;
  };

  const getSkillTheme = (skillName: string) => {
    return SKILL_THEMES[skillName] || DEFAULT_THEME;
  };

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'w-full pl-11 pr-4 py-3 border border-border rounded-xl bg-card/50 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:bg-card',
            'placeholder:text-muted-foreground/50 transition-all duration-200'
          )}
        />
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
          <span className="text-sm">Loading skills...</span>
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="w-8 h-8 mb-3 opacity-40" />
          <span className="text-sm">No skills found</span>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSkills.map((skill, index) => {
            const enabled = isEnabled(skill.name);
            const SkillIcon = getSkillIcon(skill.name);
            const theme = getSkillTheme(skill.name);

            return (
              <button
                key={skill.name}
                type="button"
                onClick={() => onToggleSkill(skill.name)}
                className={cn(
                  'group relative flex items-start gap-5 p-5 rounded-2xl border-2 text-left transition-all duration-300',
                  enabled
                    ? `border-transparent bg-gradient-to-br ${theme.gradient} ${theme.glow}`
                    : 'border-border bg-card hover:border-border-strong hover:bg-card/80'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Skill Icon Container */}
                <div className={cn(
                  'relative flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300',
                  enabled
                    ? 'bg-background/80 backdrop-blur-sm'
                    : 'bg-muted/50 group-hover:bg-muted'
                )}>
                  <SkillIcon className="w-10 h-10" enabled={enabled} />

                  {/* Enabled indicator ring */}
                  {enabled && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-glow-sm">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className={cn(
                      'font-semibold text-base transition-colors',
                      enabled ? 'text-foreground' : 'text-foreground'
                    )}>
                      {skill.name.split('-').map(word =>
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </h3>
                    <span className={cn(
                      'text-[10px] font-medium px-2 py-1 rounded-md border uppercase tracking-wider',
                      enabled ? theme.badge : 'bg-muted/50 text-muted-foreground border-border'
                    )}>
                      {skill.category}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {skill.description}
                  </p>
                </div>

                {/* Preview Button */}
                {onPreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(skill.name);
                    }}
                    className={cn(
                      'flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                      enabled
                        ? `${theme.text} hover:bg-background/50`
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    Preview
                  </button>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>
            <span className="font-medium text-foreground">{enabledSkills.length}</span>
            {' '}of{' '}
            <span className="font-medium text-foreground">{skills.length}</span>
            {' '}skills enabled
          </span>
        </div>
        {enabledSkills.length > 0 && (
          <button
            type="button"
            onClick={() => enabledSkills.forEach(s => onToggleSkill(s))}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
