'use client';

import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Bot,
  MessageSquare,
  Plug2,
  Link2,
  Settings,
  Plus,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'agents', label: 'Agents', icon: Bot, href: '/agents' },
  { id: 'sessions', label: 'Sessions', icon: MessageSquare, href: '/sessions' },
  { id: 'mcp', label: 'MCP Servers', icon: Plug2, href: '/mcp' },
  { id: 'connectors', label: 'Connectors', icon: Link2, href: '/connectors' },
];

export function NavigationRail() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/agents') {
      return pathname === '/' || pathname === '/agents' || pathname.startsWith('/agents/');
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="h-screen w-[72px] flex flex-col bg-background-secondary border-r border-border">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-border/50">
        <button
          onClick={() => router.push('/')}
          className="group relative"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center group-hover:border-primary/40 transition-colors">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
        </button>
      </div>

      {/* Quick Create Button */}
      <div className="p-3">
        <button
          onClick={() => router.push('/agents/new')}
          className={cn(
            'w-full aspect-square rounded-xl flex items-center justify-center',
            'bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40',
            'text-primary transition-all duration-200',
            'group relative overflow-hidden'
          )}
          title="Create new agent"
        >
          <Plus className="w-5 h-5 relative z-10" />
          {/* Hover glow */}
          <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 flex flex-col gap-1 py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <div key={item.id} className="relative px-2">
              {/* Active indicator - at nav rail edge */}
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-primary" />
              )}
              <button
                onClick={() => router.push(item.href)}
                className={cn(
                  'group w-full relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all duration-200',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label.split(' ')[0]}</span>

                {/* Badge */}
                {item.badge && item.badge > 0 && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                    {item.badge}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Settings at bottom */}
      <div className="p-2 border-t border-border/50">
        <button
          onClick={() => router.push('/settings')}
          className={cn(
            'w-full flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all duration-200',
            pathname === '/settings'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
          title="Settings"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </div>
    </nav>
  );
}
