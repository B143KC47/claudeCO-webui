import { useState, useEffect } from "react";
import { 
  ServerIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  PlayIcon, 
  StopIcon,
  MagnifyingGlassIcon,
  CloudArrowDownIcon,
  TrashIcon,
  PlusIcon,
  GlobeAltIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  FunnelIcon
} from "@heroicons/react/24/outline";
import { getApiUrl } from "../../config/api";
import { SmitheryAuthComponent } from "./SmitheryAuthComponent";

interface MCPServer {
  name: string;
  status: "running" | "stopped" | "error" | "unknown";
  type: string;
  description: string;
  customDescription?: string;
  category?: string;
  tools?: string[];
  url?: string;
  source?: "local" | "smithery";
  smitheryId?: string;
  monthlyToolCalls?: number;
  successRate?: number;
  license?: string;
  homepage?: string;
  sourceCode?: string;
}

interface SmitheryServer {
  id: string;
  name: string;
  description: string;
  tools: string[];
  monthlyToolCalls: number;
  successRate: number;
  license: string;
  isLocal: boolean;
  homepage?: string;
  sourceCode?: string;
  author?: string;
  tags?: string[];
}

interface MCPResponse {
  servers: MCPServer[];
  nativeServerStatus: "running" | "stopped" | "unknown";
}

export function MCPTab() {
  const [mcpData, setMcpData] = useState<MCPResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"installed" | "browse">("installed");
  
  // Smithery.ai integration state
  const [smitheryServers, setSmitheryServers] = useState<SmitheryServer[]>([]);
  const [smitheryLoading, setSmitheryLoading] = useState(false);
  const [smitheryError, setSmitheryError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [installing, setInstalling] = useState<Set<string>>(new Set());

  // 新增：OAuth认证状态
  const [smitheryToken, setSmitheryToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // 新增状态：编辑功能
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{customDescription: string; category: string}>({
    customDescription: "",
    category: ""
  });
  
  // 新增状态：分类管理
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    loadMCPData();
    loadCategories();
  }, []);

  useEffect(() => {
    if (activeTab === "browse" && smitheryToken) {
      loadSmitheryServers();
    }
  }, [activeTab, smitheryToken]);

  const loadCategories = async () => {
    try {
      const response = await fetch(getApiUrl("/api/mcp/categories"));
      if (response.ok) {
        const data = await response.json();
        setAvailableCategories(data.categories || []);
      }
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  };

  const loadMCPData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(getApiUrl("/api/mcp"));
      if (!response.ok) {
        throw new Error(`Failed to load MCP data: ${response.statusText}`);
      }
      
      const data = await response.json();
      setMcpData(data);
    } catch (err) {
      console.error("Error loading MCP data:", err);
      setError(err instanceof Error ? err.message : "Failed to load MCP data");
    } finally {
      setLoading(false);
    }
  };

  const loadSmitheryServers = async () => {
    if (!smitheryToken) {
      setSmitheryError("请先登录以访问Smithery服务器注册表");
      return;
    }

    try {
      setSmitheryLoading(true);
      setSmitheryError(null);
      
      // Call backend to get Smithery servers with authentication
      const response = await fetch(getApiUrl("/api/mcp/smithery"), {
        headers: {
          'Authorization': `Bearer ${smitheryToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("认证失败，请重新登录");
        }
        throw new Error(`Failed to load Smithery servers: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSmitheryServers(data.servers || []);
    } catch (err) {
      console.error("Error loading Smithery servers:", err);
      setSmitheryError(err instanceof Error ? err.message : "Failed to load Smithery servers");
    } finally {
      setSmitheryLoading(false);
    }
  };

  // OAuth认证成功处理
  const handleAuthSuccess = (token: string) => {
    setSmitheryToken(token);
    setAuthError(null);
    // 立即加载服务器列表
    if (activeTab === "browse") {
      loadSmitheryServers();
    }
  };

  // OAuth认证失败处理
  const handleAuthError = (error: string) => {
    setAuthError(error);
    setSmitheryToken(null);
  };

  // 过滤服务器
  const filteredSmitheryServers = smitheryServers.filter(server => {
    const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         server.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || 
                           server.tags?.includes(selectedCategory) ||
                           server.description.toLowerCase().includes(selectedCategory.replace("-", " "));
    return matchesSearch && matchesCategory;
  });

  const handleInstallServer = async (server: SmitheryServer) => {
    try {
      setInstalling(prev => new Set(prev).add(server.id));
      
      const response = await fetch(getApiUrl("/api/mcp/install"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId: server.id,
          serverName: server.name,
          serverUrl: `server.smithery.ai/${server.id}`
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to install server: ${response.statusText}`);
      }
      
      // Refresh local MCP data after installation
      await loadMCPData();
      
      // Show success message or notification
      alert(`Successfully installed ${server.name}!`);
      
    } catch (err) {
      console.error("Error installing server:", err);
      alert(`Failed to install ${server.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setInstalling(prev => {
        const newSet = new Set(prev);
        newSet.delete(server.id);
        return newSet;
      });
    }
  };

  const handleUninstallServer = async (server: MCPServer) => {
    try {
      if (!server.smitheryId) return;
      
      setInstalling(prev => new Set(prev).add(server.smitheryId!));
      
      const response = await fetch(getApiUrl("/api/mcp/uninstall"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverName: server.name,
          smitheryId: server.smitheryId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to uninstall server: ${response.statusText}`);
      }
      
      // Refresh local MCP data after uninstallation
      await loadMCPData();
      
      alert(`Successfully uninstalled ${server.name}!`);
      
    } catch (err) {
      console.error("Error uninstalling server:", err);
      alert(`Failed to uninstall ${server.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setInstalling(prev => {
        const newSet = new Set(prev);
        newSet.delete(server.smitheryId!);
        return newSet;
      });
    }
  };

  const handleRefresh = () => {
    loadMCPData();
    if (activeTab === "browse") {
      loadSmitheryServers();
    }
  };

  // Check if a Smithery server is already installed
  const isServerInstalled = (smitheryId: string) => {
    return mcpData?.servers.some(server => server.smitheryId === smitheryId) || false;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <CheckCircleIcon className="h-5 w-5 text-emerald-500" />;
      case "stopped":
        return <StopIcon className="h-5 w-5 text-gray-400" />;
      case "error":
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ServerIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "running":
        return "Running";
      case "stopped":
        return "Stopped";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-emerald-500";
      case "stopped":
        return "text-gray-400";
      case "error":
        return "text-red-500";
      default:
        return "text-gray-400";
    }
  };

  const renderSmitheryBrowserTab = () => {
    // 如果未认证，显示认证组件
    if (!smitheryToken) {
      return (
        <div className="space-y-6">
          <SmitheryAuthComponent
            onAuthSuccess={handleAuthSuccess}
            onAuthError={handleAuthError}
            isLoading={smitheryLoading}
          />
          
          {authError && (
            <div className="glass-card p-6 border border-red-500/20">
              <div className="flex items-center space-x-3 mb-4">
                <XCircleIcon className="h-6 w-6 text-red-500" />
                <h3 className="text-lg font-semibold text-primary">认证错误</h3>
              </div>
              <p className="text-red-400">{authError}</p>
            </div>
          )}
          
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-primary mb-4">关于Smithery集成</h3>
            <div className="space-y-3 text-sm text-gray-400">
              <p>
                Smithery是一个大型的MCP服务器注册表，提供来自社区的数千个服务器。
                通过GitHub OAuth登录，您可以：
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>浏览和搜索可用的MCP服务器</li>
                <li>查看服务器统计信息和使用情况</li>
                <li>一键安装服务器到您的配置中</li>
                <li>访问源代码和文档</li>
              </ul>
              <p className="text-xs text-tertiary mt-4">
                我们使用GitHub OAuth来安全地验证您的身份，不会访问您的私有数据。
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (smitheryLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          <span className="ml-3 text-gray-300">Loading Smithery registry...</span>
        </div>
      );
    }

    if (smitheryError) {
      return (
        <div className="glass-card p-6 border border-red-500/20">
          <div className="flex items-center space-x-3 mb-4">
            <XCircleIcon className="h-6 w-6 text-red-500" />
            <h3 className="text-lg font-semibold text-primary">Error Loading Smithery Registry</h3>
          </div>
          <p className="text-red-400 mb-4">{smitheryError}</p>
          <button
            onClick={() => loadSmitheryServers()}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Search and Filter Controls */}
        <div className="glass-card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search MCP servers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-black/20 border border-gray-600 rounded-lg text-primary placeholder-gray-400 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 bg-black/20 border border-gray-600 rounded-lg text-primary focus:border-orange-500 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="web-search">Web Search</option>
              <option value="browser-automation">Browser Automation</option>
              <option value="project-management">Project Management</option>
              <option value="ai-codebase">AI Codebase Analysis</option>
              <option value="llm-integration">LLM Integration</option>
            </select>
          </div>
        </div>

        {/* Smithery Servers Grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSmitheryServers.map((server) => {
            const isInstalled = isServerInstalled(server.id);
            const isInstalling = installing.has(server.id);
            
            return (
              <div key={server.id} className="glass-card p-4 hover:border-orange-500/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <GlobeAltIcon className="h-5 w-5 text-orange-500" />
                    <h4 className="font-medium text-primary truncate">{server.name}</h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isInstalled ? (
                      <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <button
                        onClick={() => handleInstallServer(server)}
                        disabled={isInstalling}
                        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors flex items-center space-x-1"
                      >
                        {isInstalling ? (
                          <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full" />
                        ) : (
                          <CloudArrowDownIcon className="h-3 w-3" />
                        )}
                        <span>{isInstalling ? "Installing..." : "Install"}</span>
                      </button>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-gray-400 mb-3 line-clamp-3">{server.description}</p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span>{server.monthlyToolCalls.toLocaleString()} calls/month</span>
                  <span>{server.successRate}% success rate</span>
                </div>
                
                {server.tools && server.tools.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-primary mb-1">Tools:</p>
                    <div className="flex flex-wrap gap-1">
                      {server.tools.slice(0, 3).map((tool, toolIndex) => (
                        <span
                          key={toolIndex}
                          className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs rounded border border-orange-500/20"
                        >
                          {tool}
                        </span>
                      ))}
                      {server.tools.length > 3 && (
                        <span className="px-2 py-1 bg-gray-500/10 text-gray-400 text-xs rounded border border-gray-500/20">
                          +{server.tools.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{server.license}</span>
                  {server.sourceCode && (
                    <a
                      href={server.sourceCode}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      Source Code
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredSmitheryServers.length === 0 && !smitheryLoading && (
          <div className="text-center py-8">
            <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No servers found</p>
            <p className="text-sm text-gray-500">Try adjusting your search terms or category filter</p>
          </div>
        )}
      </div>
    );
  };

  // 新增：开始编辑服务器
  const handleEditServer = (server: MCPServer) => {
    setEditingServer(server.name);
    setEditForm({
      customDescription: server.customDescription || server.description,
      category: server.category || "其他"
    });
  };

  // 新增：保存编辑
  const handleSaveEdit = async () => {
    if (!editingServer) return;

    try {
      const response = await fetch(getApiUrl("/api/mcp/update"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverName: editingServer,
          customDescription: editForm.customDescription,
          category: editForm.category
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update server: ${response.statusText}`);
      }

      // 刷新数据
      await loadMCPData();
      
      // 重置编辑状态
      setEditingServer(null);
      setEditForm({ customDescription: "", category: "" });
      
      alert("Server configuration updated successfully!");
      
    } catch (err) {
      console.error("Error updating server:", err);
      alert(`Failed to update server: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // 新增：取消编辑
  const handleCancelEdit = () => {
    setEditingServer(null);
    setEditForm({ customDescription: "", category: "" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="ml-3 text-gray-300">Loading MCP configuration...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-6 border border-red-500/20">
          <div className="flex items-center space-x-3 mb-4">
            <XCircleIcon className="h-6 w-6 text-red-500" />
            <h3 className="text-lg font-semibold text-primary">Error Loading MCP Data</h3>
          </div>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!mcpData) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-400">No MCP data available</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-2">MCP Server Management</h2>
          <p className="text-gray-400">
            Manage local servers and browse Smithery.ai registry
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card p-1">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("installed")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "installed"
                ? "bg-orange-600 text-white"
                : "text-gray-400 hover:text-primary hover:bg-gray-700/30"
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <ServerIcon className="h-4 w-4" />
              <span>Installed Servers</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("browse")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "browse"
                ? "bg-orange-600 text-white"
                : "text-gray-400 hover:text-primary hover:bg-gray-700/30"
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <GlobeAltIcon className="h-4 w-4" />
              <span>Browse Smithery.ai</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "installed" && (
        <div className="space-y-6">
          {/* Native MCP Server Status */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <ServerIcon className="h-6 w-6 text-orange-500" />
                <h3 className="text-lg font-semibold text-primary">Native Claude Code Server</h3>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(mcpData.nativeServerStatus)}
                <span className={`font-medium ${getStatusColor(mcpData.nativeServerStatus)}`}>
                  {getStatusText(mcpData.nativeServerStatus)}
                </span>
              </div>
            </div>
            <p className="text-gray-400 text-sm">
              Built-in MCP server providing access to Claude Code's native tools and capabilities.
            </p>
          </div>

          {/* MCP Servers List */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Configured MCP Servers</h3>
              
              {/* 分类筛选器 */}
              {mcpData.servers.length > 0 && (
                <div className="flex items-center space-x-3">
                  <FunnelIcon className="h-4 w-4 text-gray-400" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-black/20 border border-gray-600 rounded-lg px-3 py-1 text-sm text-primary focus:outline-none focus:border-orange-500"
                  >
                    <option value="all">All Categories</option>
                    {availableCategories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            {mcpData.servers.length === 0 ? (
              <div className="text-center py-8">
                <ServerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">No MCP servers configured</p>
                <p className="text-sm text-gray-500 mb-4">
                  Use <code className="bg-black/20 px-2 py-1 rounded">claude mcp add</code> to add servers
                  or browse the Smithery.ai registry to discover new servers.
                </p>
                <button
                  onClick={() => setActiveTab("browse")}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center space-x-2 mx-auto"
                >
                  <GlobeAltIcon className="h-4 w-4" />
                  <span>Browse Smithery.ai</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {mcpData.servers
                  .filter(server => categoryFilter === "all" || server.category === categoryFilter)
                  .map((server, index) => {
                  const isSmitheryServer = server.source === "smithery";
                  const isUninstalling = server.smitheryId && installing.has(server.smitheryId);
                  const isEditing = editingServer === server.name;
                  
                  return (
                    <div key={index} className="border border-gray-700/30 rounded-lg p-4 hover:border-orange-500/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(server.status)}
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium text-primary">{server.name}</h4>
                              {isSmitheryServer && (
                                <span className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs rounded border border-orange-500/20">
                                  Smithery
                                </span>
                              )}
                              {server.category && (
                                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded border border-blue-500/20">
                                  {server.category}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400">{server.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${getStatusColor(server.status)}`}>
                            {getStatusText(server.status)}
                          </span>
                          
                          {/* 编辑按钮 */}
                          {!isEditing && (
                            <button
                              onClick={() => handleEditServer(server)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center space-x-1"
                              title="Edit server configuration"
                            >
                              <PencilIcon className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                          )}
                          
                          {/* 删除按钮 */}
                          {isSmitheryServer && server.smitheryId && (
                            <button
                              onClick={() => handleUninstallServer(server)}
                              disabled={isUninstalling}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors flex items-center space-x-1"
                              title="Uninstall Smithery server"
                            >
                              {isUninstalling ? (
                                <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full" />
                              ) : (
                                <TrashIcon className="h-3 w-3" />
                              )}
                              <span>{isUninstalling ? "Removing..." : "Remove"}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 编辑表单 */}
                      {isEditing ? (
                        <div className="bg-black/20 rounded-lg p-4 border border-blue-500/30">
                          <h5 className="text-sm font-medium text-primary mb-3">Edit Server Configuration</h5>
                          
                          <div className="space-y-3">
                            {/* 自定义描述 */}
                            <div>
                              <label className="block text-xs font-medium text-gray-400 mb-1">
                                Custom Description
                              </label>
                              <textarea
                                value={editForm.customDescription}
                                onChange={(e) => setEditForm({...editForm, customDescription: e.target.value})}
                                className="w-full bg-black/30 border border-gray-600 rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-orange-500 resize-none"
                                rows={2}
                                placeholder="Enter custom description..."
                              />
                            </div>
                            
                            {/* 分类选择 */}
                            <div>
                              <label className="block text-xs font-medium text-gray-400 mb-1">
                                Category
                              </label>
                              <select
                                value={editForm.category}
                                onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                                className="w-full bg-black/30 border border-gray-600 rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-orange-500"
                              >
                                {availableCategories.map(category => (
                                  <option key={category} value={category}>{category}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          {/* 编辑操作按钮 */}
                          <div className="flex items-center justify-end space-x-2 mt-4">
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors flex items-center space-x-1"
                            >
                              <XMarkIcon className="h-3 w-3" />
                              <span>Cancel</span>
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors flex items-center space-x-1"
                            >
                              <CheckIcon className="h-3 w-3" />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-300 mb-2">
                            {server.customDescription || server.description}
                          </p>
                          
                          {server.tools && server.tools.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-400 mb-1">Available Tools:</p>
                              <div className="flex flex-wrap gap-1">
                                {server.tools.slice(0, 5).map((tool, toolIndex) => (
                                  <span key={toolIndex} className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs rounded border border-orange-500/20">
                                    {tool}
                                  </span>
                                ))}
                                {server.tools.length > 5 && (
                                  <span className="px-2 py-1 bg-gray-500/10 text-gray-400 text-xs rounded border border-gray-500/20">
                                    +{server.tools.length - 5} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {isSmitheryServer && (
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-4">
                                {server.monthlyToolCalls !== undefined && (
                                  <span className="text-gray-500">
                                    {server.monthlyToolCalls.toLocaleString()} monthly calls
                                  </span>
                                )}
                                {server.successRate !== undefined && (
                                  <span className="text-green-400">
                                    {server.successRate}% success rate
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-500">{server.license}</span>
                                {server.sourceCode && (
                                  <a
                                    href={server.sourceCode}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-400 hover:text-orange-300 transition-colors"
                                  >
                                    Source Code
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Configuration Help */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-primary mb-4">Configuration Help</h3>
            <div className="space-y-3 text-sm text-gray-400">
              <div>
                <strong className="text-orange-400">Add MCP Server:</strong>
                <code className="block mt-1 bg-black/20 p-2 rounded">claude mcp add &lt;name&gt; &lt;command&gt;</code>
              </div>
              <div>
                <strong className="text-orange-400">List Servers:</strong>
                <code className="block mt-1 bg-black/20 p-2 rounded">claude mcp list</code>
              </div>
              <div>
                <strong className="text-orange-400">Start Native Server:</strong>
                <code className="block mt-1 bg-black/20 p-2 rounded">claude mcp serve</code>
              </div>
              <div>
                <strong className="text-orange-400">Remove Server:</strong>
                <code className="block mt-1 bg-black/20 p-2 rounded">claude mcp remove &lt;name&gt;</code>
              </div>
              <div className="pt-2 border-t border-gray-700/30">
                <strong className="text-orange-400">Browse Smithery.ai:</strong>
                <p className="mt-1">Discover thousands of MCP servers from the community registry</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "browse" && renderSmitheryBrowserTab()}
    </div>
  );
} 