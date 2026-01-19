'use client';

import { AgentLibrary } from './AgentLibrary';
import { SessionList } from './SessionList';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/providers/SidebarProvider';
import {
  PanelLeftClose,
  PanelLeft,
  Settings,
  Sparkles,
  Bot,
  MessageCircle,
  Plus,
  Command,
} from 'lucide-react';
import {
  motion,
  AnimatePresence,
  springs,
} from '@/components/ui/motion';

type SidebarTab = 'agents' | 'sessions';

// Sidebar width constant
const SIDEBAR_WIDTH = 288; // 18rem = 288px

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('agents');
  const { isOpen, isMobile, toggle, close } = useSidebar();
  const router = useRouter();

  return (
    <>
      {/* Mobile overlay - smooth backdrop */}
      <AnimatePresence>
        {isMobile && isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={close}
          />
        )}
      </AnimatePresence>

      {/* Sidebar container */}
      <motion.aside
        initial={false}
        animate={{
          width: isOpen ? SIDEBAR_WIDTH : 0,
        }}
        transition={springs.smooth}
        className={cn(
          'h-screen flex flex-col z-50 overflow-hidden',
          'bg-background-secondary border-r border-border',
          isMobile ? 'fixed left-0 top-0' : 'relative'
        )}
      >
        <motion.div
          initial={false}
          animate={{
            opacity: isOpen ? 1 : 0,
            x: isOpen ? 0 : -20,
          }}
          transition={springs.smooth}
          className={cn(
            'flex flex-col h-full',
            !isOpen && 'pointer-events-none'
          )}
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* Header - Brand identity */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              {/* Logo mark with glow */}
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg" />
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-primary" />
                </div>
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-foreground">
                  Claudesmith
                </h1>
                <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">
                  Agent Studio
                </p>
              </div>
            </div>
            <motion.button
              onClick={toggle}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={springs.snappy}
            >
              <PanelLeftClose className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Quick action - New Agent */}
          <div className="px-4 py-3">
            <motion.button
              onClick={() => router.push('/agents/new')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
                'bg-gradient-to-r from-primary/10 to-transparent',
                'border border-primary/20 hover:border-primary/40',
                'text-foreground hover:text-primary',
                'transition-colors duration-200 group'
              )}
              whileTap={{ scale: 0.98 }}
              transition={springs.snappy}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-medium">New Agent</span>
                <p className="text-[10px] text-muted-foreground">Create from scratch</p>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50 text-[10px] text-muted-foreground font-mono">
                <Command className="w-2.5 h-2.5" />
                N
              </div>
            </motion.button>
          </div>

          {/* Navigation tabs */}
          <div className="px-4 pb-2">
            <div className="flex gap-1 p-1 bg-muted/30 rounded-xl relative">
              {/* Animated tab indicator */}
              <motion.div
                className="absolute top-1 bottom-1 rounded-lg bg-card shadow-elevation-1"
                initial={false}
                animate={{
                  left: activeTab === 'agents' ? 4 : '50%',
                  right: activeTab === 'agents' ? '50%' : 4,
                }}
                transition={springs.snappy}
              />
              <button
                onClick={() => setActiveTab('agents')}
                className={cn(
                  'relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200',
                  activeTab === 'agents'
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Bot className="w-4 h-4" />
                <span>Agents</span>
              </button>
              <button
                onClick={() => setActiveTab('sessions')}
                className={cn(
                  'relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200',
                  activeTab === 'sessions'
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <MessageCircle className="w-4 h-4" />
                <span>Sessions</span>
              </button>
            </div>
          </div>

          {/* Content area with crossfade */}
          <div className="flex-1 overflow-hidden px-2">
            <div className="h-full overflow-y-auto no-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={springs.gentle}
                  className="h-full"
                >
                  {activeTab === 'agents' ? <AgentLibrary /> : <SessionList />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Footer - Settings */}
          <div className="p-4 border-t border-border">
            <motion.button
              onClick={() => router.push('/settings')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
                'text-muted-foreground hover:text-foreground',
                'hover:bg-accent/50 transition-colors duration-150'
              )}
              whileTap={{ scale: 0.98 }}
              transition={springs.snappy}
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Settings</span>
            </motion.button>
          </div>
        </motion.div>
      </motion.aside>

      {/* Collapsed state toggle */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -10 }}
            transition={springs.smooth}
            className="fixed left-4 top-4 z-50"
          >
            <motion.button
              onClick={toggle}
              className={cn(
                'h-10 w-10 flex items-center justify-center rounded-xl',
                'bg-card border border-border shadow-elevation-2',
                'text-muted-foreground hover:text-foreground',
                'hover:border-primary/30 hover:shadow-glow-sm',
                'transition-colors duration-200'
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={springs.snappy}
            >
              <PanelLeft className="w-4 h-4" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
