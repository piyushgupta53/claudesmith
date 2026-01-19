'use client';

import { useState } from 'react';
import { useKeyboardShortcuts, formatShortcut, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './dialog';
import { Keyboard } from 'lucide-react';

type ShortcutGroup = {
  title: string;
  shortcuts: (KeyboardShortcut & { label: string })[];
};

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      {
        key: 'k',
        metaKey: true,
        ctrlKey: true,
        action: () => {},
        label: 'Focus search',
      },
      {
        key: 'n',
        metaKey: true,
        ctrlKey: true,
        action: () => {},
        label: 'Create new agent',
      },
      {
        key: 'Escape',
        action: () => {},
        label: 'Clear search / Close dialog',
      },
    ],
  },
  {
    title: 'Chat',
    shortcuts: [
      {
        key: 'Enter',
        action: () => {},
        label: 'Send message',
      },
      {
        key: 'Enter',
        shiftKey: true,
        action: () => {},
        label: 'New line',
      },
    ],
  },
  {
    title: 'Help',
    shortcuts: [
      {
        key: '?',
        action: () => {},
        label: 'Show keyboard shortcuts',
      },
    ],
  },
];

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  // Register keyboard shortcut to open help
  useKeyboardShortcuts([
    {
      key: '?',
      action: () => setIsOpen(true),
      description: 'Show keyboard shortcuts',
    },
    {
      key: '/',
      metaKey: true,
      ctrlKey: true,
      action: () => setIsOpen(true),
      description: 'Show keyboard shortcuts',
    },
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription>
            Use these keyboard shortcuts to navigate the app more efficiently.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="font-semibold text-sm mb-3">{group.title}</h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded bg-muted/50"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.label}
                    </span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-background border border-border rounded">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">ESC</kbd> to close this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
