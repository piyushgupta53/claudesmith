'use client';

import { useAgentStore } from '@/lib/stores/agentStore';
import { AgentCard } from './AgentCard';
import { Input } from '../ui/input';
import { Search, X, Upload, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { importAgentConfig } from '@/lib/utils/exportImport';
import { useRef, useState, useMemo } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useToast } from '../ui/use-toast';
import { cn } from '@/lib/utils';
import {
  motion,
  AnimatePresence,
  springs,
} from '@/components/ui/motion';

// Stagger variants for agent list
const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springs.gentle,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

export function AgentLibrary() {
  const router = useRouter();
  const { listAgents, activeAgentId, setActiveAgent, createAgent } = useAgentStore();
  const agents = listAgents();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAgentClick = (agentId: string) => {
    setActiveAgent(agentId);
    router.push(`/agents/${agentId}`);
  };

  const handleCreateAgent = () => {
    router.push('/agents/new');
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'k',
      metaKey: true,
      ctrlKey: true,
      action: () => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      },
      description: 'Focus search',
    },
    {
      key: 'n',
      metaKey: true,
      ctrlKey: true,
      action: handleCreateAgent,
      description: 'Create new agent',
    },
  ]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const config = await importAgentConfig(file);
      createAgent(config);

      toast({
        variant: 'success',
        title: 'Agent imported successfully',
        description: `"${config.name}" has been added to your library.`,
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error.message,
      });
    }
  };

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(agents.map(agent => agent.ui.category));
    return Array.from(cats).sort();
  }, [agents]);

  // Filter agents based on search and category
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = searchQuery === '' ||
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.tools.enabled.some(tool => tool.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === null || agent.ui.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [agents, searchQuery, selectedCategory]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-2 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('');
                searchInputRef.current?.blur();
              }
            }}
            className="pl-9 pr-9 h-9 text-sm bg-muted/30 border-border/50 focus:bg-card"
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={springs.snappy}
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Category Filters */}
      <AnimatePresence>
        {categories.length > 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={springs.smooth}
            className="px-2 pb-3 overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5">
              <motion.button
                layout
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors duration-150',
                  selectedCategory === null
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                )}
                whileTap={{ scale: 0.95 }}
                transition={springs.snappy}
              >
                All
              </motion.button>
              {categories.map((category) => (
                <motion.button
                  layout
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors duration-150 capitalize',
                    selectedCategory === category
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                  )}
                  whileTap={{ scale: 0.95 }}
                  transition={springs.snappy}
                >
                  {category}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import action */}
      <div className="px-2 pb-2">
        <motion.button
          onClick={handleImportClick}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
            'text-xs text-muted-foreground hover:text-foreground',
            'bg-muted/30 hover:bg-muted/50 border border-dashed border-border/50',
            'transition-colors duration-150'
          )}
          whileTap={{ scale: 0.98 }}
          transition={springs.snappy}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import agent config</span>
        </motion.button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileImport}
          className="hidden"
        />
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <AnimatePresence mode="wait">
          {agents.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={springs.gentle}
              className="text-center py-12 px-4"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={springs.bouncy}
                className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"
              >
                <Sparkles className="w-8 h-8 text-primary" />
              </motion.div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No agents yet</h3>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Create your first agent to get started with AI automation
              </p>
              <motion.button
                onClick={handleCreateAgent}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors'
                )}
                whileTap={{ scale: 0.95 }}
                transition={springs.snappy}
              >
                Create Agent
              </motion.button>
            </motion.div>
          ) : filteredAgents.length === 0 ? (
            <motion.div
              key="no-match"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={springs.gentle}
              className="text-center py-12 px-4"
            >
              <motion.div
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={springs.bouncy}
                className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4"
              >
                <Search className="w-6 h-6 text-muted-foreground" />
              </motion.div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No matches</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Try adjusting your search or filters
              </p>
              <motion.button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                }}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-muted text-foreground',
                  'hover:bg-muted/80 transition-colors'
                )}
                whileTap={{ scale: 0.95 }}
                transition={springs.snappy}
              >
                Clear filters
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              variants={listVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              <AnimatePresence mode="popLayout">
                {filteredAgents.map((agent) => (
                  <motion.div
                    key={agent.id}
                    variants={itemVariants}
                    layout
                    exit="exit"
                  >
                    <AgentCard
                      agent={agent}
                      isActive={agent.id === activeAgentId}
                      onClick={() => handleAgentClick(agent.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
