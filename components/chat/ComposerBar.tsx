'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Square, Search, Globe, FileSearch, Terminal, ArrowUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComposerBarProps {
  onSendMessage: (message: string) => void;
  onInterrupt?: () => void;
  isStreaming: boolean;
  placeholder?: string;
  disabled?: boolean;
  statusMessage?: string;
  statusTool?: string;
}

const toolIcons: Record<string, any> = {
  WebSearch: Search,
  WebFetch: Globe,
  Read: FileSearch,
  Bash: Terminal,
};

export function ComposerBar({
  onSendMessage,
  onInterrupt,
  isStreaming,
  placeholder = 'Type a message...',
  disabled = false,
  statusMessage,
  statusTool,
}: ComposerBarProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  // Focus textarea on mount and after streaming
  useEffect(() => {
    if (textareaRef.current && !isStreaming) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  const handleSubmit = () => {
    if (!message.trim() || isStreaming || disabled) return;

    onSendMessage(message);
    setMessage('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInterrupt = () => {
    if (onInterrupt) {
      onInterrupt();
    }
  };

  const canSend = message.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="px-4 sm:px-6 py-4">
      {/* Status indicator when streaming */}
      {isStreaming && statusMessage && (
        <div className="flex items-center gap-3 mb-3 px-1 animate-fade-in">
          <div className="relative">
            <div className="w-2 h-2 bg-primary rounded-full" />
            <div className="absolute inset-0 w-2 h-2 bg-primary rounded-full animate-ping" />
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            {statusTool && toolIcons[statusTool] && (
              (() => {
                const Icon = toolIcons[statusTool];
                return <Icon className="w-3 h-3 text-primary" />;
              })()
            )}
            <span className="font-mono">{statusMessage}</span>
          </span>
        </div>
      )}

      {/* Input container */}
      <div
        className={cn(
          'relative flex items-end gap-3 p-2 rounded-2xl border transition-all duration-200',
          'bg-card/50',
          isFocused
            ? 'border-primary/40 shadow-glow-sm bg-card'
            : 'border-border hover:border-border-strong',
          isStreaming && 'opacity-90'
        )}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={isStreaming || disabled}
          className={cn(
            'flex-1 min-h-[48px] max-h-[200px] resize-none',
            'bg-transparent px-4 py-3 text-sm',
            'placeholder:text-muted-foreground/50',
            'focus:outline-none',
            'disabled:opacity-50'
          )}
          rows={1}
        />

        {/* Character count */}
        {message.length > 0 && (
          <div className="absolute bottom-4 right-16 text-[10px] text-muted-foreground/40 font-mono">
            {message.length}
          </div>
        )}

        {/* Send/Stop Button */}
        {isStreaming && onInterrupt ? (
          <Button
            onClick={handleInterrupt}
            variant="destructive"
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0"
            title="Stop execution"
          >
            <Square className="w-4 h-4 fill-current" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSend}
            size="icon"
            className={cn(
              'h-10 w-10 rounded-xl flex-shrink-0 transition-all duration-200',
              canSend
                ? 'bg-primary hover:bg-primary/90 shadow-glow-sm hover:shadow-glow-md'
                : 'bg-muted text-muted-foreground hover:bg-muted'
            )}
            title="Send message (Enter)"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-muted-foreground/40">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-muted/30 rounded text-[10px] font-mono border border-border/50">Enter</kbd>
          <span>send</span>
        </span>
        <span className="w-px h-3 bg-border/50" />
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-muted/30 rounded text-[10px] font-mono border border-border/50">Shift + Enter</kbd>
          <span>new line</span>
        </span>
      </div>
    </div>
  );
}
