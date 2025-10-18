import { useEffect, useCallback } from "react";

interface UseGitKeyboardShortcutsProps {
  enabled: boolean;
  onCommit?: () => void;
  onRefresh?: () => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  onToggleDiff?: () => void;
  onFocusSearch?: () => void;
  onSwitchTab?: (tab: "changes" | "history") => void;
}

export function useGitKeyboardShortcuts({
  enabled,
  onCommit,
  onRefresh,
  onStageAll,
  onUnstageAll,
  onToggleDiff,
  onFocusSearch,
  onSwitchTab,
}: UseGitKeyboardShortcutsProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check if user is typing in an input
      const activeElement = document.activeElement;
      const isTyping =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement;

      // Global shortcuts (work even when typing)
      if (event.key === "Escape" && isTyping) {
        (activeElement as HTMLElement).blur();
        event.preventDefault();
        return;
      }

      // Don't process other shortcuts if user is typing
      if (isTyping) return;

      const isMac = navigator.platform.toLowerCase().includes("mac");
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      // Commit (Cmd/Ctrl + Enter)
      if (modKey && event.key === "Enter" && onCommit) {
        event.preventDefault();
        onCommit();
        return;
      }

      // Refresh (Cmd/Ctrl + R or F5)
      if ((modKey && event.key === "r") || event.key === "F5") {
        if (onRefresh) {
          event.preventDefault();
          onRefresh();
        }
        return;
      }

      // Stage all (Cmd/Ctrl + A)
      if (modKey && event.key === "a" && onStageAll) {
        event.preventDefault();
        onStageAll();
        return;
      }

      // Unstage all (Cmd/Ctrl + Shift + A)
      if (modKey && event.shiftKey && event.key === "A" && onUnstageAll) {
        event.preventDefault();
        onUnstageAll();
        return;
      }

      // Toggle diff (D)
      if (event.key === "d" && onToggleDiff) {
        event.preventDefault();
        onToggleDiff();
        return;
      }

      // Focus search (Cmd/Ctrl + F or /)
      if ((modKey && event.key === "f") || event.key === "/") {
        if (onFocusSearch) {
          event.preventDefault();
          onFocusSearch();
        }
        return;
      }

      // Switch tabs (1, 2 or Tab)
      if (onSwitchTab) {
        if (event.key === "1") {
          event.preventDefault();
          onSwitchTab("changes");
          return;
        }
        if (event.key === "2") {
          event.preventDefault();
          onSwitchTab("history");
          return;
        }
        if (event.key === "Tab" && !event.shiftKey && !modKey) {
          event.preventDefault();
          // Toggle between tabs
          const currentTab = document.querySelector('[aria-selected="true"]');
          if (currentTab?.textContent?.includes("History")) {
            onSwitchTab("changes");
          } else {
            onSwitchTab("history");
          }
          return;
        }
      }
    },
    [
      enabled,
      onCommit,
      onRefresh,
      onStageAll,
      onUnstageAll,
      onToggleDiff,
      onFocusSearch,
      onSwitchTab,
    ],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

// Keyboard shortcut documentation
export const GIT_KEYBOARD_SHORTCUTS = [
  {
    keys: ["⌘", "Enter"],
    windowsKeys: ["Ctrl", "Enter"],
    description: "Commit staged changes",
  },
  {
    keys: ["⌘", "R"],
    windowsKeys: ["Ctrl", "R"],
    alternateKeys: ["F5"],
    description: "Refresh git status",
  },
  {
    keys: ["⌘", "A"],
    windowsKeys: ["Ctrl", "A"],
    description: "Stage all changes",
  },
  {
    keys: ["⌘", "⇧", "A"],
    windowsKeys: ["Ctrl", "Shift", "A"],
    description: "Unstage all changes",
  },
  {
    keys: ["D"],
    description: "Toggle file diff",
  },
  {
    keys: ["⌘", "F"],
    windowsKeys: ["Ctrl", "F"],
    alternateKeys: ["/"],
    description: "Focus search",
  },
  {
    keys: ["1"],
    description: "Switch to Changes tab",
  },
  {
    keys: ["2"],
    description: "Switch to History tab",
  },
  {
    keys: ["Tab"],
    description: "Toggle between tabs",
  },
  {
    keys: ["Esc"],
    description: "Unfocus input field",
  },
];
