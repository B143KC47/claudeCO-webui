import { useState, useEffect } from "react";
import { ServerIcon, CheckCircleIcon, XCircleIcon, PlayIcon, StopIcon } from "@heroicons/react/24/outline";
import { getApiUrl } from "../../config/api";

interface MCPServer {
  name: string;
  status: "running" | "stopped" | "error" | "unknown";
  type: string;
  description: string;
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

  useEffect(() => {
    loadMCPData();
  }, []);

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

  const handleRefresh = () => {
    loadMCPData();
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
          <h2 className="text-2xl font-bold text-primary mb-2">MCP Server Configuration</h2>
          <p className="text-gray-400">
            Manage and monitor your Model Context Protocol servers
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

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
        <h3 className="text-lg font-semibold text-primary mb-4">Configured MCP Servers</h3>
        
        {mcpData.servers.length === 0 ? (
          <div className="text-center py-8">
            <ServerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No MCP servers configured</p>
            <p className="text-sm text-gray-500">
              Use <code className="bg-black/20 px-2 py-1 rounded">claude mcp add</code> to add servers
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {mcpData.servers.map((server, index) => (
              <div key={index} className="border border-gray-700/30 rounded-lg p-4 hover:border-orange-500/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(server.status)}
                    <div>
                      <h4 className="font-medium text-primary">{server.name}</h4>
                      <p className="text-sm text-gray-400">{server.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${getStatusColor(server.status)}`}>
                      {getStatusText(server.status)}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-400 mb-3">{server.description}</p>
                
                {server.url && (
                  <p className="text-xs text-orange-400 mb-3">
                    <strong>URL:</strong> {server.url}
                  </p>
                )}
                
                {server.tools && server.tools.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-primary mb-2">Available Tools:</p>
                    <div className="flex flex-wrap gap-2">
                      {server.tools.map((tool, toolIndex) => (
                        <span
                          key={toolIndex}
                          className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs rounded border border-orange-500/20"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
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
        </div>
      </div>
    </div>
  );
} 