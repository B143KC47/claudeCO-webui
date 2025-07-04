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
  const navigate = useNavigate();

  // Generate smart path suggestions based on system info and common patterns
  const generateSmartPath = useCallback(
    (directoryName: string): string => {
      if (!systemInfo) {
        return `/${directoryName}`;
      }

      const {
        platform,
        username,
        homeDirectory,
        currentWorkingDirectory,
        isWSL,
      } = systemInfo;

      // 优先使用当前工作目录，如果它看起来像一个合理的项目位置
      if (
        currentWorkingDirectory &&
        (currentWorkingDirectory.includes("Desktop") ||
          currentWorkingDirectory.includes("Documents") ||
          currentWorkingDirectory.includes("Projects") ||
          currentWorkingDirectory.includes("dev") ||
          currentWorkingDirectory.includes("workspace") ||
          currentWorkingDirectory.includes("src"))
      ) {
        // 确保路径格式正确
        const normalizedCwd = currentWorkingDirectory.replace(/\\/g, "/");
        return `${normalizedCwd}/${directoryName}`;
      }

      // WSL环境下优先使用Windows文件系统路径
      if (platform === "windows" && isWSL) {
        // WSL环境 - 优先使用/mnt/c/路径，因为用户通常使用Windows文件系统
        return `/mnt/c/Users/${username}/Desktop/${directoryName}`;
      } else if (platform === "windows" && !isWSL) {
        // Native Windows environment
        return `C:/Users/${username}/Desktop/${directoryName}`;
      } else if (platform === "darwin") {
        // macOS
        return `/Users/${username}/Desktop/${directoryName}`;
      } else {
        // Linux
        return `${homeDirectory}/Desktop/${directoryName}`;
      }
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

      // Log the selected directory name for debugging
      console.log(
        "[Directory Picker] Selected directory name:",
        dirHandle.name,
      );
      console.log("[Directory Picker] Directory handle:", dirHandle);

      // Generate smart path suggestion based on system info
      const smartPath = generateSmartPath(dirHandle.name);
      console.log("[Directory Picker] Generated smart path:", smartPath);

      // Validate the path and get the normalized WSL path if needed
      try {
        console.log("[Directory Picker] Validating path:", smartPath);
        const response = await fetch("/api/terminal/validate-path", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: smartPath }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log("[Directory Picker] Validation result:", result);

          // Use normalized path if available (for WSL conversion), otherwise use smart path
          const pathToUse = result.normalizedPath || smartPath;
          console.log("[Directory Picker] Final path to use:", pathToUse);

          // Navigate directly to the project with the correct path
          const normalizedPath = pathToUse.startsWith("/")
            ? pathToUse
            : `/${pathToUse}`;
          console.log(
            "[Directory Picker] Navigating to:",
            `/projects${normalizedPath}`,
          );
          navigate(`/projects${normalizedPath}`);
        } else {
          // If validation fails, still navigate with the smart path
          console.warn(
            "[Directory Picker] Path validation failed, using smart path",
          );
          const normalizedPath = smartPath.startsWith("/")
            ? smartPath
            : `/${smartPath}`;
          navigate(`/projects${normalizedPath}`);
        }
      } catch (error) {
        console.error("[Directory Picker] Error validating path:", error);
        // On error, still navigate with the smart path
        const normalizedPath = smartPath.startsWith("/")
          ? smartPath
          : `/${smartPath}`;
        navigate(`/projects${normalizedPath}`);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Failed to select directory:", err);
      }
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
        </div>
      </div>
    </div>
  );
}
