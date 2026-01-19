'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAgentStore } from '@/lib/stores/agentStore';
import { useChatStore } from '@/lib/stores/chatStore';
import { useExecutionStore } from '@/lib/stores/executionStore';
import { useStreamingMessages } from '@/hooks/useStreamingMessages';
import { Button } from '@/components/ui/button';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageCard } from '@/components/chat/MessageCard';
import { ActivityIndicator } from '@/components/chat/ActivityIndicator';
import { ExecutionStatusBar } from '@/components/chat/ExecutionStatusBar';
import { ActivityFeed } from '@/components/chat/ActivityFeed';
import { ComposerBar } from '@/components/chat/ComposerBar';
import { PermissionDialog } from '@/components/chat/PermissionDialog';
import { QuestionDialog } from '@/components/chat/QuestionDialog';
import { CheckpointPanel } from '@/components/chat/CheckpointPanel';
import { FilesystemBrowser } from '@/components/sandbox/FilesystemBrowser';
import {
  ChevronDown,
  X,
  Activity,
  FolderOpen,
  History,
  MessageSquare,
  Bot,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence, springs } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import { getToolDisplayName } from '@/lib/utils/toolDisplayNames';

export default function ChatPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const router = useRouter();
  const { getAgent } = useAgentStore();
  const { getSession, getMessages, createSession, updateSession } = useChatStore();
  const { getPendingPermissions, removePermissionRequest, getPendingQuestions, removeQuestionRequest, getCheckpoints } = useExecutionStore();
  const { isStreaming, error, currentActivity, toolActivities, streamingText, progressData, startStreaming } = useStreamingMessages(sessionId);

  const [agentId, setAgentId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<'sonnet' | 'opus' | 'haiku' | undefined>();
  const [showPanel, setShowPanel] = useState(false);
  const [activePanel, setActivePanel] = useState<'activity' | 'files' | 'checkpoints'>('activity');
  const [showScrollButton, setShowScrollButton] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const session = getSession(sessionId);
  const messages = getMessages(sessionId);
  const agent = agentId ? getAgent(agentId) : null;
  const pendingPermissions = getPendingPermissions(sessionId);
  const currentPermission = pendingPermissions[0];
  const pendingQuestions = getPendingQuestions(sessionId);
  const currentQuestion = pendingQuestions[0];
  const checkpoints = getCheckpoints(sessionId);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollButton(distanceFromBottom > 200);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Initialize session
  useEffect(() => {
    if (!session && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlAgentId = params.get('agentId');

      if (urlAgentId) {
        const agent = getAgent(urlAgentId);
        if (agent) {
          setAgentId(urlAgentId);
          createSession({
            id: sessionId,
            agentId: urlAgentId,
            agentName: agent.name,
            title: 'New Chat',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageCount: 0,
            status: 'active',
          });
        }
      }
    } else if (session) {
      setAgentId(session.agentId);
    }
  }, [session, sessionId, getAgent, createSession]);

  // Auto-scroll
  useEffect(() => {
    if (!showScrollButton) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, showScrollButton]);

  const handleSendMessage = async (message: string) => {
    if (!agent || isStreaming) return;

    if (session && session.title === 'New Chat') {
      updateSession(sessionId, {
        title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
      });
    }

    await startStreaming(agent, message);
  };

  const handleInterrupt = async () => {
    try {
      const response = await fetch(`/api/chat/${sessionId}/interrupt`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to interrupt execution');
      }
    } catch (error) {
      console.error('Error interrupting execution:', error);
    }
  };

  const handleModelChange = (model: 'sonnet' | 'opus' | 'haiku') => {
    setCurrentModel(model);
  };

  const handlePermissionApprove = async () => {
    if (!currentPermission) return;

    try {
      await fetch(`/api/chat/${sessionId}/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: currentPermission.id,
          approved: true,
        }),
      });
      removePermissionRequest(sessionId, currentPermission.id);
    } catch (error) {
      console.error('Error approving permission:', error);
    }
  };

  const handlePermissionDeny = async () => {
    if (!currentPermission) return;

    try {
      await fetch(`/api/chat/${sessionId}/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: currentPermission.id,
          approved: false,
        }),
      });
      removePermissionRequest(sessionId, currentPermission.id);
    } catch (error) {
      console.error('Error denying permission:', error);
    }
  };

  const handleQuestionSubmit = async (answers: Record<string, string>) => {
    if (!currentQuestion) return;

    try {
      await fetch(`/api/chat/${sessionId}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: currentQuestion.id,
          answers,
        }),
      });
      removeQuestionRequest(sessionId, currentQuestion.id);
    } catch (error) {
      console.error('Error submitting question answers:', error);
    }
  };

  const togglePanel = () => {
    setShowPanel(prev => !prev);
  };

  // Agent not found state
  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-sm animate-fade-up">
          <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
            <Bot className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Agent not found</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            The agent you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push('/')}
            className="gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            Go back home
          </Button>
        </div>
      </div>
    );
  }

  const runningActivities = toolActivities.filter(a => a.status === 'running').length;

  return (
    <div className="flex h-screen bg-background">
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <ChatHeader
          sessionId={sessionId}
          agent={agent}
          isStreaming={isStreaming}
          currentModel={currentModel}
          onModelChange={handleModelChange}
          onInterrupt={handleInterrupt}
          showPanel={showPanel}
          onTogglePanel={togglePanel}
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          activityCount={isStreaming ? (runningActivities || toolActivities.length) : 0}
          checkpointCount={checkpoints.length}
        />

        {/* Permission Dialog */}
        {currentPermission && (
          <PermissionDialog
            request={currentPermission}
            onApprove={handlePermissionApprove}
            onDeny={handlePermissionDeny}
            isOpen={true}
          />
        )}

        {/* Question Dialog */}
        {currentQuestion && (
          <QuestionDialog
            request={currentQuestion}
            onSubmit={handleQuestionSubmit}
            isOpen={true}
          />
        )}

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            {messages.length === 0 ? (
              /* Empty state */
              <div className="text-center py-20 animate-fade-up">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl" />
                  <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold mb-3">Start a conversation</h2>
                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed mb-2">
                  Ask <span className="text-foreground font-medium">{agent.name}</span> anything.
                </p>
                <p className="text-sm text-muted-foreground">
                  {agent.tools.enabled.length} tools available
                  {agent.subagents && Object.keys(agent.subagents).length > 0 &&
                    ` • ${Object.keys(agent.subagents).length} subagents`
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Messages */}
                <AnimatePresence mode="popLayout">
                  {messages.map((message, index) => (
                    <motion.div
                      key={message.uuid}
                      initial={{ opacity: 0, y: 20, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{
                        ...springs.gentle,
                        delay: Math.min(index * 0.05, 0.3),
                      }}
                      layout
                    >
                      <MessageCard
                        message={message}
                        agentName={agent.name}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Live Execution Status */}
                <AnimatePresence>
                  {isStreaming && toolActivities.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={springs.gentle}
                    >
                      <ExecutionStatusBar
                        activities={toolActivities}
                        isStreaming={isStreaming}
                        agentName={agent.name}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Streaming text */}
                <AnimatePresence>
                  {isStreaming && streamingText && (
                    <motion.div
                      className="flex gap-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={springs.gentle}
                    >
                      <div className="relative flex-shrink-0">
                        <motion.div
                          className="absolute inset-0 bg-primary/20 rounded-xl blur-md"
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
                          <Bot className="w-5 h-5 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="text-xs font-medium mb-2 text-primary">{agent.name}</div>
                        <div className="prose-signal">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {streamingText}
                            <motion.span
                              className="inline-block w-2 h-4 bg-primary ml-0.5"
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                            />
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Activity indicator */}
                <AnimatePresence>
                  {isStreaming && currentActivity && !streamingText && toolActivities.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={springs.gentle}
                    >
                      <ActivityIndicator agentName={agent.name} activity={currentActivity} progressData={progressData} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error display */}
                {error && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 animate-fade-up">
                    <p className="text-sm font-medium text-destructive mb-1">Error</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                )}
              </>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 animate-fade-up">
            <Button
              variant="outline"
              size="sm"
              onClick={scrollToBottom}
              className="rounded-full shadow-elevation-2 bg-card gap-2 px-4"
            >
              <ChevronDown className="w-4 h-4" />
              <span className="text-xs">New messages</span>
            </Button>
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-border glass">
          <div className="max-w-3xl mx-auto">
            <ComposerBar
              onSendMessage={handleSendMessage}
              onInterrupt={handleInterrupt}
              isStreaming={isStreaming}
              placeholder={`Message ${agent.name}...`}
              disabled={!agent}
              statusMessage={currentActivity?.toolName
                ? `Running ${getToolDisplayName(currentActivity.toolName)}...`
                : currentActivity?.description || 'Thinking...'
              }
              statusTool={currentActivity?.toolName}
            />
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div
        className={cn(
          'border-l border-border bg-card/50 flex flex-col transition-all duration-300 ease-smooth overflow-hidden',
          showPanel ? 'w-80' : 'w-0'
        )}
      >
        {showPanel && (
          <div className="flex flex-col h-full animate-slide-in-right">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex gap-1 p-0.5 bg-muted/30 rounded-lg">
                <button
                  onClick={() => setActivePanel('activity')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                    activePanel === 'activity'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Activity className="w-3 h-3" />
                  Activity
                </button>
                <button
                  onClick={() => setActivePanel('files')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                    activePanel === 'files'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <FolderOpen className="w-3 h-3" />
                  Files
                </button>
                {agent.settings?.enableFileCheckpointing && (
                  <button
                    onClick={() => setActivePanel('checkpoints')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                      activePanel === 'checkpoints'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <History className="w-3 h-3" />
                    History
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={togglePanel}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              {activePanel === 'activity' ? (
                <ActivityFeed activities={toolActivities} isStreaming={isStreaming} />
              ) : activePanel === 'files' ? (
                <FilesystemBrowser sessionId={sessionId} isStreaming={isStreaming} />
              ) : (
                <CheckpointPanel sessionId={sessionId} isStreaming={isStreaming} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
