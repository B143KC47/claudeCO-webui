import { useState, useEffect } from "react";
import {
  FolderIcon,
  FolderOpenIcon,
  DocumentIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  HomeIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type { FileItem, ListFilesRequest, ListFilesResponse } from "../../types";

interface FileNode extends FileItem {
  children?: FileNode[];
  isExpanded?: boolean;
  lastModified?: Date;
}

interface ExplorerPanelProps {
  workingDirectory?: string;
}

export function ExplorerPanel({ workingDirectory = "~" }: ExplorerPanelProps) {
  const [currentPath, setCurrentPath] = useState(workingDirectory);
  const [searchTerm, setSearchTerm] = useState("");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load files from the current directory
  const loadFiles = async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("[Explorer] Loading files for path:", path);
      console.log("[Explorer] Current workingDirectory prop:", workingDirectory);
      
      const request: ListFilesRequest = { path };
      const response = await fetch("/api/files/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      console.log("[Explorer] API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Explorer] API error response:", errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ListFilesResponse = await response.json();
      console.log("[Explorer] API response data:", data);

      // Convert FileItem[] to FileNode[] for the tree structure
      const nodes: FileNode[] = data.files.map(file => ({
        ...file,
        isExpanded: false,
        lastModified: file.lastModified ? new Date(file.lastModified) : undefined,
      }));

      console.log("[Explorer] Converted to file nodes:", nodes.length, "items");
      setFileTree(nodes);
      setCurrentPath(data.currentPath);
    } catch (err) {
      console.error("[Explorer] Failed to load files:", err);
      setError(err instanceof Error ? err.message : "Failed to load files");
      setFileTree([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("[Explorer] Initial load with currentPath:", currentPath);
    loadFiles(currentPath);
  }, []);

  // Update when workingDirectory prop changes
  useEffect(() => {
    console.log("[Explorer] workingDirectory prop changed:", workingDirectory);
    console.log("[Explorer] currentPath state:", currentPath);
    
    if (workingDirectory && workingDirectory !== currentPath) {
      console.log("[Explorer] Updating to new working directory:", workingDirectory);
      setCurrentPath(workingDirectory);
      loadFiles(workingDirectory);
    }
  }, [workingDirectory]);

  const toggleFolder = async (path: string) => {
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.path === path && node.type === "folder") {
          // If expanding and no children loaded yet, we'll load them
          const wasExpanded = node.isExpanded;
          const newNode = { ...node, isExpanded: !node.isExpanded };
          
          // Load children when expanding for the first time
          if (!wasExpanded && !node.children) {
            loadFolderChildren(path, newNode);
          }
          
          return newNode;
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };

    setFileTree(updateNode(fileTree));
  };

  const loadFolderChildren = async (folderPath: string, parentNode: FileNode) => {
    try {
      console.log("[Explorer] Loading children for folder:", folderPath);
      console.log("[Explorer] Parent node:", parentNode.name);
      
      const request: ListFilesRequest = { path: folderPath };
      const response = await fetch("/api/files/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      console.log("[Explorer] Folder children API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`[Explorer] Failed to load children for ${folderPath}:`, errorData);
        return;
      }

      const data: ListFilesResponse = await response.json();
      console.log("[Explorer] Folder children API response:", data);
      
      // Convert to FileNode format
      const children: FileNode[] = data.files.map(file => ({
        ...file,
        isExpanded: false,
        lastModified: file.lastModified ? new Date(file.lastModified) : undefined,
      }));

      console.log("[Explorer] Converted folder children:", children.length, "items");

      // Update the tree with the loaded children
      const updateWithChildren = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.path === folderPath) {
            console.log("[Explorer] Updating node with children:", node.name, children.length, "children");
            return { ...node, children };
          }
          if (node.children) {
            return { ...node, children: updateWithChildren(node.children) };
          }
          return node;
        });
      };

      setFileTree(updateWithChildren);
    } catch (error) {
      console.error(`[Explorer] Failed to load children for ${folderPath}:`, error);
    }
  };

  const handleFileSelect = async (path: string, type: "file" | "folder") => {
    if (type === "file") {
      setSelectedFile(path);
    } else {
      await toggleFolder(path);
    }
  };

  const getFileIcon = (node: FileNode) => {
    if (node.type === "folder") {
      return node.isExpanded ? (
        <FolderOpenIcon className="w-4 h-4 text-orange-400" />
      ) : (
        <FolderIcon className="w-4 h-4 text-orange-500" />
      );
    }

    // Different icons based on file extension
    const extension = node.name.split(".").pop()?.toLowerCase();
    let iconColor = "text-gray-400";

    switch (extension) {
      case "tsx":
      case "ts":
        iconColor = "text-orange-400";
        break;
      case "js":
      case "jsx":
        iconColor = "text-yellow-400";
        break;
      case "css":
      case "scss":
        iconColor = "text-pink-400";
        break;
      case "json":
        iconColor = "text-green-400";
        break;
      case "md":
        iconColor = "text-purple-400";
        break;
      case "html":
        iconColor = "text-orange-400";
        break;
    }

    return <DocumentIcon className={`w-4 h-4 ${iconColor}`} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderFileNode = (node: FileNode, depth = 0) => {
    const isSelected = selectedFile === node.path;
    const matchesSearch =
      searchTerm === "" ||
      node.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch && node.type === "file") {
      return null;
    }

    return (
      <div key={node.path}>
        <div
          onClick={() => handleFileSelect(node.path, node.type)}
          onDoubleClick={() => {
            if (node.type === "folder") {
              setCurrentPath(node.path);
              setSelectedFile(null);
              loadFiles(node.path);
            }
          }}
          className={`
            flex items-center gap-2 px-2 py-1 rounded cursor-pointer smooth-transition
            ${isSelected ? "bg-accent/20 text-primary" : "text-secondary hover:text-primary hover:bg-black-secondary/50"}
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {node.type === "folder" && (
            <div className="w-4 h-4 flex items-center justify-center">
              {node.isExpanded ? (
                <ChevronDownIcon className="w-3 h-3 text-tertiary" />
              ) : (
                <ChevronRightIcon className="w-3 h-3 text-tertiary" />
              )}
            </div>
          )}

          {getFileIcon(node)}

          <span className="text-sm flex-1 truncate">{node.name}</span>

          {node.type === "file" && node.size && (
            <span className="text-xs text-tertiary">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>

        {node.type === "folder" && node.isExpanded && node.children && (
          <div>
            {node.children
              .filter(
                (child) =>
                  searchTerm === "" ||
                  child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (child.type === "folder" &&
                    child.children?.some((grandchild) =>
                      grandchild.name
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()),
                    )),
              )
              .map((child) => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const goHome = () => {
    const homePath = "~";
    setCurrentPath(homePath);
    setSelectedFile(null);
    loadFiles(homePath);
  };

  const getSelectedFileDetails = () => {
    if (!selectedFile) return null;

    const findFile = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.path === selectedFile) return node;
        if (node.children) {
          const found = findFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    return findFile(fileTree);
  };

  const selectedFileDetails = getSelectedFileDetails();

  return (
    <div className="space-y-4">
      {/* Explorer Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-secondary text-sm min-w-0 flex-1">
          <FolderIcon className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="truncate">Explorer - {currentPath}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Parent Directory Button */}
          {currentPath !== "/" && currentPath !== "~" && (
            <button
              onClick={() => {
                const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
                setCurrentPath(parentPath);
                setSelectedFile(null);
                loadFiles(parentPath);
              }}
              className="p-2 glass-button glow-border smooth-transition rounded-lg"
              aria-label="Parent directory"
              title="Go to parent directory"
            >
              <ChevronRightIcon className="w-4 h-4 text-accent rotate-180" />
            </button>
          )}
          
          {/* Home Button */}
          <button
            onClick={goHome}
            className="p-2 glass-button glow-border smooth-transition rounded-lg"
            aria-label="Home directory"
            title="Go to home directory"
          >
            <HomeIcon className="w-4 h-4 text-accent" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search files and folders..."
          className="w-full px-4 py-2 pl-10 glass-input text-primary placeholder-text-tertiary rounded-lg text-sm"
        />
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-tertiary" />
      </div>

      {/* File Tree */}
      <div className="flex gap-4" style={{ height: "350px" }}>
        {/* Tree View */}
        <div className="flex-1 glass-card rounded-lg p-3 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-secondary text-sm">Loading files...</div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2">
              <ExclamationTriangleIcon className="w-8 h-8 text-accent" />
              <div className="text-accent text-sm text-center">{error}</div>
              <button
                onClick={() => loadFiles(currentPath)}
                className="px-3 py-1 text-xs glass-button rounded"
              >
                Retry
              </button>
            </div>
          ) : fileTree.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-tertiary text-sm">No files found</div>
            </div>
          ) : (
            <div className="space-y-1">
              {fileTree.map((node) => renderFileNode(node))}
            </div>
          )}
        </div>

        {/* File Details */}
        <div className="w-48 glass-card rounded-lg p-3">
          {selectedFileDetails ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {getFileIcon(selectedFileDetails)}
                <span className="text-sm font-medium text-primary truncate">
                  {selectedFileDetails.name}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-tertiary">Type:</span>
                  <span className="text-secondary ml-1 capitalize">
                    {selectedFileDetails.type}
                  </span>
                </div>

                {selectedFileDetails.size && (
                  <div>
                    <span className="text-tertiary">Size:</span>
                    <span className="text-secondary ml-1">
                      {formatFileSize(selectedFileDetails.size)}
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-tertiary">Path:</span>
                  <div className="text-secondary text-xs mt-1 break-all">
                    {selectedFileDetails.path}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-tertiary text-sm">
              Select a file to view details
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="text-xs text-tertiary flex items-center justify-between">
        <span>
          {fileTree.reduce((count, node) => {
            const countItems = (n: FileNode): number => {
              let total = 1;
              if (n.children) {
                total += n.children.reduce(
                  (sum, child) => sum + countItems(child),
                  0,
                );
              }
              return total;
            };
            return count + countItems(node);
          }, 0)}{" "}
          items
        </span>

        {selectedFileDetails && (
          <span>Selected: {selectedFileDetails.name}</span>
        )}
      </div>
    </div>
  );
}
