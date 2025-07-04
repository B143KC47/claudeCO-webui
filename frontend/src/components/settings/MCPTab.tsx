import { useState, useEffect } from "react";
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

interface MCPResponse {
  servers: MCPServer[];
  nativeServerStatus: "running" | "stopped" | "unknown";
}

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

  useEffect(() => {
    loadMCPData();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch(getApiUrl("/api/mcp/categories"));
      if (response.ok) {
        const data = await response.json();
        setCategories(["所有", ...data.categories]);
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const loadMCPData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(getApiUrl("/api/mcp"));

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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

  const handleRefresh = () => {
    loadMCPData();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case "stopped":
        return <StopIcon className="h-4 w-4 text-gray-500" />;
      case "error":
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      default:
        return <XCircleIcon className="h-4 w-4 text-yellow-500" />;
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
        return "text-green-600 dark:text-green-400";
      case "stopped":
        return "text-gray-600 dark:text-gray-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-yellow-600 dark:text-yellow-400";
    }
  };

  const handleEditServer = (server: MCPServer) => {
    setEditingServer(server);
    setEditDescription(server.customDescription || server.description);
    setEditCategory(server.category || "其他");
  };

  const handleSaveEdit = async () => {
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
        await loadMCPData();
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
  };

  const handleCancelEdit = () => {
    setEditingServer(null);
    setEditDescription("");
    setEditCategory("");
  };

  const handleDeleteClick = (server: MCPServer) => {
    setDeleteConfirm(server);
  };

  const handleDeleteConfirm = async () => {
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
        await loadMCPData();
        setDeleteConfirm(null);
      } else {
        const errorData = await response.json();
        alert(`删除失败: ${errorData.error || "未知错误"}`);
      }
    } catch (error) {
      console.error("Error removing server:", error);
      alert("删除服务器失败");
    } finally {
      setDeletingServer(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const filteredServers =
    mcpData?.servers.filter((server) => {
      if (selectedCategory === "所有") return true;
      return server.category === selectedCategory;
    }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 dark:text-red-400 p-4">
        <p>加载失败: {error}</p>
        <button
          onClick={handleRefresh}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 删除确认对话框 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              确认删除
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              确定要删除服务器 "
              <span className="font-medium">{deleteConfirm.name}</span>" 吗？
              <br />
              <span className="text-sm text-red-600 dark:text-red-400">
                此操作不可撤销，将执行 claude mcp remove 命令。
              </span>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                disabled={deletingServer === deleteConfirm.name}
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deletingServer === deleteConfirm.name}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center"
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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          MCP 服务器管理
        </h2>
        <button
          onClick={handleRefresh}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          刷新
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex items-center space-x-2">
        <FunnelIcon className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          分类筛选:
        </span>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Native Claude Server Status */}
      {mcpData?.nativeServerStatus && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <ServerIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">
                Claude Code 本地服务器
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                {getStatusIcon(mcpData.nativeServerStatus)}
                <span
                  className={`text-sm ${getStatusColor(mcpData.nativeServerStatus)}`}
                >
                  {getStatusText(mcpData.nativeServerStatus)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configured MCP Servers */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          已配置的 MCP 服务器 ({filteredServers.length})
        </h3>

        {filteredServers.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            {selectedCategory === "所有"
              ? "没有找到已配置的 MCP 服务器"
              : `没有找到 "${selectedCategory}" 分类的服务器`}
            <div className="text-sm mt-2">
              使用{" "}
              <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                claude mcp add
              </code>{" "}
              命令添加服务器
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredServers.map((server) => (
              <div
                key={server.name}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <ServerIcon className="h-5 w-5 text-gray-500" />
                      <h4 className="font-medium text-gray-900 dark:text-white">
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
                        <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {server.category}
                        </span>
                      )}
                    </div>

                    {editingServer?.name === server.name ? (
                      <div className="space-y-3 mt-3">
                        <div>
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                            自定义描述:
                          </label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                            分类:
                          </label>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {categories
                              .filter((cat) => cat !== "所有")
                              .map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckIcon className="h-4 w-4 mr-1" />
                            {saving ? "保存中..." : "保存"}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex items-center px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            <XMarkIcon className="h-4 w-4 mr-1" />
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {server.customDescription || server.description}
                        </p>
                        <div className="text-xs text-gray-500 dark:text-gray-500">
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
                          className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                          title="编辑服务器"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(server)}
                          className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                          title="删除服务器"
                          disabled={deletingServer === server.name}
                        >
                          {deletingServer === server.name ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
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
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">
          配置帮助
        </h4>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p>
            • 使用{" "}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
              claude mcp add &lt;server-name&gt; &lt;path-or-url&gt;
            </code>{" "}
            添加新的 MCP 服务器
          </p>
          <p>
            • 使用{" "}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
              claude mcp remove &lt;server-name&gt;
            </code>{" "}
            删除 MCP 服务器
          </p>
          <p>
            • 使用{" "}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
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
