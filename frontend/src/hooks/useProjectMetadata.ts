import { useState, useEffect, useCallback } from "react";

// localStorage keys
const STORAGE_KEYS = {
  FAVORITES: "claude-webui-favorites",
  RECENT: "claude-webui-recent",
  SORT: "claude-webui-sort",
  FREQUENCY: "claude-webui-frequency",
} as const;

// Types
export interface RecentProject {
  path: string;
  timestamp: number;
}

export interface ProjectFrequency {
  path: string;
  count: number;
  firstAccess: number;
  lastAccess: number;
}

export interface ProjectMetadata {
  isFavorite: boolean;
  lastAccessed?: number;
  accessCount: number;
  accessFrequency: number; // accesses per day
  importance: "high" | "medium" | "low"; // for Bento grid sizing
}

export type SortMode = "recent" | "name" | "path";

// Utility functions for localStorage
function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key} to localStorage:`, error);
  }
}

/**
 * Custom hook for managing project metadata using localStorage
 * Handles favorites, recent projects, and access tracking
 */
export function useProjectMetadata() {
  const [favorites, setFavorites] = useState<string[]>(() =>
    getStorageItem(STORAGE_KEYS.FAVORITES, []),
  );

  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(() =>
    getStorageItem(STORAGE_KEYS.RECENT, []),
  );

  const [sortMode, setSortMode] = useState<SortMode>(() =>
    getStorageItem(STORAGE_KEYS.SORT, "recent"),
  );

  const [frequencyMap, setFrequencyMap] = useState<
    Record<string, ProjectFrequency>
  >(() => getStorageItem(STORAGE_KEYS.FREQUENCY, {}));

  // Persist favorites to localStorage
  useEffect(() => {
    setStorageItem(STORAGE_KEYS.FAVORITES, favorites);
  }, [favorites]);

  // Persist recent projects to localStorage
  useEffect(() => {
    setStorageItem(STORAGE_KEYS.RECENT, recentProjects);
  }, [recentProjects]);

  // Persist sort mode to localStorage
  useEffect(() => {
    setStorageItem(STORAGE_KEYS.SORT, sortMode);
  }, [sortMode]);

  // Persist frequency map to localStorage
  useEffect(() => {
    setStorageItem(STORAGE_KEYS.FREQUENCY, frequencyMap);
  }, [frequencyMap]);

  /**
   * Toggle favorite status for a project
   */
  const toggleFavorite = useCallback((path: string) => {
    setFavorites((prev) => {
      if (prev.includes(path)) {
        return prev.filter((p) => p !== path);
      } else {
        return [...prev, path];
      }
    });
  }, []);

  /**
   * Check if a project is favorited
   */
  const isFavorite = useCallback(
    (path: string): boolean => {
      return favorites.includes(path);
    },
    [favorites],
  );

  /**
   * Mark a project as accessed (updates recent projects list and frequency)
   * Keeps only the 5 most recent projects
   */
  const markAsAccessed = useCallback((path: string) => {
    const now = Date.now();

    // Update recent projects
    setRecentProjects((prev) => {
      // Remove existing entry if present
      const filtered = prev.filter((p) => p.path !== path);

      // Add new entry at the beginning
      const updated = [{ path, timestamp: now }, ...filtered].slice(0, 5); // Keep only 5 most recent

      return updated;
    });

    // Update frequency tracking
    setFrequencyMap((prev) => {
      const existing = prev[path];
      if (existing) {
        return {
          ...prev,
          [path]: {
            ...existing,
            count: existing.count + 1,
            lastAccess: now,
          },
        };
      } else {
        return {
          ...prev,
          [path]: {
            path,
            count: 1,
            firstAccess: now,
            lastAccess: now,
          },
        };
      }
    });
  }, []);

  /**
   * Get recent projects (returns copy to prevent mutation)
   */
  const getRecentProjects = useCallback(
    (limit: number = 5): RecentProject[] => {
      return recentProjects.slice(0, limit);
    },
    [recentProjects],
  );

  /**
   * Get metadata for a specific project
   */
  const getMetadata = useCallback(
    (path: string): ProjectMetadata => {
      const recent = recentProjects.find((p) => p.path === path);
      const frequency = frequencyMap[path];

      // Calculate access frequency (accesses per day)
      let accessFrequency = 0;
      if (frequency) {
        const daysSinceFirst =
          (Date.now() - frequency.firstAccess) / (1000 * 60 * 60 * 24);
        accessFrequency =
          daysSinceFirst > 0
            ? frequency.count / daysSinceFirst
            : frequency.count;
      }

      // Determine importance for Bento grid sizing
      let importance: "high" | "medium" | "low" = "low";

      // High importance: favorites OR accessed 2+ times per day
      if (favorites.includes(path) || accessFrequency >= 2) {
        importance = "high";
      }
      // Medium importance: accessed 0.5-2 times per day OR in recent list
      else if (accessFrequency >= 0.5 || recent) {
        importance = "medium";
      }

      return {
        isFavorite: favorites.includes(path),
        lastAccessed: recent?.timestamp,
        accessCount: frequency?.count || 0,
        accessFrequency,
        importance,
      };
    },
    [favorites, recentProjects, frequencyMap],
  );

  /**
   * Get relative time string for display
   */
  const getRelativeTime = useCallback((timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
    }
    const months = Math.floor(days / 30);
    return `${months} month${months !== 1 ? "s" : ""} ago`;
  }, []);

  /**
   * Extract project name from path
   */
  const extractProjectName = useCallback((path: string): string => {
    // Remove trailing slash
    const normalized = path.replace(/\/$/, "");

    // Split by both forward and backslash
    const parts = normalized.split(/[/\\]/);

    // Return the last non-empty part
    const name = parts.filter(Boolean).pop() || path;
    return name;
  }, []);

  /**
   * Truncate path for display
   */
  const truncatePath = useCallback(
    (path: string, maxLength: number = 50): string => {
      if (path.length <= maxLength) return path;

      const parts = path.split(/[/\\]/);
      const filename = parts.pop() || "";

      // Always show the filename
      if (filename.length >= maxLength) {
        return ".../" + filename.slice(-(maxLength - 4));
      }

      // Try to fit as many parent directories as possible
      let result = filename;
      let i = parts.length - 1;

      while (i >= 0 && result.length + parts[i].length + 1 <= maxLength - 4) {
        result = parts[i] + "/" + result;
        i--;
      }

      return i >= 0 ? ".../" + result : result;
    },
    [],
  );

  /**
   * Update sort mode
   */
  const updateSortMode = useCallback((mode: SortMode) => {
    setSortMode(mode);
  }, []);

  return {
    // State
    favorites,
    recentProjects,
    sortMode,

    // Actions
    toggleFavorite,
    isFavorite,
    markAsAccessed,
    updateSortMode,

    // Getters
    getRecentProjects,
    getMetadata,

    // Utilities
    getRelativeTime,
    extractProjectName,
    truncatePath,
  };
}
