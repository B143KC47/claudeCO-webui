import { useState, useEffect, useCallback, useRef } from "react";
import {
  ServerIcon,
  CheckCircleIcon,
  XCircleIcon,
  StopIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  FunnelIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { getApiUrl } from "../../config/api";

interface MCPServer {
  name: string;
  status: "running" | "stopped" | "error" | "unknown";
  type: string;
  description: string;
  customDescription?: string;
  category?: string;
  tools?: string[];
  url?: string;
}

interface ClaudeConnection {
  status: "connected" | "disconnected" | "error";
  version?: string;
  message?: string;
}

interface MCPResponse {
  servers: MCPServer[];
  claudeConnection: ClaudeConnection;
}

// 骨架屏组件
function MCPSkeletonLoader() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="h-6 bg-black-tertiary rounded w-48"></div>
        <div className="h-8 bg-gradient-primary rounded w-16"></div>
      </div>

      {/* Filter skeleton */}
      <div className="flex items-center space-x-2">
        <div className="h-4 w-4 bg-black-tertiary rounded"></div>
        <div className="h-4 bg-black-tertiary rounded w-16"></div>
        <div className="h-8 bg-black-quaternary rounded w-32"></div>
      </div>

      {/* Native server skeleton */}
      <div className="glass-card p-4">
        <div className="flex items-center space-x-3">
          <div className="h-5 w-5 bg-gradient-primary rounded"></div>
          <div className="space-y-2">
            <div className="h-4 bg-black-tertiary rounded w-32"></div>
            <div className="h-4 bg-black-quaternary rounded w-24"></div>
          </div>
        </div>
      </div>

      {/* Server list skeleton */}
      <div>
        <div className="h-5 bg-black-tertiary rounded w-48 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="h-5 w-5 bg-black-tertiary rounded"></div>
                    <div className="h-5 bg-black-tertiary rounded w-32"></div>
                    <div className="h-4 bg-gradient-primary rounded w-16"></div>
                    <div className="h-5 bg-black-quaternary rounded w-12"></div>
                  </div>
                  <div className="h-4 bg-black-quaternary rounded w-full mb-2"></div>
                  <div className="h-3 bg-black-quaternary rounded w-48"></div>
                </div>
                <div className="flex space-x-2 ml-4">
                  <div className="h-6 w-6 bg-black-tertiary rounded"></div>
                  <div className="h-6 w-6 bg-black-tertiary rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 缓存管理
class MCPDataCache {
  private data: MCPResponse | null = null;
  private categories: string[] = [];
  private lastFetch: number = 0;
  private readonly cacheTimeout = 30000; // 30秒缓存

  setMCPData(data: MCPResponse) {
    this.data = data;
    this.lastFetch = Date.now();
  }

  setCategories(categories: string[]) {
    this.categories = categories;
  }

  getMCPData(): MCPResponse | null {
    if (this.isExpired()) {
      this.clear();
      return null;
    }
    return this.data;
  }

  getCategories(): string[] {
    return this.categories;
  }

  isExpired(): boolean {
    return Date.now() - this.lastFetch > this.cacheTimeout;
  }

  clear() {
    this.data = null;
    this.categories = [];
    this.lastFetch = 0;
  }
}

// 单例缓存实例
const mcpCache = new MCPDataCache();

export function MCPTab() {
  const [mcpData, setMcpData] = useState<MCPResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("所有");
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingServer, setDeletingServer] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MCPServer | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 防抖相关
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const lastRefreshRef = useRef<number>(0);

  // 防抖刷新函数
  const debouncedRefresh = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshRef.current;

    // 如果距离上次刷新不足1秒，则忽略
    if (timeSinceLastRefresh < 1000) {
      return;
    }

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      lastRefreshRef.current = now;
      loadMCPData(true); // 强制刷新，跳过缓存
    }, 300);
  }, []);

  useEffect(() => {
    // 组件挂载时，尝试从缓存加载数据
    const cachedData = mcpCache.getMCPData();
    const cachedCategories = mcpCache.getCategories();

    if (cachedData && cachedCategories.length > 0) {
      setMcpData(cachedData);
      setCategories(["所有", ...cachedCategories]);
      setLoading(false);
    } else {
      // 并行加载数据
      Promise.all([loadMCPData(), loadCategories()]).finally(() => {
        setLoading(false);
      });
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch(getApiUrl("/api/mcp/categories"));
      if (response.ok) {
        const data = await response.json();
        const categoryList = data.categories;
        mcpCache.setCategories(categoryList);
        setCategories(["所有", ...categoryList]);
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  }, []);

  const loadMCPData = useCallback(async (forceRefresh = false) => {
    try {
      // 如果不是强制刷新，先检查缓存
      if (!forceRefresh) {
        const cachedData = mcpCache.getMCPData();
        if (cachedData) {
          setMcpData(cachedData);
          return;
        }
      }

      setLoading(true);
      setError(null);
      const response = await fetch(getApiUrl("/api/mcp"));

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      mcpCache.setMCPData(data);
      setMcpData(data);
    } catch (err) {
      console.error("Error loading MCP data:", err);
      setError(err instanceof Error ? err.message : "Failed to load MCP data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    debouncedRefresh();
  }, [debouncedRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <CheckCircleIcon className="h-4 w-4 text-accent" />;
      case "stopped":
        return <StopIcon className="h-4 w-4 text-tertiary" />;
      case "error":
        return (
          <XCircleIcon
            className="h-4 w-4"
            style={{ color: "var(--accent-secondary)" }}
          />
        );
      default:
        return (
          <XCircleIcon
            className="h-4 w-4"
            style={{ color: "var(--accent-tertiary)" }}
          />
        );
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "running":
        return "运行中";
      case "stopped":
        return "已停止";
      case "error":
        return "错误";
      default:
        return "未知";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-accent";
      case "stopped":
        return "text-tertiary";
      case "error":
        return "text-accent";
      default:
        return "text-secondary";
    }
  };

  const handleEditServer = useCallback((server: MCPServer) => {
    setEditingServer(server);
    setEditDescription(server.customDescription || server.description);
    setEditCategory(server.category || "其他");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingServer) return;

    try {
      setSaving(true);
      const response = await fetch(getApiUrl("/api/mcp/config"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serverName: editingServer.name,
          customDescription: editDescription,
          category: editCategory,
        }),
      });

      if (response.ok) {
        await loadMCPData(true); // 强制刷新缓存
        setEditingServer(null);
      } else {
        const errorData = await response.json();
        alert(`保存失败: ${errorData.error || "未知错误"}`);
      }
    } catch (error) {
      console.error("Error saving configuration:", error);
      alert("保存配置失败");
    } finally {
      setSaving(false);
    }
  }, [editingServer, editDescription, editCategory, loadMCPData]);

  const handleCancelEdit = useCallback(() => {
    setEditingServer(null);
    setEditDescription("");
    setEditCategory("");
  }, []);

  const handleDeleteClick = useCallback((server: MCPServer) => {
    setDeleteConfirm(server);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;

    try {
      setDeletingServer(deleteConfirm.name);
      const response = await fetch(getApiUrl("/api/mcp/remove"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serverName: deleteConfirm.name,
        }),
      });

      if (response.ok) {
        // 乐观更新：立即从UI中移除服务器
        setMcpData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            servers: prev.servers.filter((s) => s.name !== deleteConfirm.name),
          };
        });
        setDeleteConfirm(null);
        
        // 显示成功消息
        setSuccessMessage(`成功删除 MCP 服务器: ${deleteConfirm.name}`);
        setTimeout(() => setSuccessMessage(null), 3000);

        // 后台重新加载数据以确保一致性
        setTimeout(() => loadMCPData(true), 500);
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.details || errorData.error || "未知错误";
        alert(`删除失败: ${errorMessage}\n\n请确保 Claude CLI 已正确安装并可访问。`);
      }
    } catch (error) {
      console.error("Error removing server:", error);
      alert(`删除服务器失败: ${error instanceof Error ? error.message : "网络错误"}\n\n请检查网络连接和服务器状态。`);
    } finally {
      setDeletingServer(null);
    }
  }, [deleteConfirm, loadMCPData]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const filteredServers =
    mcpData?.servers.filter((server) => {
      if (selectedCategory === "所有") return true;
      return server.category === selectedCategory;
    }) || [];

  if (loading) {
    return <MCPSkeletonLoader />;
  }

  if (error) {
    return (
      <div className="text-center text-accent p-4">
        <p>加载失败: {error}</p>
        <button
          onClick={handleRefresh}
          className="mt-2 px-4 py-2 glass-button text-primary smooth-transition"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 成功消息 */}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-500/10 border border-green-500/30 text-green-500 px-4 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="h-5 w-5" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="glass-card p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-primary mb-4">
              确认删除
            </h3>
            <p className="text-secondary mb-6">
              确定要删除 MCP 服务器 "
              <span className="font-medium text-accent">
                {deleteConfirm.name}
              </span>
              " 吗？
              <br />
              <span
                className="text-sm mt-2 block"
                style={{ color: "var(--accent-secondary)" }}
              >
                此操作将执行命令：
                <code className="bg-black-tertiary px-2 py-1 rounded text-xs block mt-1">
                  claude mcp remove {deleteConfirm.name}
                </code>
              </span>
              <span className="text-xs text-tertiary mt-2 block">
                注意：此操作不可撤销，服务器配置将被永久删除。
              </span>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-secondary hover:bg-black-tertiary rounded smooth-transition"
                disabled={deletingServer === deleteConfirm.name}
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deletingServer === deleteConfirm.name}
                className="px-4 py-2 bg-gradient-secondary text-primary rounded glow-effect disabled:opacity-50 flex items-center smooth-transition"
              >
                {deletingServer === deleteConfirm.name ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    删除中...
                  </>
                ) : (
                  "确认删除"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <h2 className="text-xl font-semibold text-primary">MCP 服务器管理</h2>
          {mcpData?.claudeConnection && (
            <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
              mcpData.claudeConnection.status === "connected"
                ? "bg-green-500/10 text-green-500"
                : mcpData.claudeConnection.status === "error"
                ? "bg-red-500/10 text-red-500"
                : "bg-yellow-500/10 text-yellow-500"
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                mcpData.claudeConnection.status === "connected"
                  ? "bg-green-500"
                  : mcpData.claudeConnection.status === "error"
                  ? "bg-red-500"
                  : "bg-yellow-500"
              }`} />
              <span>
                {mcpData.claudeConnection.status === "connected"
                  ? "Claude 已连接"
                  : mcpData.claudeConnection.status === "error"
                  ? "连接错误"
                  : "Claude 未连接"}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="px-3 py-1 text-sm glass-button text-primary smooth-transition disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex items-center space-x-2">
        <FunnelIcon className="h-4 w-4 text-tertiary" />
        <span className="text-sm text-secondary">分类筛选:</span>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-2 py-1 text-sm glass-input text-primary focus:border-accent smooth-transition"
        >
          {categories.map((category) => (
            <option
              key={category}
              value={category}
              className="bg-black-primary text-primary"
            >
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Claude Code Connection Status */}
      {mcpData?.claudeConnection && (
        <div className={`glass-card p-4 ${
          mcpData.claudeConnection.status === "connected" 
            ? "glow-border" 
            : mcpData.claudeConnection.status === "error"
            ? "border border-red-500/30"
            : "border border-yellow-500/30"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ServerIcon className={`h-5 w-5 ${
                mcpData.claudeConnection.status === "connected"
                  ? "text-accent"
                  : mcpData.claudeConnection.status === "error"
                  ? "text-red-500"
                  : "text-yellow-500"
              }`} />
              <div>
                <h3 className="font-medium text-primary">
                  Claude Code 连接状态
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  {mcpData.claudeConnection.status === "connected" ? (
                    <CheckCircleIcon className="h-4 w-4 text-accent" />
                  ) : mcpData.claudeConnection.status === "error" ? (
                    <XCircleIcon className="h-4 w-4 text-red-500" />
                  ) : (
                    <StopIcon className="h-4 w-4 text-yellow-500" />
                  )}
                  <span
                    className={`text-sm ${
                      mcpData.claudeConnection.status === "connected"
                        ? "text-accent"
                        : mcpData.claudeConnection.status === "error"
                        ? "text-red-500"
                        : "text-yellow-500"
                    }`}
                  >
                    {mcpData.claudeConnection.status === "connected"
                      ? "已连接"
                      : mcpData.claudeConnection.status === "error"
                      ? "连接错误"
                      : "未连接"}
                  </span>
                  {mcpData.claudeConnection.version && (
                    <span className="text-xs text-tertiary ml-2">
                      {mcpData.claudeConnection.version}
                    </span>
                  )}
                </div>
                {mcpData.claudeConnection.message && (
                  <p className="text-xs text-secondary mt-2">
                    {mcpData.claudeConnection.message}
                  </p>
                )}
              </div>
            </div>
            {mcpData.claudeConnection.status !== "connected" && (
              <div className="text-right">
                <p className="text-xs text-secondary">
                  {mcpData.claudeConnection.status === "disconnected"
                    ? "请确保 Claude CLI 已安装"
                    : "请检查 Claude CLI 配置"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Configured MCP Servers */}
      <div>
        <h3 className="text-lg font-medium text-primary mb-4">
          已配置的 MCP 服务器 ({filteredServers.length})
        </h3>

        {filteredServers.length === 0 ? (
          <div className="text-center text-secondary py-8">
            {selectedCategory === "所有"
              ? "没有找到已配置的 MCP 服务器"
              : `没有找到 "${selectedCategory}" 分类的服务器`}
            <div className="text-sm mt-2">
              使用{" "}
              <code className="bg-black-tertiary px-1 rounded">
                claude mcp add
              </code>{" "}
              命令添加服务器
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredServers.map((server) => (
              <div key={server.name} className="glass-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <ServerIcon className="h-5 w-5 text-tertiary" />
                      <h4 className="font-medium text-primary">
                        {server.name}
                      </h4>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(server.status)}
                        <span
                          className={`text-sm ${getStatusColor(server.status)}`}
                        >
                          {getStatusText(server.status)}
                        </span>
                      </div>
                      {server.category && (
                        <span className="px-2 py-1 text-xs bg-black-tertiary text-secondary rounded">
                          {server.category}
                        </span>
                      )}
                    </div>

                    {editingServer?.name === server.name ? (
                      <div className="space-y-3 mt-3">
                        <div>
                          <label className="block text-sm text-secondary mb-1">
                            自定义描述:
                          </label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full px-3 py-2 glass-input text-primary"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-secondary mb-1">
                            分类:
                          </label>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="px-3 py-2 glass-input text-primary"
                          >
                            {categories
                              .filter((cat) => cat !== "所有")
                              .map((category) => (
                                <option
                                  key={category}
                                  value={category}
                                  className="bg-black-primary text-primary"
                                >
                                  {category}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="flex items-center px-3 py-1 text-sm glass-button text-primary glow-effect disabled:opacity-50 smooth-transition"
                          >
                            <CheckIcon className="h-4 w-4 mr-1" />
                            {saving ? "保存中..." : "保存"}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex items-center px-3 py-1 text-sm bg-black-tertiary text-secondary rounded hover:bg-black-quaternary smooth-transition"
                          >
                            <XMarkIcon className="h-4 w-4 mr-1" />
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-secondary mb-2">
                          {server.customDescription || server.description}
                        </p>
                        <div className="text-xs text-tertiary">
                          <span>类型: {server.type}</span>
                          {server.url && (
                            <span className="ml-4">地址: {server.url}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {editingServer?.name !== server.name && (
                      <>
                        <button
                          onClick={() => handleEditServer(server)}
                          className="p-1 text-tertiary hover:text-accent smooth-transition"
                          title="编辑服务器"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(server)}
                          className="p-1 text-tertiary hover:text-accent smooth-transition"
                          title="删除服务器"
                          disabled={deletingServer === server.name}
                        >
                          {deletingServer === server.name ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                          ) : (
                            <TrashIcon className="h-4 w-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configuration Help */}
      <div className="glass-card p-4">
        <h4 className="font-medium text-primary mb-2">配置帮助</h4>
        <div className="text-sm text-secondary space-y-1">
          <p>
            • 使用{" "}
            <code className="bg-black-tertiary px-1 rounded text-accent">
              claude mcp add &lt;server-name&gt; &lt;path-or-url&gt;
            </code>{" "}
            添加新的 MCP 服务器
          </p>
          <p>
            • 使用{" "}
            <code className="bg-black-tertiary px-1 rounded text-accent">
              claude mcp remove &lt;server-name&gt;
            </code>{" "}
            删除 MCP 服务器
          </p>
          <p>
            • 使用{" "}
            <code className="bg-black-tertiary px-1 rounded text-accent">
              claude mcp list
            </code>{" "}
            查看已配置的服务器
          </p>
          <p>• 点击编辑按钮可以自定义服务器描述和分类</p>
          <p>• 点击删除按钮可以移除不需要的 MCP 服务器</p>
        </div>
      </div>
    </div>
  );
}
