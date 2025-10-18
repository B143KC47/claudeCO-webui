import { useState, useEffect, useCallback, useRef } from "react";
import {
  getGitStatus,
  getGitBranches,
  getGitLog,
  type GitStatusResult,
  type GitBranchesResult,
  type GitCommitsResult,
} from "../actions/git";
import type { GitStatus, GitBranch, GitCommit } from "../../shared/gitTypes";

interface UseGitStatusOptions {
  workingDirectory: string;
  refreshInterval?: number;
  enabled?: boolean;
}

interface UseGitStatusReturn {
  status: GitStatus | null;
  branches: GitBranch[];
  commits: GitCommit[];
  isLoading: boolean;
  error: string | null;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  refreshCommits: () => Promise<void>;
}

export function useGitStatus({
  workingDirectory,
  refreshInterval = 5000,
  enabled = true,
}: UseGitStatusOptions): UseGitStatusReturn {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Function to safely update state only if component is mounted
  const safeSetState = useCallback(
    <T>(setter: (value: T) => void, value: T) => {
      if (mountedRef.current) {
        setter(value);
      }
    },
    [],
  );

  const refreshStatus = useCallback(async () => {
    if (!workingDirectory || !enabled) return;

    try {
      const result: GitStatusResult = await getGitStatus(workingDirectory);
      if (result.success) {
        safeSetState(setStatus, result.data);
        safeSetState(setError, null);
      } else {
        safeSetState(setError, result.error);
      }
    } catch (err) {
      safeSetState(
        setError,
        err instanceof Error ? err.message : "Failed to fetch git status",
      );
    }
  }, [workingDirectory, enabled, safeSetState]);

  const refreshBranches = useCallback(async () => {
    if (!workingDirectory || !enabled) return;

    try {
      const result: GitBranchesResult = await getGitBranches(workingDirectory);
      if (result.success) {
        safeSetState(setBranches, result.data);
      }
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    }
  }, [workingDirectory, enabled, safeSetState]);

  const refreshCommits = useCallback(async () => {
    if (!workingDirectory || !enabled) return;

    try {
      const result: GitCommitsResult = await getGitLog(workingDirectory, 20);
      if (result.success) {
        safeSetState(setCommits, result.data);
      }
    } catch (err) {
      console.error("Failed to fetch commits:", err);
    }
  }, [workingDirectory, enabled, safeSetState]);

  const refresh = useCallback(async () => {
    if (isRefreshing || !enabled) return;

    safeSetState(setIsRefreshing, true);

    try {
      await Promise.all([refreshStatus(), refreshBranches(), refreshCommits()]);
    } finally {
      safeSetState(setIsRefreshing, false);
    }
  }, [
    refreshStatus,
    refreshBranches,
    refreshCommits,
    isRefreshing,
    enabled,
    safeSetState,
  ]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && workingDirectory) {
      setIsLoading(true);
      refresh().finally(() => {
        safeSetState(setIsLoading, false);
      });
    }

    return () => {
      mountedRef.current = false;
    };
  }, [workingDirectory, enabled]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || !refreshInterval || refreshInterval <= 0) return;

    intervalRef.current = setInterval(() => {
      refreshStatus();
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshStatus, refreshInterval, enabled]);

  return {
    status,
    branches,
    commits,
    isLoading,
    error,
    isRefreshing,
    refresh,
    refreshStatus,
    refreshBranches,
    refreshCommits,
  };
}

// Hook for managing file selections
export function useFileSelection() {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const toggleFileSelection = useCallback((filePath: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((filePaths: string[]) => {
    setSelectedFiles(new Set(filePaths));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  const isSelected = useCallback(
    (filePath: string) => {
      return selectedFiles.has(filePath);
    },
    [selectedFiles],
  );

  return {
    selectedFiles,
    toggleFileSelection,
    selectAll,
    deselectAll,
    isSelected,
  };
}
