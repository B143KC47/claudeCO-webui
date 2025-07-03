import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderIcon, PlusIcon, CogIcon } from "@heroicons/react/24/outline";
import type { ProjectsResponse, ProjectInfo } from "../types";
import { getProjectsUrl } from "../config/api";

export function ProjectSelector() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
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
      // Construct path from directory handle
      // Note: The actual path reconstruction might need adjustment based on browser capabilities
      const path = await getPathFromHandle(dirHandle);
      navigate(`/projects${path}`);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Failed to select directory:", err);
      }
    }
  };

  const handleOpenSettings = () => {
    navigate("/settings");
  };

  // Helper function to reconstruct path from directory handle
  // This is a simplified version - actual implementation may vary by browser
  const getPathFromHandle = async (
    handle: FileSystemDirectoryHandle,
  ): Promise<string> => {
    // For now, we'll use the handle name as the directory name
    // In a real implementation, you might need to reconstruct the full path
    // This is a browser limitation - full paths are not always available for security reasons
    const parts: string[] = [];
    const currentHandle: FileSystemDirectoryHandle | undefined = handle;

    while (currentHandle) {
      parts.unshift(currentHandle.name);
      // Note: This is a simplified approach
      // Getting parent directory is not directly supported in all browsers
      break;
    }

    // For local development, we'll prompt user to enter the full path
    const fullPath = prompt(
      `Please enter the full path for the selected directory "${handle.name}":`,
      `/Users/yo-sugi/dev/${handle.name}`,
    );

    return fullPath || `/${handle.name}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black-primary">
        <div className="text-secondary">
          Loading projects...
        </div>
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
