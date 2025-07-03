import { useState, useEffect } from "react";
import { 
  FolderIcon, 
  FolderOpenIcon,
  DocumentIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  HomeIcon 
} from "@heroicons/react/24/outline";

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
  isExpanded?: boolean;
  size?: number;
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

  // Mock file system data
  const mockFileSystem: FileNode[] = [
    {
      name: "src",
      type: "folder",
      path: "/src",
      isExpanded: true,
      children: [
        {
          name: "components",
          type: "folder",
          path: "/src/components",
          isExpanded: false,
          children: [
            { name: "App.tsx", type: "file", path: "/src/components/App.tsx", size: 1024 },
            { name: "Button.tsx", type: "file", path: "/src/components/Button.tsx", size: 512 },
            { name: "Modal.tsx", type: "file", path: "/src/components/Modal.tsx", size: 768 },
          ],
        },
        {
          name: "hooks",
          type: "folder",
          path: "/src/hooks",
          isExpanded: false,
          children: [
            { name: "useAuth.ts", type: "file", path: "/src/hooks/useAuth.ts", size: 256 },
            { name: "useTheme.ts", type: "file", path: "/src/hooks/useTheme.ts", size: 384 },
          ],
        },
        { name: "main.tsx", type: "file", path: "/src/main.tsx", size: 512 },
        { name: "index.css", type: "file", path: "/src/index.css", size: 2048 },
      ],
    },
    {
      name: "public",
      type: "folder",
      path: "/public",
      isExpanded: false,
      children: [
        { name: "index.html", type: "file", path: "/public/index.html", size: 1024 },
        { name: "favicon.ico", type: "file", path: "/public/favicon.ico", size: 128 },
      ],
    },
    { name: "package.json", type: "file", path: "/package.json", size: 1536 },
    { name: "README.md", type: "file", path: "/README.md", size: 4096 },
    { name: "tsconfig.json", type: "file", path: "/tsconfig.json", size: 512 },
    { name: ".gitignore", type: "file", path: "/.gitignore", size: 256 },
  ];

  useEffect(() => {
    // Initialize with mock data
    setFileTree(mockFileSystem);
  }, []);

  const toggleFolder = (path: string) => {
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === path && node.type === "folder") {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };
    
    setFileTree(updateNode(fileTree));
  };

  const handleFileSelect = (path: string, type: "file" | "folder") => {
    if (type === "file") {
      setSelectedFile(path);
    } else {
      toggleFolder(path);
    }
  };

  const getFileIcon = (node: FileNode) => {
    if (node.type === "folder") {
      return node.isExpanded ? (
        <FolderOpenIcon className="w-4 h-4 text-blue-400" />
      ) : (
        <FolderIcon className="w-4 h-4 text-blue-500" />
      );
    }
    
    // Different icons based on file extension
    const extension = node.name.split('.').pop()?.toLowerCase();
    let iconColor = "text-gray-400";
    
    switch (extension) {
      case "tsx":
      case "ts":
        iconColor = "text-blue-400";
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
    const matchesSearch = searchTerm === "" || 
      node.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch && node.type === "file") {
      return null;
    }

    return (
      <div key={node.path}>
        <div
          onClick={() => handleFileSelect(node.path, node.type)}
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
              .filter(child => 
                searchTerm === "" || 
                child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (child.type === "folder" && child.children?.some(grandchild => 
                  grandchild.name.toLowerCase().includes(searchTerm.toLowerCase())
                ))
              )
              .map(child => renderFileNode(child, depth + 1))
            }
          </div>
        )}
      </div>
    );
  };

  const goHome = () => {
    setCurrentPath("~");
    setSelectedFile(null);
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
        <div className="flex items-center gap-2 text-secondary text-sm">
          <FolderIcon className="w-4 h-4 text-accent" />
          <span>Explorer - {currentPath}</span>
        </div>
        
        <button
          onClick={goHome}
          className="p-2 glass-button glow-border smooth-transition rounded-lg"
          aria-label="Home directory"
        >
          <HomeIcon className="w-4 h-4 text-accent" />
        </button>
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
          <div className="space-y-1">
            {fileTree.map(node => renderFileNode(node))}
          </div>
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
                total += n.children.reduce((sum, child) => sum + countItems(child), 0);
              }
              return total;
            };
            return count + countItems(node);
          }, 0)} items
        </span>
        
        {selectedFileDetails && (
          <span>Selected: {selectedFileDetails.name}</span>
        )}
      </div>
    </div>
  );
} 