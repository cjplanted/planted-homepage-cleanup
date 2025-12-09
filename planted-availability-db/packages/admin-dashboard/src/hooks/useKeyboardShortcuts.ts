import { useEffect, useRef, useCallback } from 'react';

export interface UseKeyboardShortcutsOptions {
  onVerify?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onToggleSelect?: () => void;
  onSelectAll?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const { enabled = true } = options;

  // Use refs to avoid recreating the event listener on every render
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts if typing in an input/textarea
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    const opts = optionsRef.current;

    // Check for modifier keys
    const hasModifier = event.ctrlKey || event.metaKey;
    const hasShift = event.shiftKey;

    // Navigation shortcuts
    if (event.key === 'ArrowUp' && !hasModifier) {
      event.preventDefault();
      opts.onNavigateUp?.();
      return;
    }

    if (event.key === 'ArrowDown' && !hasModifier) {
      event.preventDefault();
      opts.onNavigateDown?.();
      return;
    }

    // Action shortcuts (require no modifier unless specified)
    if (event.key === 'v' && !hasModifier) {
      event.preventDefault();
      opts.onVerify?.();
      return;
    }

    if (event.key === 'r' && !hasModifier) {
      event.preventDefault();
      opts.onReject?.();
      return;
    }

    if (event.key === 'e' && !hasModifier) {
      event.preventDefault();
      opts.onEdit?.();
      return;
    }

    if (event.key === ' ' && !hasModifier) {
      // Space to toggle selection
      event.preventDefault();
      opts.onToggleSelect?.();
      return;
    }

    // Cmd/Ctrl + A to select all
    if (event.key === 'a' && hasModifier) {
      event.preventDefault();
      opts.onSelectAll?.();
      return;
    }

    // Cmd/Ctrl + Shift + V to verify selected
    if (event.key === 'v' && hasModifier && hasShift) {
      event.preventDefault();
      // This would be handled by the parent component
      // by checking if multiple items are selected
      opts.onVerify?.();
      return;
    }

    // Cmd/Ctrl + Shift + R to reject selected
    if (event.key === 'r' && hasModifier && hasShift) {
      event.preventDefault();
      opts.onReject?.();
      return;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}
