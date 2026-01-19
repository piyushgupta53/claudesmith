'use client';

/**
 * Motion utilities for Claudesmith
 * Reusable animation primitives using Motion (formerly Framer Motion)
 *
 * Philosophy: Subtle > Flashy. Every animation serves a purpose.
 */

import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
  type Transition,
  type HTMLMotionProps,
} from 'motion/react';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ============================================
// SPRING PRESETS
// ============================================

export const springs = {
  // Snappy interactions (buttons, toggles)
  snappy: { type: 'spring', stiffness: 500, damping: 30 } as Transition,
  // Smooth UI transitions (modals, panels)
  smooth: { type: 'spring', stiffness: 400, damping: 25 } as Transition,
  // Gentle entrances (lists, cards)
  gentle: { type: 'spring', stiffness: 300, damping: 25 } as Transition,
  // Bouncy feedback (success states)
  bouncy: { type: 'spring', stiffness: 400, damping: 15 } as Transition,
} as const;

// ============================================
// VARIANT PRESETS
// ============================================

/** Fade + Scale for modals, cards, tooltips */
export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

/** Fade + Slide Up for lists, notifications */
export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/** Fade + Slide Down for dropdowns */
export const fadeSlideDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/** Stagger container for list animations */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

/** Stagger item for list children */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.gentle,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15 },
  },
};

/** Collapse height animation */
export const collapseVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
};

// ============================================
// REUSABLE COMPONENTS
// ============================================

interface FadeScaleProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
}

/** Fade + Scale entrance animation (modals, cards) */
export const FadeScale = forwardRef<HTMLDivElement, FadeScaleProps>(
  ({ children, className, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
      <motion.div
        ref={ref}
        initial={shouldReduceMotion ? false : 'hidden'}
        animate="visible"
        exit="exit"
        variants={fadeScale}
        transition={springs.smooth}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
FadeScale.displayName = 'FadeScale';

interface FadeSlideProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
}

/** Fade + Slide entrance animation (lists, panels) */
export const FadeSlide = forwardRef<HTMLDivElement, FadeSlideProps>(
  ({ children, className, direction = 'up', ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    const offsets = {
      up: { y: 12 },
      down: { y: -12 },
      left: { x: 12 },
      right: { x: -12 },
    };

    return (
      <motion.div
        ref={ref}
        initial={shouldReduceMotion ? false : { opacity: 0, ...offsets[direction] }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, ...offsets[direction] }}
        transition={springs.smooth}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
FadeSlide.displayName = 'FadeSlide';

interface CollapseProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  isOpen: boolean;
}

/** Smooth height collapse/expand with AnimatePresence */
export const Collapse = forwardRef<HTMLDivElement, CollapseProps>(
  ({ children, isOpen, className, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            ref={ref}
            initial={shouldReduceMotion ? false : 'hidden'}
            animate="visible"
            exit="exit"
            variants={collapseVariants}
            transition={springs.smooth}
            style={{ overflow: 'hidden' }}
            className={className}
            {...props}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
Collapse.displayName = 'Collapse';

interface StaggerListProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
}

/** Container that staggers children animations */
export const StaggerList = forwardRef<HTMLDivElement, StaggerListProps>(
  ({ children, className, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
      <motion.div
        ref={ref}
        initial={shouldReduceMotion ? false : 'hidden'}
        animate="visible"
        exit="exit"
        variants={staggerContainer}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
StaggerList.displayName = 'StaggerList';

interface StaggerItemProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
}

/** Item within a StaggerList */
export const StaggerItem = forwardRef<HTMLDivElement, StaggerItemProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        variants={staggerItem}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
StaggerItem.displayName = 'StaggerItem';

// ============================================
// INTERACTION HELPERS
// ============================================

/** Press animation props for buttons */
export const pressProps = {
  whileTap: { scale: 0.97 },
  transition: springs.snappy,
} as const;

/** Hover lift animation props for cards */
export const hoverLiftProps = {
  whileHover: { y: -2 },
  transition: springs.gentle,
} as const;

/** Combined press + hover for interactive elements */
export const interactiveProps = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: springs.snappy,
} as const;

// ============================================
// UTILITY HOOKS
// ============================================

/** Returns motion-safe props that respect reduced motion preference */
export function useMotionSafe() {
  const shouldReduceMotion = useReducedMotion();

  return {
    animate: shouldReduceMotion ? false : undefined,
    initial: shouldReduceMotion ? false : undefined,
    transition: shouldReduceMotion ? { duration: 0 } : springs.smooth,
  };
}

// ============================================
// CHEVRON ROTATION
// ============================================

interface RotatingChevronProps extends HTMLMotionProps<'div'> {
  isOpen: boolean;
  children: ReactNode;
}

/** Chevron that smoothly rotates when expanded */
export const RotatingChevron = forwardRef<HTMLDivElement, RotatingChevronProps>(
  ({ isOpen, children, className, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
      <motion.div
        ref={ref}
        animate={{ rotate: isOpen ? 90 : 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : springs.snappy}
        className={cn('flex-shrink-0', className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
RotatingChevron.displayName = 'RotatingChevron';

// ============================================
// STATUS PULSE
// ============================================

interface StatusPulseProps {
  status: 'running' | 'completed' | 'failed' | 'pending';
  className?: string;
}

/** Animated status indicator with pulse effect */
export function StatusPulse({ status, className }: StatusPulseProps) {
  const shouldReduceMotion = useReducedMotion();

  const colors = {
    running: 'bg-primary',
    completed: 'bg-success',
    failed: 'bg-destructive',
    pending: 'bg-muted-foreground',
  };

  const glowColors = {
    running: 'shadow-[0_0_8px_hsl(var(--primary))]',
    completed: 'shadow-[0_0_6px_hsl(var(--success)/0.5)]',
    failed: 'shadow-[0_0_6px_hsl(var(--destructive)/0.5)]',
    pending: '',
  };

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {status === 'running' && !shouldReduceMotion && (
        <motion.div
          className={cn('absolute inset-0 rounded-full', colors[status])}
          animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <motion.div
        className={cn('w-2 h-2 rounded-full', colors[status], glowColors[status])}
        animate={
          status === 'running' && !shouldReduceMotion
            ? { scale: [1, 1.1, 1] }
            : {}
        }
        transition={{ duration: 0.6, repeat: Infinity }}
      />
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================

export { motion, AnimatePresence, useReducedMotion };
export type { Variants, Transition, HTMLMotionProps };
