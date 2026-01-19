'use client';

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { motion, springs, useReducedMotion } from "@/components/ui/motion"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-elevation-1 hover:bg-primary/90 hover:shadow-glow-sm",
        destructive:
          "bg-destructive text-destructive-foreground shadow-elevation-1 hover:bg-destructive/90",
        outline:
          "border border-border bg-card/50 text-foreground hover:bg-card hover:border-border-strong shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground",
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto",
        glow:
          "bg-primary text-primary-foreground shadow-glow-md hover:shadow-glow-lg",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        xs: "h-7 rounded-md px-2 text-[11px] font-medium",
        lg: "h-12 rounded-xl px-6 text-base",
        xl: "h-14 rounded-xl px-8 text-base font-semibold",
        icon: "h-10 w-10 rounded-lg",
        "icon-sm": "h-8 w-8 rounded-lg",
        "icon-xs": "h-6 w-6 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Omit conflicting event handlers between React and Motion
type ConflictingProps = 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, ConflictingProps>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Disable motion animations (uses CSS fallback) */
  disableMotion?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, disableMotion, disabled, asChild, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();
    const useStaticButton = disableMotion || shouldReduceMotion || disabled;

    if (useStaticButton) {
      return (
        <button
          className={cn(
            buttonVariants({ variant, size, className }),
            "active:scale-[0.98]"
          )}
          ref={ref}
          disabled={disabled}
          {...props}
        />
      )
    }

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled}
        whileTap={{ scale: 0.97 }}
        transition={springs.snappy}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
