'use client';

import { ChatMessage } from '@/lib/types/chat';
import { User, Bot, Copy, Check, Sparkles } from 'lucide-react';
import { ToolCallCard } from './ToolCallCard';
import { BashExecutionCard } from '@/components/sandbox/BashExecutionCard';
import { FileOperationCard } from '@/components/sandbox/FileOperationCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, springs } from '@/components/ui/motion';

interface MessageCardProps {
  message: ChatMessage;
  agentName: string;
}

// Copy button for code blocks with bounce feedback
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <motion.button
      onClick={copy}
      className={cn(
        'absolute top-2 right-2 p-1.5 rounded-lg',
        'bg-background/80 hover:bg-background border border-border/50',
        'text-muted-foreground hover:text-foreground',
        'transition-colors duration-150',
        'opacity-0 group-hover:opacity-100'
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={springs.snappy}
      title="Copy code"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.div
            key="check"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            transition={springs.bouncy}
          >
            <Check className="w-3.5 h-3.5 text-success" />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={springs.snappy}
          >
            <Copy className="w-3.5 h-3.5" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// Helper function to render specialized tool cards
function renderToolUseBlock(block: any, message: ChatMessage) {
  const toolName = block.name;
  const input = block.input;

  switch (toolName) {
    case 'Bash':
      return (
        <BashExecutionCard
          command={input.command || ''}
          stdout={block.output?.stdout || ''}
          stderr={block.output?.stderr || ''}
          exitCode={block.output?.exitCode ?? (block.is_error ? 1 : 0)}
          executionTime={block.output?.executionTime}
        />
      );

    case 'Read':
      return (
        <FileOperationCard
          operation="read"
          path={input.file_path || input.path || ''}
          content={block.output?.content || ''}
          size={block.output?.size}
          linesRead={
            input.offset !== undefined || input.limit !== undefined
              ? {
                  start: input.offset || 0,
                  end: (input.offset || 0) + (input.limit || 0),
                  total: block.output?.totalLines || 0,
                }
              : undefined
          }
        />
      );

    case 'Write':
      return (
        <FileOperationCard
          operation="write"
          path={input.file_path || input.path || ''}
          content={input.content || ''}
          size={input.content ? new Blob([input.content]).size : undefined}
        />
      );

    default:
      return (
        <ToolCallCard
          toolCall={{
            id: block.id,
            name: block.name,
            input: block.input,
            output: block.output,
            status: block.is_error ? 'failed' : 'completed',
            timestamp: message.timestamp,
          }}
        />
      );
  }
}

// Markdown components with Signal styling
const markdownComponents = {
  p: ({ children }: any) => (
    <p className="text-sm leading-relaxed mb-3 last:mb-0 text-foreground/90">{children}</p>
  ),
  h1: ({ children }: any) => (
    <h1 className="text-lg font-semibold mb-3 mt-5 first:mt-0 text-foreground">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-base font-semibold mb-2 mt-4 first:mt-0 text-foreground">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-sm font-semibold mb-2 mt-3 first:mt-0 text-foreground">{children}</h3>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-outside ml-4 mb-3 space-y-1.5 text-sm text-foreground/90">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-outside ml-4 mb-3 space-y-1.5 text-sm text-foreground/90">{children}</ol>
  ),
  li: ({ children }: any) => (
    <li className="leading-relaxed pl-1">{children}</li>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-primary/40 pl-4 my-3 text-foreground/70 italic">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match;

    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-xs text-foreground" {...props}>
          {children}
        </code>
      );
    }

    return (
      <div className="relative group my-4">
        <div className="flex items-center justify-between px-4 py-2 bg-muted/70 rounded-t-xl border border-border border-b-0">
          <span className="text-xs text-muted-foreground font-mono">{match[1]}</span>
        </div>
        <CopyButton text={String(children).replace(/\n$/, '')} />
        <pre className="bg-muted/50 rounded-b-xl border border-border border-t-0 p-4 overflow-x-auto">
          <code className="font-mono text-xs leading-relaxed text-foreground/90" {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  },
  pre: ({ children }: any) => children,
  a: ({ href, children }: any) => (
    <a href={href} className="text-primary hover:text-primary/80 underline underline-offset-2" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto mb-4 rounded-xl border border-border">
      <table className="min-w-full text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="px-4 py-2.5 text-left font-medium bg-muted/50 border-b border-border text-foreground">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-4 py-2.5 border-b border-border/50 text-foreground/90">{children}</td>
  ),
  hr: () => <hr className="my-6 border-border" />,
  strong: ({ children }: any) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: any) => (
    <em className="italic">{children}</em>
  ),
};

export function MessageCard({ message, agentName }: MessageCardProps) {
  const isUser = message.type === 'user';
  const isAssistant = message.type === 'assistant';

  return (
    <div className={cn('flex gap-4', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            'border transition-colors',
            isUser
              ? 'bg-secondary border-border'
              : 'bg-primary/10 border-primary/20'
          )}
        >
          {isUser ? (
            <User className="w-5 h-5 text-foreground" />
          ) : (
            <Sparkles className="w-5 h-5 text-primary" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', isUser && 'flex flex-col items-end')}>
        {/* Header */}
        <div className={cn('flex items-baseline gap-2 mb-2', isUser && 'flex-row-reverse')}>
          <span className={cn(
            'text-xs font-medium',
            isUser ? 'text-foreground' : 'text-primary'
          )}>
            {isUser ? 'You' : agentName}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Message Content */}
        {typeof message.content === 'string' ? (
          <div
            className={cn(
              'rounded-2xl max-w-full',
              isUser
                ? 'bg-primary text-primary-foreground px-4 py-3 rounded-br-md'
                : ''
            )}
          >
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            ) : (
              <div className="prose-signal">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 max-w-full">
            {Array.isArray(message.content) && message.content.map((block: any, index: number) => {
              if (block.type === 'text') {
                return (
                  <div key={index} className="prose-signal">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {block.text}
                    </ReactMarkdown>
                  </div>
                );
              }

              if (block.type === 'tool_use') {
                return (
                  <div key={index}>
                    {renderToolUseBlock(block, message)}
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
