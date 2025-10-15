import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusIcon,
  CogIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  StarIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import type { ProjectsResponse, ProjectInfo } from "../types";
import { getProjectsUrl } from "../config/api";
import { useLanguage } from "../contexts/LanguageContext";
import { useProjectMetadata, type SortMode } from "../hooks/useProjectMetadata";
import { ProjectCard } from "./projects/ProjectCard";
import { EmptyState } from "./projects/EmptyState";

interface SystemInfo {
  username: string;
  hostname: string;
  platform: string;
  homeDirectory: string;
  currentWorkingDirectory: string;
  isWSL: boolean;
}

interface EnhancedProjectInfo extends ProjectInfo {
  name: string;
}

export function ProjectSelector() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [showNewDirectoryInput, setShowNewDirectoryInput] = useState(false);
  const [newDirectoryPath, setNewDirectoryPath] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Command palette state
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Grid keyboard navigation state
  const [focusedProjectIndex, setFocusedProjectIndex] = useState<number>(-1);
  const [gridKeyboardMode, setGridKeyboardMode] = useState(false);

  const navigate = useNavigate();
  const { t } = useLanguage();

  // Project metadata hook
  const {
    sortMode,
    updateSortMode,
    toggleFavorite,
    isFavorite,
    markAsAccessed,
    getRecentProjects,
    getMetadata,
    getRelativeTime,
    extractProjectName,
    truncatePath,
  } = useProjectMetadata();

  // Generate smart path suggestions based on system info
  const generateSmartPath = useCallback(
    (directoryName: string): string => {
      if (!systemInfo) {
        return `/${directoryName}`;
      }

      const { homeDirectory, currentWorkingDirectory, isWSL } = systemInfo;
      let basePath = currentWorkingDirectory;

      // WSL path preference
      if (
        isWSL &&
        currentWorkingDirectory.startsWith("/home/") &&
        homeDirectory.startsWith("/mnt/")
      ) {
        basePath = homeDirectory;
      }

      // Default to Desktop if not in dev area
      if (
        !basePath.includes("Desktop") &&
        !basePath.includes("Documents") &&
        !basePath.includes("Projects") &&
        !basePath.includes("dev") &&
        !basePath.includes("workspace") &&
        !basePath.includes("src")
      ) {
        basePath = `${basePath}/Desktop`;
      }

      const normalizedBasePath = basePath.replace(/\\/g, "/");
      return `${normalizedBasePath}/${directoryName}`;
    },
    [systemInfo],
  );

  // Enhance projects with metadata
  const enhancedProjects: EnhancedProjectInfo[] = useMemo(() => {
    return projects.map((project) => ({
      ...project,
      name: extractProjectName(project.path),
    }));
  }, [projects, extractProjectName]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = enhancedProjects;

    // Apply favorites filter
    if (showFavoritesOnly) {
      filtered = filtered.filter((p) => isFavorite(p.path));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.path.toLowerCase().includes(query),
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case "name":
          return a.name.localeCompare(b.name);
        case "path":
          return a.path.localeCompare(b.path);
        case "recent": {
          const metaA = getMetadata(a.path);
          const metaB = getMetadata(b.path);
          const timeA = metaA.lastAccessed || 0;
          const timeB = metaB.lastAccessed || 0;
          return timeB - timeA; // Most recent first
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [
    enhancedProjects,
    showFavoritesOnly,
    searchQuery,
    sortMode,
    isFavorite,
    getMetadata,
  ]);

  // Get recent projects for dedicated section
  const recentProjects = useMemo(() => {
    const recentPaths = getRecentProjects(5);
    return enhancedProjects.filter((p) =>
      recentPaths.some((r) => r.path === p.path),
    );
  }, [enhancedProjects, getRecentProjects]);

  // Command palette filtered results
  const paletteResults = useMemo(() => {
    if (!paletteQuery.trim()) {
      // Show recent projects when no query
      return recentProjects.slice(0, 8);
    }

    // Fuzzy search
    const query = paletteQuery.toLowerCase();
    return enhancedProjects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.path.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [paletteQuery, enhancedProjects, recentProjects]);

  // Handle project selection
  const handleProjectSelect = useCallback(
    (projectPath: string) => {
      // Mark as accessed for recent tracking
      markAsAccessed(projectPath);

      const normalizedPath = projectPath.startsWith("/")
        ? projectPath
        : `/${projectPath}`;
      navigate(`/projects${normalizedPath}`);
    },
    [markAsAccessed, navigate],
  );

  // Handle command palette selection
  const handlePaletteSelect = useCallback(
    (projectPath: string) => {
      setShowCommandPalette(false);
      setPaletteQuery("");
      setSelectedIndex(0);
      handleProjectSelect(projectPath);
    },
    [handleProjectSelect],
  );

  // Handle palette keyboard navigation
  const handlePaletteKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, paletteResults.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && paletteResults[selectedIndex]) {
        e.preventDefault();
        handlePaletteSelect(paletteResults[selectedIndex].path);
      }
    },
    [paletteResults, selectedIndex, handlePaletteSelect],
  );

  useEffect(() => {
    loadProjects();
    loadSystemInfo();
  }, []);

  // Command Palette keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if command palette is open
      if (showCommandPalette) {
        // Escape to close
        if (e.key === "Escape") {
          setShowCommandPalette(false);
          setPaletteQuery("");
          setSelectedIndex(0);
        }
        return;
      }

      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette(true);
        setPaletteQuery("");
        setSelectedIndex(0);
        return;
      }

      // Grid keyboard navigation
      const projects = filteredProjects;
      if (projects.length === 0) return;

      // Arrow keys activate keyboard mode and navigate
      if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        setGridKeyboardMode(true);

        if (focusedProjectIndex === -1) {
          // First navigation - focus first project
          setFocusedProjectIndex(0);
        } else {
          let newIndex = focusedProjectIndex;

          if (e.key === "ArrowDown") {
            // Move down (assuming 3 columns in large screen)
            newIndex = Math.min(focusedProjectIndex + 3, projects.length - 1);
          } else if (e.key === "ArrowUp") {
            newIndex = Math.max(focusedProjectIndex - 3, 0);
          } else if (e.key === "ArrowRight") {
            newIndex = Math.min(focusedProjectIndex + 1, projects.length - 1);
          } else if (e.key === "ArrowLeft") {
            newIndex = Math.max(focusedProjectIndex - 1, 0);
          }

          setFocusedProjectIndex(newIndex);
        }
      }

      // Enter to select focused project
      if (e.key === "Enter" && gridKeyboardMode && focusedProjectIndex >= 0) {
        e.preventDefault();
        const project = projects[focusedProjectIndex];
        if (project) {
          handleProjectSelect(project.path);
        }
      }

      // S to toggle star on focused project
      if (e.key === "s" && gridKeyboardMode && focusedProjectIndex >= 0) {
        e.preventDefault();
        const project = projects[focusedProjectIndex];
        if (project) {
          toggleFavorite(project.path);
        }
      }

      // Escape to exit keyboard mode
      if (e.key === "Escape" && gridKeyboardMode) {
        setGridKeyboardMode(false);
        setFocusedProjectIndex(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showCommandPalette,
    gridKeyboardMode,
    focusedProjectIndex,
    filteredProjects,
    handleProjectSelect,
    toggleFavorite,
  ]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(getProjectsUrl());
      if (!response.ok) {
        throw new Error(`Failed to load projects: ${response.statusText}`);
      }
      const data: ProjectsResponse = await response.json();
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const loadSystemInfo = async () => {
    try {
      const response = await fetch("/api/terminal/info");
      if (response.ok) {
        const info: SystemInfo = await response.json();
        setSystemInfo(info);
      }
    } catch (error) {
      console.error("Failed to load system info:", error);
    }
  };

  const handleNewDirectory = async () => {
    if (!window.showDirectoryPicker) {
      alert("Directory picker not supported in this browser");
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker();
      const smartPath = generateSmartPath(dirHandle.name);

      setNewDirectoryPath(smartPath);
      setShowNewDirectoryInput(true);
      setValidationError(null);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Failed to select directory:", err);
      }
    }
  };

  const handleNewDirectorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirectoryPath) {
      setValidationError("Path cannot be empty.");
      return;
    }

    setValidationError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/terminal/validate-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: newDirectoryPath }),
      });

      const result = await response.json();

      if (response.ok && result.isValid) {
        const pathToUse = result.normalizedPath || newDirectoryPath;
        const normalizedPath = pathToUse.startsWith("/")
          ? pathToUse
          : `/${pathToUse}`;
        navigate(`/projects${normalizedPath}`);
      } else {
        setValidationError(
          result.message || "Invalid or inaccessible directory.",
        );
      }
    } catch (error) {
      console.error("Error validating path:", error);
      setValidationError("An error occurred during path validation.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettings = () => {
    navigate("/settings");
  };

  // Loading state
  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent" />
          <div className="text-secondary">{t("common.loading")}</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black-primary">
        <div className="text-accent">
          {t("common.error")}: {error}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Command Palette Modal */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCommandPalette(false)}
        >
          <div
            className="w-full max-w-2xl glass-card progressive-blur-heavy border-accent/30 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="p-4 border-b border-accent/20">
              <input
                type="text"
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handlePaletteKeyDown}
                placeholder="Search projects... (or press Esc to close)"
                className="w-full bg-transparent text-primary text-lg placeholder-tertiary focus:outline-none"
                autoFocus
              />
            </div>

            {/* Results List */}
            <div className="max-h-[400px] overflow-y-auto">
              {paletteResults.length > 0 ? (
                <div className="p-2">
                  {!paletteQuery && (
                    <div className="px-3 py-2 text-xs text-tertiary uppercase tracking-wider">
                      Recent Projects
                    </div>
                  )}
                  {paletteResults.map((project, index) => {
                    const metadata = getMetadata(project.path);
                    return (
                      <div
                        key={project.path}
                        className={`
                          flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer smooth-transition
                          ${index === selectedIndex ? "bg-gradient-primary text-primary" : "hover:bg-black-secondary/50"}
                        `}
                        onClick={() => handlePaletteSelect(project.path)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <FolderIcon
                          className={`h-5 w-5 ${index === selectedIndex ? "text-white" : "text-accent"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className={`font-semibold truncate ${index === selectedIndex ? "text-white" : "text-primary"}`}
                          >
                            {project.name}
                          </div>
                          <div
                            className={`text-xs font-mono truncate ${index === selectedIndex ? "text-white/70" : "text-tertiary"}`}
                          >
                            {truncatePath(project.path)}
                          </div>
                        </div>
                        {metadata.isFavorite && (
                          <StarIcon
                            className={`h-4 w-4 ${index === selectedIndex ? "text-white fill-white" : "text-accent fill-accent"}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-tertiary">
                  No projects found matching "{paletteQuery}"
                </div>
              )}
            </div>

            {/* Footer Hints */}
            <div className="p-3 border-t border-accent/20 flex items-center gap-4 text-xs text-tertiary">
              <span className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-black-secondary rounded border border-accent/20">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-black-secondary rounded border border-accent/20">
                  Enter
                </kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-black-secondary rounded border border-accent/20">
                  Esc
                </kbd>
                Close
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="min-h-screen bg-black-primary smooth-transition">
        <div className="max-w-7xl mx-auto p-6">
          {/* Hero Section */}
          <div className="mb-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-primary text-gradient text-4xl font-bold tracking-tight mb-2">
                  {t("project.title")}
                </h1>
                {systemInfo && (
                  <p className="text-tertiary text-sm">
                    {systemInfo.username}@{systemInfo.hostname}
                  </p>
                )}
              </div>
              <button
                onClick={handleOpenSettings}
                className="flex items-center gap-2 px-4 py-2 glass-card hover:glow-effect smooth-transition rounded-lg text-secondary hover:text-primary"
              >
                <CogIcon className="h-5 w-5" />
                <span>{t("nav.settings")}</span>
              </button>
            </div>

            {/* Search and Controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              {/* Search Bar */}
              <div className="flex-grow relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-tertiary pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-3 glass-input rounded-xl text-primary placeholder-tertiary focus:ring-2 focus:ring-accent focus:border-accent smooth-transition"
                />
                <button
                  onClick={() => setShowCommandPalette(true)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-black-secondary/50 rounded-md border border-accent/20 hover:border-accent/40 smooth-transition text-xs text-tertiary"
                  title="Open Command Palette"
                >
                  <span className="hidden sm:inline">⌘K</span>
                  <span className="sm:hidden">⌃K</span>
                </button>
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortMode}
                onChange={(e) => updateSortMode(e.target.value as SortMode)}
                className="px-4 py-3 glass-card rounded-xl text-primary bg-black-secondary border border-accent/20 focus:ring-2 focus:ring-accent smooth-transition cursor-pointer"
              >
                <option value="recent">Recent</option>
                <option value="name">Name</option>
                <option value="path">Path</option>
              </select>

              {/* Favorites Filter Toggle */}
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`
                flex items-center gap-2 px-4 py-3 rounded-xl smooth-transition font-medium
                ${
                  showFavoritesOnly
                    ? "bg-gradient-primary text-primary glow-effect"
                    : "glass-card text-secondary hover:text-primary"
                }
              `}
              >
                <StarIcon
                  className={`h-5 w-5 ${showFavoritesOnly ? "fill-current" : ""}`}
                />
                <span className="hidden sm:inline">Favorites</span>
              </button>
            </div>

            {/* New Project Button */}
            <button
              onClick={handleNewDirectory}
              className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-primary glow-effect hover:glow-border smooth-transition rounded-xl text-primary font-medium shadow-lg hover:shadow-xl"
            >
              <PlusIcon className="h-6 w-6" />
              <span>{t("project.custom")}</span>
            </button>

            {/* Path Input Form */}
            {showNewDirectoryInput && (
              <form
                onSubmit={handleNewDirectorySubmit}
                className="mt-4 p-4 glass-card rounded-xl space-y-3"
              >
                <label className="text-secondary text-sm">
                  Confirm or correct the suggested path:
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newDirectoryPath}
                    onChange={(e) => setNewDirectoryPath(e.target.value)}
                    placeholder="Enter full directory path..."
                    className="flex-grow glass-input px-3 py-2 rounded-lg text-primary bg-black-secondary border-accent/20 focus:ring-accent focus:border-accent"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-gradient-primary rounded-lg text-primary font-semibold smooth-transition glow-effect disabled:opacity-50"
                  >
                    {loading ? "Validating..." : "Go"}
                  </button>
                </div>
                {validationError && (
                  <p className="text-accent text-sm">{validationError}</p>
                )}
              </form>
            )}
          </div>

          {/* Recent Projects Section - Bento Grid */}
          {recentProjects.length > 0 && !showFavoritesOnly && !searchQuery && (
            <div className="mb-10">
              <h2 className="text-primary text-xl font-bold mb-4 flex items-center gap-2">
                <span>Recently Opened</span>
                <span className="text-accent text-sm font-normal">
                  ({recentProjects.length})
                </span>
              </h2>
              <div className="bento-grid">
                {recentProjects.map((project, index) => {
                  const metadata = getMetadata(project.path);
                  const bentoSize =
                    metadata.importance === "high"
                      ? "large"
                      : metadata.importance === "medium"
                        ? "medium"
                        : "normal";

                  // Check if this is the focused project
                  const isFocused =
                    gridKeyboardMode && focusedProjectIndex === index;

                  return (
                    <ProjectCard
                      key={project.path}
                      path={project.path}
                      name={project.name}
                      truncatedPath={truncatePath(project.path)}
                      metadata={metadata}
                      isRecent={true}
                      onSelect={() => handleProjectSelect(project.path)}
                      onToggleFavorite={() => toggleFavorite(project.path)}
                      getRelativeTime={getRelativeTime}
                      bentoSize={bentoSize}
                      isFocused={isFocused}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* All Projects Section */}
          <div>
            <h2 className="text-primary text-xl font-bold mb-4 flex items-center gap-2">
              <span>
                {showFavoritesOnly ? "Favorite Projects" : "All Projects"}
              </span>
              <span className="text-accent text-sm font-normal">
                ({filteredProjects.length})
              </span>
            </h2>

            {filteredProjects.length > 0 ? (
              <div className="bento-grid">
                {filteredProjects.map((project, index) => {
                  const metadata = getMetadata(project.path);
                  const bentoSize =
                    metadata.importance === "high"
                      ? "large"
                      : metadata.importance === "medium"
                        ? "medium"
                        : "normal";

                  // Check if this is the focused project
                  const isFocused =
                    gridKeyboardMode && focusedProjectIndex === index;

                  return (
                    <ProjectCard
                      key={project.path}
                      path={project.path}
                      name={project.name}
                      truncatedPath={truncatePath(project.path)}
                      metadata={metadata}
                      onSelect={() => handleProjectSelect(project.path)}
                      onToggleFavorite={() => toggleFavorite(project.path)}
                      getRelativeTime={getRelativeTime}
                      bentoSize={bentoSize}
                      isFocused={isFocused}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                onAddProject={handleNewDirectory}
                searchQuery={searchQuery}
                showFavoritesOnly={showFavoritesOnly}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
