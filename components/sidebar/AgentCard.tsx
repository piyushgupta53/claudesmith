'use client';

import { AgentConfig } from '@/lib/types/agent';
import { cn } from '@/lib/utils';
import { motion, springs } from '@/components/ui/motion';
import {
  FileSearch,
  Search,
  BarChart3,
  FileText,
  Bug,
  Bot,
  Sparkles,
  Zap,
  Brain,
  Code,
  Cog,
  Globe,
  Shield,
  MessageSquare,
  Play,
} from 'lucide-react';

interface AgentCardProps {
  agent: AgentConfig;
  isActive?: boolean;
  onClick: () => void;
}

const iconMap = {
  FileSearch,
  Search,
  BarChart3,
  FileText,
  Bug,
  Bot,
  Sparkles,
  Zap,
  Brain,
  Code,
  Cog,
  Globe,
  Shield,
  MessageSquare,
};

export function AgentCard({ agent, isActive, onClick }: AgentCardProps) {
  const IconComponent = iconMap[agent.ui.icon as keyof typeof iconMap] || Bot;
  const toolCount = agent.tools.enabled.length;
  const hasSubagents = agent.subagents && Object.keys(agent.subagents).length > 0;

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-xl transition-colors duration-200 group',
        'border',
        isActive
          ? 'bg-primary/5 border-primary/30 shadow-glow-sm'
          : 'bg-card/50 border-border/50 hover:bg-card hover:border-border'
      )}
      whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
      whileTap={{ scale: 0.98 }}
      transition={springs.snappy}
    >
      <div className="flex items-start gap-3">
        {/* Icon with color accent */}
        <div className="relative">
          {isActive && (
            <div
              className="absolute inset-0 rounded-lg blur-md opacity-40"
              style={{ backgroundColor: agent.ui.color }}
            />
          )}
          <div
            className={cn(
              'relative flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
              'border transition-colors duration-200'
            )}
            style={{
              backgroundColor: `${agent.ui.color}15`,
              borderColor: isActive ? `${agent.ui.color}40` : `${agent.ui.color}20`,
            }}
          >
            <IconComponent
              className="w-5 h-5 transition-transform duration-200 group-hover:scale-110"
              style={{ color: agent.ui.color }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-foreground truncate">
              {agent.name}
            </h3>
            {isActive && (
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            )}
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
            {agent.description}
          </p>

          {/* Metadata chips */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
              style={{
                backgroundColor: `${agent.ui.color}15`,
                color: agent.ui.color,
              }}
            >
              {agent.ui.category}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {agent.model}
            </span>
            {toolCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {toolCount} tools
              </span>
            )}
            {hasSubagents && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" />
                subagents
              </span>
            )}
          </div>
        </div>

        {/* Quick action indicator */}
        <div
          className={cn(
            'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            'bg-primary/10 text-primary'
          )}
        >
          <Play className="w-3 h-3" />
        </div>
      </div>
    </motion.button>
  );
}
