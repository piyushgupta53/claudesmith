'use client';

import { Label } from '@/components/ui/label';
import { AgentConfig } from '@/lib/types/agent';
import { SkillsBrowser } from '@/components/skills/SkillsBrowser';
import { Sparkles, Zap, BookOpen } from 'lucide-react';

interface SkillsTabProps {
  config: Partial<AgentConfig>;
  onChange: (updates: Partial<AgentConfig>) => void;
}

export function SkillsTab({ config, onChange }: SkillsTabProps) {
  const enabledSkills = config.skills?.enabled || [];

  const toggleSkill = (skillName: string) => {
    const isEnabled = enabledSkills.includes(skillName);

    if (isEnabled) {
      // Disable skill
      onChange({
        skills: {
          enabled: enabledSkills.filter(s => s !== skillName)
        }
      });
    } else {
      // Enable skill
      onChange({
        skills: {
          enabled: [...enabledSkills, skillName]
        }
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Info Banner */}
      <div className="relative overflow-hidden p-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-base text-foreground mb-1">
              SDK-Native Skills
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Skills are specialized capabilities that Claude autonomously invokes when relevant.
              Located in <code className="px-1.5 py-0.5 bg-background/80 rounded text-xs font-mono">.claude/skills/</code>,
              they are automatically discovered by the SDK when enabled.
            </p>
          </div>
        </div>
      </div>

      {/* Skills Browser */}
      <SkillsBrowser
        enabledSkills={enabledSkills}
        onToggleSkill={toggleSkill}
      />

      {/* How it works section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="p-4 rounded-xl border border-border bg-card/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <h4 className="font-medium text-sm text-foreground">Automatic Invocation</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Skills are triggered automatically when Claude detects a relevant task.
            No manual prompting required - just enable and go.
          </p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <h4 className="font-medium text-sm text-foreground">Structured Knowledge</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Each skill contains domain-specific patterns, best practices, and
            workflows that guide the agent&apos;s behavior.
          </p>
        </div>
      </div>
    </div>
  );
}
