import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderIcon, PlusIcon, CogIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
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

interface PathSelectionState {
  isOpen: boolean;
  directoryName: string;
  suggestedPath: string;
  customPath: string;
  isValidating: boolean;
  isValid: boolean | null;
  validationMessage: string;
}

export function ProjectSelector() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isValidatingPath, setIsValidatingPath] = useState(false);
  const [pathSelection, setPathSelection] = useState<PathSelectionState>({
    isOpen: false, // 默认关闭路径选择界面
    directoryName: "",
    suggestedPath: "",
    customPath: "",
    isValidating: false,
    isValid: null,
    validationMessage: ""
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
    loadSystemInfo();
  }, []);

  // 当systemInfo加载完成且路径选择界面打开时，生成智能路径建议
  useEffect(() => {
    if (systemInfo && pathSelection.isOpen && pathSelection.directoryName && !pathSelection.suggestedPath) {
      const smartPath = generateSmartPath(pathSelection.directoryName);
      setPathSelection(prev => ({
        ...prev,
        suggestedPath: smartPath,
        customPath: smartPath
      }));
    }
  }, [systemInfo, pathSelection.isOpen, pathSelection.directoryName]);

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
      const smartPath = generateSmartPath(dirHandle.name);
      const normalizedPath = smartPath.startsWith("/") ? smartPath : `/${smartPath}`;
      navigate(`/projects${normalizedPath}`);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Failed to select directory:", err);
      }
    }
  };

  const handleOpenSettings = () => {
    navigate("/settings");
  };

  // Generate smart path suggestions based on system info and common patterns
  const generateSmartPath = (directoryName: string): string => {
    if (!systemInfo) {
      return `/${directoryName}`;
    }

    const { platform, username, homeDirectory, currentWorkingDirectory, isWSL } = systemInfo;
    
    // 优先使用当前工作目录，如果它看起来像一个合理的项目位置
    if (currentWorkingDirectory && 
        (currentWorkingDirectory.includes("Desktop") || 
         currentWorkingDirectory.includes("Documents") || 
         currentWorkingDirectory.includes("Projects") ||
         currentWorkingDirectory.includes("dev") ||
         currentWorkingDirectory.includes("workspace") ||
         currentWorkingDirectory.includes("src"))) {
      // 确保路径格式正确
      const normalizedCwd = currentWorkingDirectory.replace(/\\/g, '/');
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
  };

  // Validate path by checking if it exists
  const validatePath = async (path: string): Promise<{ isValid: boolean; message: string }> => {
    if (!path.trim()) {
      return { isValid: false, message: "Path cannot be empty" };
    }

    try {
      // Call backend API to validate path
      const response = await fetch("/api/terminal/validate-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: path.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Validation request failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        isValid: result.isValid,
        message: result.message
      };
    } catch (error) {
      console.error("Path validation error:", error);
      return { 
        isValid: false, 
        message: "Unable to validate path - please check your input"
      };
    }
  };

  const handlePathInputChange = async (newPath: string) => {
    setPathSelection(prev => ({
      ...prev,
      customPath: newPath,
      isValidating: true
    }));

    // Debounce validation
    setTimeout(async () => {
      const validation = await validatePath(newPath);
      setPathSelection(prev => ({
        ...prev,
        isValidating: false,
        isValid: validation.isValid,
        validationMessage: validation.message
      }));
    }, 500);
  };

  const handleConfirmPath = () => {
    if (pathSelection.isValid && pathSelection.customPath) {
      const normalizedPath = pathSelection.customPath.startsWith("/") 
        ? pathSelection.customPath 
        : `/${pathSelection.customPath}`;
      
      setPathSelection(prev => ({ ...prev, isOpen: false }));
      navigate(`/projects${normalizedPath}`);
    }
  };

  const handleCancelPath = () => {
    setPathSelection({
      isOpen: false,
      directoryName: "",
      suggestedPath: "",
      customPath: "",
      isValidating: false,
      isValid: null,
      validationMessage: ""
    });
  };

  const getCommonPaths = (): string[] => {
    if (!systemInfo) return [];
    
    const { platform, username, homeDirectory, isWSL } = systemInfo;
    const { directoryName } = pathSelection;
    
    const paths: string[] = [];
    
    if (platform === "windows" && !isWSL) {
      // Native Windows environment - 使用正斜杠以便更好的兼容性
      paths.push(
        `C:/Users/${username}/Desktop/${directoryName}`,
        `C:/Users/${username}/Documents/${directoryName}`,
        `C:/Users/${username}/Projects/${directoryName}`,
        `C:/dev/${directoryName}`
      );
    } else if (platform === "windows" && isWSL) {
      // WSL environment - 优先提供Windows文件系统路径(/mnt/c/)，然后是WSL原生路径
      paths.push(
        `/mnt/c/Users/${username}/Desktop/${directoryName}`,
        `/mnt/c/Users/${username}/Documents/${directoryName}`,
        `/mnt/c/Users/${username}/Projects/${directoryName}`,
        `/mnt/c/dev/${directoryName}`,
        `${homeDirectory}/Desktop/${directoryName}`,
        `${homeDirectory}/Documents/${directoryName}`,
        `${homeDirectory}/Projects/${directoryName}`,
        `${homeDirectory}/dev/${directoryName}`,
        `/home/${username}/${directoryName}`
      );
    } else if (platform === "darwin") {
      paths.push(
        `/Users/${username}/Desktop/${directoryName}`,
        `/Users/${username}/Documents/${directoryName}`,
        `/Users/${username}/Projects/${directoryName}`,
        `/Users/${username}/dev/${directoryName}`
      );
    } else {
      // Linux
      paths.push(
        `${homeDirectory}/Desktop/${directoryName}`,
        `${homeDirectory}/Documents/${directoryName}`,
        `${homeDirectory}/Projects/${directoryName}`,
        `${homeDirectory}/dev/${directoryName}`,
        `/home/${username}/${directoryName}`
      );
    }
    
    return paths;
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
            disabled={isValidatingPath}
            className="w-full flex items-center gap-3 p-4 bg-gradient-primary glow-effect hover:glow-border smooth-transition rounded-lg text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidatingPath ? (
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full flex-shrink-0" />
            ) : (
              <PlusIcon className="h-5 w-5 text-primary flex-shrink-0" />
            )}
            <span className="text-primary font-medium">
              {isValidatingPath ? "Validating directory..." : "Select New Directory"}
            </span>
          </button>
        </div>
      </div>

      {/* Path Selection Modal */}
      {pathSelection.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-black-secondary border border-accent rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-primary text-xl font-bold">
                  Specify Directory Path
                </h3>
                <button
                  onClick={() => setPathSelection(prev => ({ ...prev, isOpen: false }))}
                  className="text-sm text-secondary hover:text-primary transition-colors px-3 py-1 rounded border border-accent hover:border-primary"
                >
                  View Existing Projects
                </button>
              </div>
              
              <p className="text-secondary mb-4">
                Selected directory: <span className="text-accent font-mono">{pathSelection.directoryName}</span>
              </p>
              
              <p className="text-secondary text-sm mb-4">
                Please specify the full path to this directory. Due to browser security restrictions, 
                we cannot automatically detect the complete path.
              </p>

              <div className="space-y-4">
                {/* Custom path input */}
                <div>
                  <label className="block text-secondary text-sm font-medium mb-2">
                    Full Path:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={pathSelection.customPath}
                      onChange={(e) => handlePathInputChange(e.target.value)}
                      className="w-full px-3 py-2 bg-black-tertiary border border-accent rounded-md text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Enter the full path to your directory..."
                    />
                    {pathSelection.isValidating && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full"></div>
                      </div>
                    )}
                    {!pathSelection.isValidating && pathSelection.isValid !== null && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {pathSelection.isValid ? (
                          <CheckIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <XMarkIcon className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {pathSelection.validationMessage && (
                    <p className={`text-sm mt-1 ${pathSelection.isValid ? 'text-green-500' : 'text-red-500'}`}>
                      {pathSelection.validationMessage}
                    </p>
                  )}
                </div>

                {/* Common path suggestions */}
                <div>
                  <label className="block text-secondary text-sm font-medium mb-2">
                    Common Locations:
                  </label>
                  <div className="space-y-2">
                    {getCommonPaths().map((path, index) => (
                      <button
                        key={index}
                        onClick={() => handlePathInputChange(path)}
                        className="w-full text-left px-3 py-2 bg-black-tertiary hover:bg-black-quaternary border border-transparent hover:border-accent rounded-md text-secondary hover:text-primary font-mono text-sm smooth-transition"
                      >
                        {path}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-accent">
                <button
                  onClick={handleCancelPath}
                  className="px-4 py-2 bg-black-tertiary text-secondary hover:text-primary hover:bg-black-quaternary rounded-md smooth-transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPath}
                  disabled={!pathSelection.isValid || pathSelection.isValidating}
                  className="px-4 py-2 bg-gradient-primary text-primary font-medium rounded-md hover:glow-effect smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Path
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
