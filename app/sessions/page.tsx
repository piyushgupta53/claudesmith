'use client';

import { useChatStore } from '@/lib/stores/chatStore';
import { useAgentStore } from '@/lib/stores/agentStore';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  MessageSquare,
  Sparkles,
  Clock,
  Trash2,
  MoreHorizontal,
  Calendar,
  X,
  Bot,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function SessionsPage() {
  const router = useRouter();
  const { listSessions, deleteSession, getMessages } = useChatStore();
  const { getAgent } = useAgentStore();
  const sessions = listSessions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Get unique agents from sessions
  const agentsWithSessions = useMemo(() => {
    const agentIds = new Set(sessions.map(s => s.agentId));
    return Array.from(agentIds).map(id => getAgent(id)).filter(Boolean);
  }, [sessions, getAgent]);

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const filtered = sessions.filter(session => {
      const sessionMessages = getMessages(session.id);
      const matchesSearch = searchQuery === '' ||
        session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sessionMessages.some(m =>
          typeof m.content === 'string' && m.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
      const matchesAgent = selectedAgent === null || session.agentId === selectedAgent;
      return matchesSearch && matchesAgent;
    });

    const groups: { label: string; sessions: typeof sessions }[] = [
      { label: 'Today', sessions: [] },
      { label: 'Yesterday', sessions: [] },
      { label: 'This Week', sessions: [] },
      { label: 'Older', sessions: [] },
    ];

    filtered.forEach(session => {
      const sessionDate = new Date(session.updatedAt || session.createdAt);
      if (sessionDate >= today) {
        groups[0].sessions.push(session);
      } else if (sessionDate >= yesterday) {
        groups[1].sessions.push(session);
      } else if (sessionDate >= weekAgo) {
        groups[2].sessions.push(session);
      } else {
        groups[3].sessions.push(session);
      }
    });

    return groups.filter(g => g.sessions.length > 0);
  }, [sessions, searchQuery, selectedAgent, getMessages]);

  const getSessionPreview = (sessionId: string) => {
    const messages = getMessages(sessionId);
    const userMessages = messages.filter((m) => m.type === 'user');
    if (userMessages.length > 0) {
      const content = userMessages[0].content;
      if (typeof content === 'string') {
        return content.slice(0, 100) + (content.length > 100 ? '...' : '');
      }
    }
    return 'No messages yet';
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      deleteSession(sessionId);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Sessions</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {sessions.length} conversation{sessions.length !== 1 ? 's' : ''} in history
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-11 pr-10 py-2.5 rounded-xl',
                  'bg-card/50 border border-border text-sm',
                  'placeholder:text-muted-foreground/50',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                  'transition-all duration-200'
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Agent Filter */}
            {agentsWithSessions.length > 1 && (
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-muted-foreground" />
                <div className="flex gap-1">
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                      selectedAgent === null
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    All
                  </button>
                  {agentsWithSessions.map((agent) => agent && (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent.id)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                        selectedAgent === agent.id
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      {agent.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {sessions.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No conversations yet</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Start chatting with an agent to create your first session.
            </p>
            <button
              onClick={() => router.push('/agents')}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-xl',
                'text-sm font-medium',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90 transition-colors'
              )}
            >
              <Sparkles className="w-4 h-4" />
              Browse Agents
            </button>
          </div>
        ) : groupedSessions.length === 0 ? (
          /* No Results */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No matching sessions</h2>
            <p className="text-muted-foreground text-center mb-4">
              Try adjusting your search or filters
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedAgent(null);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Session Groups */
          <div className="space-y-8">
            {groupedSessions.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
                  <span className="text-xs text-muted-foreground/60">({group.sessions.length})</span>
                </div>
                <div className="space-y-2">
                  {group.sessions.map((session, index) => {
                    const agent = getAgent(session.agentId);
                    return (
                      <button
                        key={session.id}
                        onClick={() => router.push(`/chat/${session.id}`)}
                        className={cn(
                          'group w-full flex items-start gap-4 p-4 rounded-xl border text-left',
                          'bg-card hover:bg-card/80 border-border hover:border-border-strong',
                          'transition-all duration-200'
                        )}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        {/* Agent Icon */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: agent ? `${agent.ui.color}15` : 'var(--muted)',
                          }}
                        >
                          <Sparkles
                            className="w-5 h-5"
                            style={{ color: agent?.ui.color || 'var(--muted-foreground)' }}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-foreground truncate">
                              {agent?.name || 'Unknown Agent'}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(new Date(session.updatedAt || session.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {getSessionPreview(session.id)}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
                            <span>{session.messageCount} messages</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleDeleteSession(e, session.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
