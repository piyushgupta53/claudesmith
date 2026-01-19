'use client';

import { ExecutionEvent } from '@/lib/types/execution';
import { TimelineEvent } from './TimelineEvent';
import { Clock, Filter } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence, springs } from '@/components/ui/motion';

interface ExecutionTimelineProps {
  events: ExecutionEvent[];
}

type EventFilter = 'all' | 'messages' | 'tools' | 'subagents';

// Stagger variants for timeline events
const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: springs.gentle },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

export function ExecutionTimeline({ events }: ExecutionTimelineProps) {
  const [filter, setFilter] = useState<EventFilter>('all');

  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    if (filter === 'messages') {
      return event.type === 'user_prompt' || event.type === 'assistant_thinking';
    }
    if (filter === 'tools') {
      return event.type === 'tool_call_start' || event.type === 'tool_call_end';
    }
    if (filter === 'subagents') {
      return event.type === 'subagent_start' || event.type === 'subagent_end';
    }
    return true;
  });

  if (events.length === 0) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-12 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
      >
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Clock className="w-12 h-12 text-muted-foreground mb-4" />
        </motion.div>
        <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
        <p className="text-sm text-muted-foreground">
          Events will appear here as the agent executes
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-muted-foreground mr-2">Filter:</span>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({events.length})
          </Button>
          <Button
            variant={filter === 'messages' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('messages')}
          >
            Messages
          </Button>
          <Button
            variant={filter === 'tools' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('tools')}
          >
            Tools
          </Button>
          <Button
            variant={filter === 'subagents' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('subagents')}
          >
            Subagents
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <motion.div
        className="space-y-0"
        variants={listVariants}
        initial="hidden"
        animate="visible"
        key={filter} // Re-animate on filter change
      >
        <AnimatePresence mode="popLayout">
          {filteredEvents.map((event, index) => (
            <motion.div
              key={event.id}
              variants={itemVariants}
              layout
              exit="exit"
            >
              <TimelineEvent
                event={event}
                isLast={index === filteredEvents.length - 1}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Summary */}
      <motion.div
        className="p-4 bg-muted/50 rounded-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="text-sm text-muted-foreground">
          Showing {filteredEvents.length} of {events.length} events
        </div>
      </motion.div>
    </div>
  );
}
