'use client';

import { useState } from 'react';
import { useChatStore } from '@/lib/stores/chatStore';
import { useRouter } from 'next/navigation';
import { MessageCircle, Clock, Trash2, Bot, Sparkles, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, springs } from '@/components/ui/motion';

// Stagger variants for session groups
const groupVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.02 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: springs.gentle },
  exit: { opacity: 0, x: -12, transition: { duration: 0.15 } },
};

export function SessionList() {
  const router = useRouter();
  const { listSessions, activeSessionId, setActiveSession, deleteSession } = useChatStore();
  const sessions = listSessions();
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);

  const handleSessionClick = (sessionId: string) => {
    setActiveSession(sessionId);
    router.push(`/chat/${sessionId}`);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Delete this session? This will also destroy any associated Docker container.')) {
      return;
    }

    setDeletingSessionId(sessionId);

    try {
      await fetch(`/api/chat/${sessionId}/cleanup`, { method: 'DELETE' });
    } catch (error) {
      console.warn('Container cleanup failed:', error);
    }

    deleteSession(sessionId);

    if (sessionId === activeSessionId) {
      router.push('/');
    }

    setDeletingSessionId(null);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Group sessions by date
  const groupedSessions = sessions.reduce((groups, session) => {
    const date = new Date(session.updatedAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

    let group: string;
    if (diffDays === 0) group = 'Today';
    else if (diffDays === 1) group = 'Yesterday';
    else if (diffDays < 7) group = 'This Week';
    else group = 'Older';

    if (!groups[group]) groups[group] = [];
    groups[group].push(session);
    return groups;
  }, {} as Record<string, typeof sessions>);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium">
            {sessions.length} {sessions.length === 1 ? 'conversation' : 'conversations'}
          </p>
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">No conversations yet</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select an agent from the sidebar to start chatting
            </p>
          </div>
        ) : (
          Object.entries(groupedSessions).map(([group, groupSessions]) => (
            <motion.div
              key={group}
              variants={groupVariants}
              initial="hidden"
              animate="visible"
            >
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                {group}
              </h3>
              <div className="space-y-1">
                <AnimatePresence mode="popLayout">
                  {groupSessions.map((session) => (
                    <motion.div
                      key={session.id}
                      variants={itemVariants}
                      layout
                      exit="exit"
                      onClick={() => handleSessionClick(session.id)}
                      onMouseEnter={() => setHoveredSessionId(session.id)}
                      onMouseLeave={() => setHoveredSessionId(null)}
                      className={cn(
                        'w-full text-left p-3 rounded-xl transition-colors duration-200 cursor-pointer group',
                        'border',
                        session.id === activeSessionId
                          ? 'bg-primary/5 border-primary/30 shadow-glow-sm'
                          : 'bg-card/30 border-border/30 hover:bg-card hover:border-border/50',
                        deletingSessionId === session.id && 'opacity-50 pointer-events-none'
                      )}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      transition={springs.snappy}
                    >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={cn(
                          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                          session.id === activeSessionId
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
                        )}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-foreground truncate">
                          {session.title}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Bot className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">
                            {session.agentName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(session.updatedAt)}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span>{session.messageCount} msgs</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        className={cn(
                          'flex-shrink-0 transition-opacity duration-150',
                          hoveredSessionId === session.id || session.id === activeSessionId
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      >
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          disabled={deletingSessionId === session.id}
                          className={cn(
                            'p-1.5 rounded-lg transition-all duration-150',
                            'text-muted-foreground hover:text-destructive',
                            'hover:bg-destructive/10'
                          )}
                          title="Delete session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
