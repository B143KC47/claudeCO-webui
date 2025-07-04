import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FolderIcon, PlusIcon, CogIcon } from "@heroicons/react/24/outline";
import type { ProjectsResponse, ProjectInfo } from "../types";
import { getProjectsUrl } from "../config/api";

interface SystemInfo {
  username: string;
  hostname: string;
  platform: string;
  homeDirectory: string;
  currentWorkingDirectory: string;
  isWSL: boolean;
}

export function ProjectSelector() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [showNewDirectoryInput, setShowNewDirectoryInput] = useState(false);
  const [newDirectoryPath, setNewDirectoryPath] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Generate smart path suggestions based on system info and common patterns
  const generateSmartPath = useCallback(
    (directoryName: string): string => {
      if (!systemInfo) {
        return `/${directoryName}`;
      }

      const {
        username,
        homeDirectory,
        currentWorkingDirectory,
        isWSL,
      } = systemInfo;

      let basePath = currentWorkingDirectory;

      // In WSL, if the current directory is the WSL home (`/home/...`),
      // but the detected home directory is a Windows path (`/mnt/c/Users/...`),
      // prefer the Windows path for the suggestion.
      if (
        isWSL &&
        currentWorkingDirectory.startsWith("/home/") &&
        homeDirectory.startsWith("/mnt/")
      ) {
        basePath = homeDirectory;
      }

      // If the base path doesn't look like a typical development area,
      // append "/Desktop" as a sensible default.
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

  useEffect(() => {
    loadProjects();
    loadSystemInfo();
  }, []);

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

  const handleProjectSelect = (projectPath: string) => {
    const normalizedPath = projectPath.startsWith("/")
      ? projectPath
      : `/${projectPath}`;
    navigate(`/projects${normalizedPath}`);
  };

  const handleNewDirectory = async () => {
    if (!window.showDirectoryPicker) {
      alert("Directory picker not supported in this browser");
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker();
      console.log(
        "[Directory Picker] Selected directory name:",
        dirHandle.name,
      );

      const smartPath = generateSmartPath(dirHandle.name);
      console.log("[Directory Picker] Generated smart path:", smartPath);

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
      console.log("[Directory Input] Validating path:", newDirectoryPath);
      const response = await fetch("/api/terminal/validate-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: newDirectoryPath }),
      });

      const result = await response.json();
      console.log("[Directory Input] Validation result:", result);

      if (response.ok && result.isValid) {
        const pathToUse = result.normalizedPath || newDirectoryPath;
        const normalizedPath = pathToUse.startsWith("/")
          ? pathToUse
          : `/${pathToUse}`;
        console.log(
          "[Directory Input] Navigating to:",
          `/projects${normalizedPath}`,
        );
        navigate(`/projects${normalizedPath}`);
      } else {
        setValidationError(
          result.message || "Invalid or inaccessible directory.",
        );
      }
    } catch (error) {
      console.error("[Directory Input] Error validating path:", error);
      setValidationError("An error occurred during path validation.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettings = () => {
    navigate("/settings");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black-primary">
        <div className="text-secondary">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black-primary">
        <div className="text-accent">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black-primary smooth-transition">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-primary text-gradient text-3xl font-bold tracking-tight">
            Select a Project
          </h1>
          <button
            onClick={handleOpenSettings}
            className="flex items-center gap-2 px-4 py-2 glass-card hover:glow-effect smooth-transition rounded-lg text-secondary hover:text-primary"
          >
            <CogIcon className="h-5 w-5" />
            <span>Settings</span>
          </button>
        </div>

        <div className="space-y-3">
          {projects.length > 0 && (
            <>
              <h2 className="text-secondary text-lg font-medium mb-4">
                Recent Projects
              </h2>
              {projects.map((project) => (
                <button
                  key={project.path}
                  onClick={() => handleProjectSelect(project.path)}
                  className="w-full flex items-center gap-3 p-4 glass-card hover:glow-effect smooth-transition rounded-lg text-left"
                >
                  <FolderIcon className="h-5 w-5 text-accent flex-shrink-0" />
                  <span className="text-primary font-mono text-sm">
                    {project.path}
                  </span>
                </button>
              ))}
              <div className="my-6 border-t border-accent" />
            </>
          )}

          <button
            onClick={handleNewDirectory}
            className="w-full flex items-center gap-3 p-4 bg-gradient-primary glow-effect hover:glow-border smooth-transition rounded-lg text-left"
          >
            <PlusIcon className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="text-primary font-medium">
              Select New Directory
            </span>
          </button>

          {showNewDirectoryInput && (
            <form
              onSubmit={handleNewDirectorySubmit}
              className="p-4 glass-card space-y-3"
            >
              <label className="text-secondary text-sm">
                Confirm or correct the suggested path:
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newDirectoryPath}
                  onChange={(e) => setNewDirectoryPath(e.target.value)}
                  placeholder="Enter full directory path (e.g., C:\Users\user\project or /home/user/project)"
                  className="flex-grow glass-input px-3 py-2 rounded-lg text-primary bg-black-secondary border-accent focus:ring-accent focus:border-accent"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 glass-button rounded-lg bg-accent text-primary font-semibold disabled:opacity-50"
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
      </div>
    </div>
  );
}
