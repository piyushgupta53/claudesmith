'use client';

import { Bot, Sparkles } from 'lucide-react';
import { motion } from '@/components/ui/motion';

interface ThinkingIndicatorProps {
  agentName: string;
  message?: string;
}

// Animated dot component
function AnimatedDot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="w-1.5 h-1.5 rounded-full bg-primary"
      animate={{
        y: [0, -4, 0],
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 0.6,
        repeat: Infinity,
        delay,
        ease: 'easeInOut',
      }}
    />
  );
}

export function ThinkingIndicator({ agentName, message = 'thinking' }: ThinkingIndicatorProps) {
  return (
    <motion.div
      className="flex gap-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Avatar with breathing glow */}
      <div className="relative flex-shrink-0">
        <motion.div
          className="absolute inset-0 bg-primary/30 rounded-xl blur-md"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <div className="relative w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {/* Name */}
        <div className="text-xs font-medium mb-2 text-primary">{agentName}</div>

        {/* Thinking Animation */}
        <motion.div
          className="inline-flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-2.5 border border-border/50"
          animate={{
            boxShadow: [
              '0 0 0 0 rgba(var(--primary-rgb), 0)',
              '0 0 0 4px rgba(var(--primary-rgb), 0.1)',
              '0 0 0 0 rgba(var(--primary-rgb), 0)',
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Animated pulse indicator */}
          <div className="relative flex items-center justify-center w-4 h-4">
            <motion.span
              className="absolute w-3 h-3 rounded-full bg-primary/50"
              animate={{
                scale: [1, 1.8, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
            <span className="relative w-2 h-2 rounded-full bg-primary" />
          </div>

          {/* Thinking text in mono font */}
          <span className="text-sm font-mono text-muted-foreground">
            {message}
          </span>

          {/* Animated dots with stagger */}
          <div className="flex items-center gap-1">
            <AnimatedDot delay={0} />
            <AnimatedDot delay={0.15} />
            <AnimatedDot delay={0.3} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
