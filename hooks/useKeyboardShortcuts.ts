import { useEffect } from 'react';

export type KeyboardShortcut = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description?: string;
};

/**
 * Hook to register keyboard shortcuts
 * Handles both Cmd (Mac) and Ctrl (Windows/Linux)
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        // Check if the key matches
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();

        // Check modifiers (handle both Cmd and Ctrl)
        const ctrlOrMetaMatches = shortcut.ctrlKey || shortcut.metaKey
          ? (isMac ? event.metaKey : event.ctrlKey)
          : (!event.ctrlKey && !event.metaKey);

        const shiftMatches = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.altKey ? event.altKey : !event.altKey;

        if (keyMatches && ctrlOrMetaMatches && shiftMatches && altMatches) {
          // Prevent default browser behavior
          event.preventDefault();
          event.stopPropagation();

          // Execute the action
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}

/**
 * Format keyboard shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const isMac = typeof navigator !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const parts: string[] = [];

  if (shortcut.ctrlKey || shortcut.metaKey) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }

  if (shortcut.shiftKey) {
    parts.push(isMac ? '⇧' : 'Shift');
  }

  if (shortcut.altKey) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? '' : '+');
}
