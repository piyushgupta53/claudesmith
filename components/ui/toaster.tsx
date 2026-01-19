"use client"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"
import { CheckCircle2, AlertCircle, Info } from "lucide-react"
import { motion, springs } from "@/components/ui/motion"

const variantIcons = {
  default: Info,
  success: CheckCircle2,
  destructive: AlertCircle,
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant = 'default', ...props }) {
        const Icon = variantIcons[variant as keyof typeof variantIcons] || Info
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={springs.bouncy}
                className="flex-shrink-0 mt-0.5"
              >
                <Icon className="w-5 h-5" />
              </motion.div>
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
