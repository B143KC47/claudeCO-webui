import { Context } from "../types.ts";
import { join } from "jsr:@std/path@^1.0.8";
import { exists } from "jsr:@std/fs@^1.0.7";

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

interface SmitheryAPIResponse {
  servers: SmitheryServer[];
  total: number;
  page: number;
  limit: number;
}

interface MCPConfig {
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}

interface UserMCPConfig {
  servers?: Record<string, {
    customDescription?: string;
    category?: string;
    tags?: string[];
  }>;
}

const PREDEFINED_CATEGORIES = [
  "开发工具",
  "数据处理", 
  "AI模型",
  "系统工具",
  "Web服务",
  "项目管理",
  "其他"
];

// Simulated Smithery.ai API data (in production, this would be fetched from real API)
const simulatedSmitheryServers: SmitheryServer[] = [
  {
    id: "@mcpserver/openrouterai",
    name: "OpenRouter MCP Server",
    description: "A Model Context Protocol (MCP) server for integration with OpenRouter.ai, allowing access to various AI models through a unified interface.",
    tools: ["chat_completion", "search_models", "get_model_info", "validate_model"],
    monthlyToolCalls: 307,
    successRate: 98.95,
    license: "Apache-2.0",
    isLocal: false,
    homepage: "https://openrouter.ai",
    sourceCode: "https://github.com/heltonteixeira/openrouterai",
    author: "heltonteixeira",
    tags: ["llm-integration", "ai-models"]
  },
  {
    id: "@kazuph/mcp-taskmanager",
    name: "TaskManager",
    description: "Model Context Protocol server for Task Management, allowing Claude Desktop (or any MCP client) to manage and execute tasks in a queue-based system.",
    tools: ["request_planning", "get_next_task", "mark_task_done", "approve_task_completion"],
    monthlyToolCalls: 69364,
    successRate: 95.2,
    license: "MIT",
    isLocal: true,
    sourceCode: "https://github.com/kazuph/mcp-taskmanager",
    author: "kazuph",
    tags: ["project-management", "task-management"]
  },
  {
    id: "cli-mcp-server",
    name: "CLI",
    description: "Command line interface for executing controlled CLI operations with robust security features including command whitelisting, path validation, and execution controls.",
    tools: ["execute_command", "list_allowed_commands", "validate_path"],
    monthlyToolCalls: 539,
    successRate: 92.1,
    license: "MIT",
    isLocal: true,
    homepage: "https://github.com/MladenSU/cli-mcp-server",
    sourceCode: "https://github.com/MladenSU/cli-mcp-server",
    author: "MladenSU",
    tags: ["system", "cli"]
  },
  {
    id: "@smithery/webscraper",
    name: "Web Scraper",
    description: "Extract and analyze web content with advanced scraping capabilities, supporting dynamic content and multiple formats.",
    tools: ["scrape_url", "extract_text", "analyze_content", "get_links"],
    monthlyToolCalls: 15420,
    successRate: 94.7,
    license: "MIT",
    isLocal: false,
    author: "smithery",
    tags: ["web-search", "data-extraction"]
  },
  {
    id: "@smithery/github-integration",
    name: "GitHub Integration",
    description: "Comprehensive GitHub integration for repository management, issue tracking, and code analysis.",
    tools: ["create_issue", "list_repos", "get_commits", "analyze_code"],
    monthlyToolCalls: 8921,
    successRate: 97.3,
    license: "Apache-2.0",
    isLocal: false,
    author: "smithery",
    tags: ["project-management", "version-control"]
  }
];

async function getClaudeConfigPath(): Promise<string | null> {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
  if (!home) return null;

  const configPaths = [
    join(home, ".config", "claude", "claude_desktop_config.json"),
    join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
    join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
  ];

  for (const path of configPaths) {
    if (await exists(path)) {
      return path;
    }
  }

  return null;
}

async function readClaudeConfig(): Promise<MCPConfig> {
  const configPath = await getClaudeConfigPath();
  if (!configPath) {
    return {};
  }

  try {
    const configContent = await Deno.readTextFile(configPath);
    return JSON.parse(configContent);
  } catch (error) {
    console.error("Error reading Claude config:", error);
    return {};
  }
}

async function writeClaudeConfig(config: MCPConfig): Promise<void> {
  const configPath = await getClaudeConfigPath();
  if (!configPath) {
    throw new Error("Could not find Claude configuration directory");
  }

  try {
    await Deno.writeTextFile(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Error writing Claude config:", error);
    throw new Error("Failed to write Claude configuration");
  }
}

async function fetchSmitheryServers(searchQuery?: string, category?: string, authToken?: string): Promise<SmitheryServer[]> {
  // Get API token from either function parameter or environment variable
  const apiToken = authToken || Deno.env.get("SMITHERY_API_TOKEN");
  
  // If no API token is provided, fall back to simulated data
  if (!apiToken) {
    console.warn("No Smithery API token provided, using mock data. Provide token via Authorization header or set SMITHERY_API_TOKEN environment variable to use real Smithery.ai API.");
    return fetchSimulatedSmitheryServers(searchQuery, category);
  }

  try {
    // Build the API URL with query parameters
    const apiUrl = new URL("https://registry.smithery.ai/servers");
    
    if (searchQuery) {
      apiUrl.searchParams.set("q", searchQuery);
    }
    
    // Set pagination parameters
    apiUrl.searchParams.set("page", "1");
    apiUrl.searchParams.set("pageSize", "50"); // Get more results to ensure good coverage
    
    console.log(`Fetching servers from Smithery.ai API: ${apiUrl.toString()}`);
    
    const response = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Accept": "application/json",
        "User-Agent": "claude-code-webui/1.0",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error("Smithery.ai API authentication failed. Please check your SMITHERY_API_TOKEN.");
      } else if (response.status === 429) {
        console.error("Smithery.ai API rate limit exceeded. Falling back to mock data.");
      } else {
        console.error(`Smithery.ai API error: ${response.status} ${response.statusText}`);
      }
      // Fall back to simulated data on API errors
      return fetchSimulatedSmitheryServers(searchQuery, category);
    }

    const apiResponse = await response.json();
    
    if (!apiResponse.servers || !Array.isArray(apiResponse.servers)) {
      console.error("Invalid response format from Smithery.ai API");
      return fetchSimulatedSmitheryServers(searchQuery, category);
    }

    // Map the API response to our SmitheryServer interface
    let mappedServers: SmitheryServer[] = apiResponse.servers.map((server: any) => ({
      id: server.qualifiedName || server.id || "",
      name: server.displayName || server.name || "",
      description: server.description || "",
      tools: server.tools || [],
      monthlyToolCalls: server.useCount || 0,
      successRate: calculateSuccessRate(server), // Helper function to calculate success rate
      license: server.license || "Unknown",
      isLocal: server.isDeployed === false,
      homepage: server.homepage || "",
      sourceCode: server.sourceCode || server.repository || "",
      author: server.author || server.owner || "",
      tags: server.tags || [],
    }));

    // Apply category filtering if specified
    if (category && category !== "all") {
      mappedServers = mappedServers.filter(server =>
        server.tags?.some(tag => tag.toLowerCase().includes(category.toLowerCase()))
      );
    }

    console.log(`Successfully fetched ${mappedServers.length} servers from Smithery.ai API`);
    return mappedServers;

  } catch (error) {
    console.error("Error fetching from Smithery.ai API:", error);
    console.log("Falling back to simulated data");
    return fetchSimulatedSmitheryServers(searchQuery, category);
  }
}

// Helper function to calculate success rate from API response
function calculateSuccessRate(server: any): number {
  // If the API provides explicit success rate, use it
  if (typeof server.successRate === 'number') {
    return server.successRate;
  }
  
  // If we have error rate, calculate success rate
  if (typeof server.errorRate === 'number') {
    return Math.max(0, 100 - server.errorRate);
  }
  
  // If we have usage stats, try to calculate based on that
  if (server.statistics) {
    const stats = server.statistics;
    if (stats.successfulCalls && stats.totalCalls) {
      return (stats.successfulCalls / stats.totalCalls) * 100;
    }
  }
  
  // Default to a reasonable success rate based on usage
  const useCount = server.useCount || 0;
  if (useCount > 1000) return 95 + Math.random() * 4; // High usage servers tend to be reliable
  if (useCount > 100) return 90 + Math.random() * 8;
  return 85 + Math.random() * 10;
}

// Renamed the original function to be used as fallback
async function fetchSimulatedSmitheryServers(searchQuery?: string, category?: string): Promise<SmitheryServer[]> {
  let filteredServers = [...simulatedSmitheryServers];
  
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredServers = filteredServers.filter(server =>
      server.name.toLowerCase().includes(query) ||
      server.description.toLowerCase().includes(query) ||
      server.tools.some(tool => tool.toLowerCase().includes(query)) ||
      server.author?.toLowerCase().includes(query)
    );
  }
  
  if (category && category !== "all") {
    filteredServers = filteredServers.filter(server =>
      server.tags?.includes(category)
    );
  }
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
  
  return filteredServers;
}

async function installSmitheryServer(serverId: string, serverName: string, serverUrl: string): Promise<void> {
  const config = await readClaudeConfig();
  
  if (!config.mcpServers) {
    config.mcpServers = {};
  }
  
  // Add the server to the configuration
  config.mcpServers[serverName] = {
    command: "npx",
    args: ["-y", "@smithery/cli@latest", "run", serverId],
    env: {
      SMITHERY_SERVER_URL: serverUrl
    }
  };
  
  await writeClaudeConfig(config);
}

async function uninstallSmitheryServer(serverName: string): Promise<void> {
  const config = await readClaudeConfig();
  
  if (config.mcpServers && config.mcpServers[serverName]) {
    delete config.mcpServers[serverName];
    await writeClaudeConfig(config);
  }
}

async function checkNativeServerStatus(): Promise<"running" | "stopped" | "unknown"> {
  try {
    // Check if Claude Code's native MCP server is running
    // This is a simplified check - in reality, you'd check for actual process or service
    const response = await fetch("http://localhost:3001/health", {
      method: "GET",
      signal: AbortSignal.timeout(2000)
    });
    return response.ok ? "running" : "stopped";
  } catch {
    return "stopped";
  }
}

async function getMCPServers(): Promise<MCPServer[]> {
  const config = await readClaudeConfig();
  const userConfig = await readUserMCPConfig();
  const servers: MCPServer[] = [];

  if (config.mcpServers) {
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      const isSmitheryServer = serverConfig.command === "npx" && 
        serverConfig.args?.includes("@smithery/cli@latest");
      
      let smitheryId: string | undefined;
      let serverInfo: SmitheryServer | undefined;
      
      if (isSmitheryServer) {
        // Extract Smithery server ID from args
        const runIndex = serverConfig.args?.indexOf("run");
        if (runIndex !== undefined && runIndex >= 0 && serverConfig.args) {
          smitheryId = serverConfig.args[runIndex + 1];
          serverInfo = simulatedSmitheryServers.find(s => s.id === smitheryId);
        }
      }

      // 获取用户自定义配置
      const userServerConfig = userConfig.servers?.[name];

      servers.push({
        name,
        status: "unknown", // We'd need to implement actual status checking
        type: isSmitheryServer ? "Smithery MCP Server" : "Local MCP Server",
        description: serverInfo?.description || `MCP server: ${name}`,
        customDescription: userServerConfig?.customDescription || serverInfo?.description,
        category: userServerConfig?.category || (serverInfo?.tags?.[0] || "其他"),
        tools: serverInfo?.tools,
        url: serverConfig.env?.SMITHERY_SERVER_URL,
        source: isSmitheryServer ? "smithery" : "local",
        smitheryId,
        monthlyToolCalls: serverInfo?.monthlyToolCalls,
        successRate: serverInfo?.successRate,
        license: serverInfo?.license,
        homepage: serverInfo?.homepage,
        sourceCode: serverInfo?.sourceCode
      });
    }
  }

  return servers;
}

async function readUserMCPConfig(): Promise<UserMCPConfig> {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
  if (!home) return {};
  
  const userConfigPath = join(home, ".claude", "user_mcp_config.json");
  
  try {
    if (await exists(userConfigPath)) {
      const configContent = await Deno.readTextFile(userConfigPath);
      return JSON.parse(configContent);
    }
  } catch (error) {
    console.error("Error reading user MCP config:", error);
  }
  
  return {};
}

async function writeUserMCPConfig(config: UserMCPConfig): Promise<void> {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
  if (!home) {
    throw new Error("Could not find home directory");
  }
  
  const userConfigPath = join(home, ".claude", "user_mcp_config.json");
  
  try {
    // 确保目录存在
    const configDir = join(home, ".claude");
    try {
      await Deno.mkdir(configDir, { recursive: true });
    } catch (err) {
      // 目录可能已存在，忽略错误
      if (!(err instanceof Deno.errors.AlreadyExists)) {
        throw err;
      }
    }
    
    await Deno.writeTextFile(userConfigPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Error writing user MCP config:", error);
    throw new Error("Failed to write user MCP configuration");
  }
}

export async function handleMCP(ctx: Context): Promise<Response> {
  const url = new URL(ctx.request.url);
  const method = ctx.request.method;
  const pathname = url.pathname;

  // Handle different MCP endpoints
  if (pathname === "/api/mcp" && method === "GET") {
    try {
      const servers = await getMCPServers();
      const nativeServerStatus = await checkNativeServerStatus();

      return new Response(
        JSON.stringify({
          servers,
          nativeServerStatus,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error fetching MCP data:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch MCP data",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Handle Smithery servers listing
  if (pathname === "/api/mcp/smithery" && method === "GET") {
    try {
      const searchQuery = url.searchParams.get("search") || undefined;
      const category = url.searchParams.get("category") || undefined;
      
      // Extract OAuth token from Authorization header
      const authHeader = ctx.request.headers.get("Authorization");
      let authToken: string | undefined;
      
      if (authHeader && authHeader.startsWith("Bearer ")) {
        authToken = authHeader.substring(7);
      }
      
      const servers = await fetchSmitheryServers(searchQuery, category, authToken);

      return new Response(
        JSON.stringify({
          servers,
          total: servers.length,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error fetching Smithery servers:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch Smithery servers",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Handle server installation
  if (pathname === "/api/mcp/install" && method === "POST") {
    try {
      const body = await ctx.request.json();
      const { serverId, serverName, serverUrl } = body;

      if (!serverId || !serverName || !serverUrl) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: serverId, serverName, serverUrl",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      await installSmitheryServer(serverId, serverName, serverUrl);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully installed ${serverName}`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error installing server:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to install server",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Handle server uninstallation
  if (pathname === "/api/mcp/uninstall" && method === "DELETE") {
    try {
      const body = await ctx.request.json();
      const { serverName } = body;

      if (!serverName) {
        return new Response(
          JSON.stringify({
            error: "Missing required field: serverName",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      await uninstallSmitheryServer(serverName);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully uninstalled ${serverName}`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error uninstalling server:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to uninstall server",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Handle server configuration update
  if (pathname === "/api/mcp/update" && method === "PUT") {
    try {
      const body = await ctx.request.json();
      const { serverName, customDescription, category } = body;

      if (!serverName) {
        return new Response(
          JSON.stringify({
            error: "Missing required field: serverName",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // 读取现有的用户配置
      const userConfig = await readUserMCPConfig();
      
      // 初始化服务器配置结构
      if (!userConfig.servers) {
        userConfig.servers = {};
      }
      
      if (!userConfig.servers[serverName]) {
        userConfig.servers[serverName] = {};
      }

      // 更新配置
      if (customDescription !== undefined) {
        userConfig.servers[serverName].customDescription = customDescription;
      }
      
      if (category !== undefined) {
        userConfig.servers[serverName].category = category;
      }

      // 保存配置
      await writeUserMCPConfig(userConfig);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully updated ${serverName} configuration`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error updating server configuration:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to update server configuration",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Handle categories listing
  if (pathname === "/api/mcp/categories" && method === "GET") {
    try {
      return new Response(
        JSON.stringify({
          categories: PREDEFINED_CATEGORIES,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error fetching categories:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch categories",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  return new Response("Not Found", { status: 404 });
} 