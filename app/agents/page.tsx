'use client';

import { useAgentStore } from '@/lib/stores/agentStore';
import { useRouter } from 'next/navigation';
import { useRef, useState, useMemo } from 'react';
import { importAgentConfig } from '@/lib/utils/exportImport';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  Upload,
  Sparkles,
  Play,
  Settings,
  MoreHorizontal,
  Bot,
  Wrench,
  Users,
  X,
  Filter,
  Grid3X3,
  List,
} from 'lucide-react';

export default function AgentsPage() {
  const router = useRouter();
  const { listAgents, createAgent, activeAgentId, setActiveAgent } = useAgentStore();
  const agents = listAgents();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { toast } = useToast();

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(agents.map(agent => agent.ui.category));
    return Array.from(cats).sort();
  }, [agents]);

  // Filter agents
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = searchQuery === '' ||
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === null || agent.ui.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [agents, searchQuery, selectedCategory]);

  const handleAgentClick = (agentId: string) => {
    setActiveAgent(agentId);
    router.push(`/agents/${agentId}`);
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const config = await importAgentConfig(file);
      createAgent(config);
      toast({
        variant: 'success',
        title: 'Agent imported',
        description: `"${config.name}" has been added to your library.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error.message,
      });
    }
  };

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Title */}
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Agents</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {agents.length} agent{agents.length !== 1 ? 's' : ''} in your library
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl',
                  'text-sm font-medium text-muted-foreground',
                  'bg-muted/50 hover:bg-muted border border-border/50',
                  'transition-all duration-200'
                )}
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Import</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
              <button
                onClick={() => router.push('/agents/new')}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl',
                  'text-sm font-medium',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 shadow-glow-sm hover:shadow-glow-md',
                  'transition-all duration-200'
                )}
              >
                <Plus className="w-4 h-4" />
                <span>New Agent</span>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-4 mt-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search agents..."
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

            {/* Category Filter */}
            {categories.length > 1 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <div className="flex gap-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                      selectedCategory === null
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all',
                        selectedCategory === cat
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* View Toggle */}
            <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 rounded-md transition-all',
                  viewMode === 'grid'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 rounded-md transition-all',
                  viewMode === 'list'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {agents.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl" />
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No agents yet</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Create your first AI agent to start automating tasks and building intelligent workflows.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 rounded-xl',
                  'text-sm font-medium',
                  'bg-muted hover:bg-muted/80 text-foreground',
                  'transition-all duration-200'
                )}
              >
                <Upload className="w-4 h-4" />
                Import Config
              </button>
              <button
                onClick={() => router.push('/agents/new')}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl',
                  'text-sm font-medium',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 shadow-glow-md',
                  'transition-all duration-200'
                )}
              >
                <Plus className="w-4 h-4" />
                Create Agent
              </button>
            </div>
          </div>
        ) : filteredAgents.length === 0 ? (
          /* No Results */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No matching agents</h2>
            <p className="text-muted-foreground text-center mb-4">
              Try adjusting your search or filters
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory(null);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAgents.map((agent, index) => (
              <button
                key={agent.id}
                onClick={() => handleAgentClick(agent.id)}
                className={cn(
                  'group relative flex flex-col p-5 rounded-2xl border-2 text-left transition-all duration-300',
                  'bg-card hover:bg-card/80',
                  activeAgentId === agent.id
                    ? 'border-primary shadow-glow-sm'
                    : 'border-border hover:border-border-strong hover:shadow-elevation-2'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Agent Icon */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105"
                  style={{
                    backgroundColor: `${agent.ui.color}15`,
                    borderColor: `${agent.ui.color}30`,
                  }}
                >
                  <Sparkles className="w-7 h-7" style={{ color: agent.ui.color }} />
                </div>

                {/* Content */}
                <h3 className="font-semibold text-foreground mb-2 line-clamp-2 leading-snug min-h-[2.5rem]">
                  {agent.name}
                </h3>
                <p className="text-sm text-muted-foreground/80 line-clamp-3 mb-4 leading-relaxed min-h-[3.75rem]">
                  {agent.description}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    {agent.tools.enabled.length}
                  </span>
                  {Object.keys(agent.subagents || {}).length > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {Object.keys(agent.subagents).length}
                    </span>
                  )}
                  <span
                    className="ml-auto px-2 py-0.5 rounded-md text-[10px] font-medium capitalize"
                    style={{
                      backgroundColor: `${agent.ui.color}15`,
                      color: agent.ui.color,
                    }}
                  >
                    {agent.ui.category}
                  </span>
                </div>

                {/* Hover Actions */}
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/agents/${agent.id}/edit`);
                    }}
                    className="w-8 h-8 rounded-lg bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Start new chat with this agent
                      setActiveAgent(agent.id);
                      const sessionId = `session-${Date.now()}`;
                      router.push(`/chat/${sessionId}?agentId=${agent.id}`);
                    }}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      'text-white shadow-sm hover:shadow-md',
                      'transition-all duration-200'
                    )}
                    style={{ backgroundColor: agent.ui.color }}
                  >
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-2">
            {filteredAgents.map((agent, index) => (
              <button
                key={agent.id}
                onClick={() => handleAgentClick(agent.id)}
                className={cn(
                  'group w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200',
                  'bg-card hover:bg-card/80',
                  activeAgentId === agent.id
                    ? 'border-primary shadow-glow-sm'
                    : 'border-border hover:border-border-strong'
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: `${agent.ui.color}15`,
                  }}
                >
                  <Sparkles className="w-6 h-6" style={{ color: agent.ui.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{agent.name}</h3>
                  <p className="text-sm text-muted-foreground/80 line-clamp-1">{agent.description}</p>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    {agent.tools.enabled.length} tools
                  </span>
                  <span
                    className="px-2.5 py-1 rounded-md text-[10px] font-medium capitalize"
                    style={{
                      backgroundColor: `${agent.ui.color}15`,
                      color: agent.ui.color,
                    }}
                  >
                    {agent.ui.category}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/agents/${agent.id}/edit`);
                    }}
                    className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveAgent(agent.id);
                      const sessionId = `session-${Date.now()}`;
                      router.push(`/chat/${sessionId}?agentId=${agent.id}`);
                    }}
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center',
                      'bg-primary text-primary-foreground',
                      'hover:bg-primary/90 transition-colors'
                    )}
                  >
                    <Play className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
