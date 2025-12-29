import { useState, useEffect, useCallback, useRef } from "react";
import type { ClaudeCommand, CommandDiscoveryResponse } from "../../../shared/types";
import { getCommandsDiscoverUrl } from "../config/api";

export interface UseCommandDiscoveryOptions {
  workingDirectory?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

export interface UseCommandDiscoveryReturn {
  commands: ClaudeCommand[];
  isLoading: boolean;
  error: string | null;
  categoryCounts: CommandDiscoveryResponse["categoryCounts"] | null;
  refresh: () => Promise<void>;
  getCommandsByCategory: (category: ClaudeCommand["category"]) => ClaudeCommand[];
  searchCommands: (query: string) => ClaudeCommand[];
}

/**
 * Hook to automatically discover all available Claude Code commands
 * Supports:
 * - Built-in Claude commands
 * - Project-specific commands (.claude/commands/)
 * - Personal commands (~/.claude/commands/)
 * - MCP server commands
 * - Plugin commands
 */
export function useCommandDiscovery(
  options: UseCommandDiscoveryOptions = {}
): UseCommandDiscoveryReturn {
  const {
    workingDirectory,
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds default
  } = options;

  const [commands, setCommands] = useState<ClaudeCommand[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<
    CommandDiscoveryResponse["categoryCounts"] | null
  >(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef<number>(0);

  /**
   * Fetch commands from the backend
   */
  const fetchCommands = useCallback(async () => {
    // Debounce: don't fetch if we just fetched less than 1 second ago
    const now = Date.now();
    if (now - lastFetchRef.current < 1000) {
      return;
    }
    lastFetchRef.current = now;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getCommandsDiscoverUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workingDirectory,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to discover commands: ${response.statusText}`);
      }

      const data: CommandDiscoveryResponse = await response.json();

      setCommands(data.commands);
      setCategoryCounts(data.categoryCounts);

      console.log(`[CommandDiscovery] Discovered ${data.count} commands:`, data.categoryCounts);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[CommandDiscovery] Failed to fetch commands:", errorMessage);
      setError(errorMessage);
    } finally {
      if (abortController === abortControllerRef.current) {
        setIsLoading(false);
      }
    }
  }, [workingDirectory]);

  /**
   * Get commands by category
   */
  const getCommandsByCategory = useCallback(
    (category: ClaudeCommand["category"]) => {
      return commands.filter((cmd) => cmd.category === category);
    },
    [commands]
  );

  /**
   * Search commands by query (fuzzy search across command and description)
   */
  const searchCommands = useCallback(
    (query: string): ClaudeCommand[] => {
      // Strip leading "/" from query for better matching
      const cleanQuery = query.trim().startsWith("/")
        ? query.trim().substring(1)
        : query.trim();

      // If query is empty or just "/", return all commands
      if (!cleanQuery) {
        return commands;
      }

      const lowerQuery = cleanQuery.toLowerCase();

      return commands.filter((cmd) => {
        // Remove "/" from command for matching
        const commandName = cmd.command.toLowerCase().replace(/^\//, "");
        const commandMatch = commandName.includes(lowerQuery);
        const descriptionMatch = cmd.description.toLowerCase().includes(lowerQuery);
        const categoryMatch = cmd.category.toLowerCase().includes(lowerQuery);

        return commandMatch || descriptionMatch || categoryMatch;
      });
    },
    [commands]
  );

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    await fetchCommands();
  }, [fetchCommands]);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchCommands();
  }, [fetchCommands]);

  /**
   * Auto-refresh at intervals
   */
  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = setInterval(() => {
      fetchCommands();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchCommands]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    commands,
    isLoading,
    error,
    categoryCounts,
    refresh,
    getCommandsByCategory,
    searchCommands,
  };
}
