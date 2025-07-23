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
  "其他",
];

// Get MCP servers using Claude CLI
async function getClaudeMcpServers(): Promise<
  { name: string; url?: string; type: string }[]
> {
  try {
    const cmd = new Deno.Command("claude", {
      args: ["mcp", "list"],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await cmd.output();

    if (code !== 0) {
      const errorOutput = new TextDecoder().decode(stderr);
      console.error(
        "Error getting MCP servers (exit code",
        code + "):",
        errorOutput,
      );
      return [];
    }

    const output = new TextDecoder().decode(stdout);
    console.log("Claude MCP list output:", output); // Debug info

    const servers: { name: string; url?: string; type: string }[] = [];
    const lines = output.trim().split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      console.log("No MCP servers found in output");
      return [];
    }

    for (const line of lines) {
      console.log("Parsing line:", line); // Debug info

      // Try multiple parsing patterns for different formats
      let serverInfo: { name: string; url?: string; type: string } | null =
        null;

      // Pattern 1: "server-name: url (TYPE)"
      let match = line.match(/^(.+?):\s*(.+?)\s*\((\w+)\)$/);
      if (match) {
        serverInfo = {
          name: match[1].trim(),
          url: match[2].trim(),
          type: match[3].trim(),
        };
      } else {
        // Pattern 2: "server-name (TYPE): url"
        match = line.match(/^(.+?)\s*\((\w+)\):\s*(.+)$/);
        if (match) {
          serverInfo = {
            name: match[1].trim(),
            url: match[3].trim(),
            type: match[2].trim(),
          };
        } else {
          // Pattern 3: "server-name: url"
          match = line.match(/^(.+?):\s*(.+)$/);
          if (match) {
            serverInfo = {
              name: match[1].trim(),
              url: match[2].trim(),
              type: "Unknown",
            };
          } else {
            // Pattern 4: Just server name (no URL)
            match = line.match(/^(.+)$/);
            if (match && !line.includes(":")) {
              serverInfo = {
                name: match[1].trim(),
                type: "Local",
              };
            }
          }
        }
      }

      if (serverInfo) {
        console.log("Parsed server:", serverInfo); // Debug info
        servers.push(serverInfo);
      } else {
        console.warn("Could not parse line:", line);
      }
    }

    console.log("Total servers found:", servers.length); // Debug info
    return servers;
  } catch (error) {
    console.error("Failed to execute claude mcp list:", error);
    return [];
  }
}

async function checkServerStatus(
  server: { name: string; url?: string; type: string },
): Promise<"running" | "stopped" | "error" | "unknown"> {
  try {
    // For HTTP servers, try to make a simple request
    if (
      server.url && (server.type === "HTTP" || server.url.startsWith("http"))
    ) {
      try {
        const response = await fetch(server.url, {
          method: "OPTIONS", // Less intrusive than GET
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (response.ok || response.status === 405) { // 405 = Method Not Allowed is also acceptable
          return "running";
        } else {
          return "error";
        }
      } catch (fetchError) {
        console.warn(`Failed to check HTTP server ${server.name}:`, fetchError);
        return "unknown";
      }
    }

    // For local servers, check process list
    if (server.type === "Local" || !server.url) {
      try {
        const cmd = new Deno.Command("ps", {
          args: ["aux"],
          stdout: "piped",
          stderr: "piped",
        });

        const { code, stdout } = await cmd.output();

        if (code === 0) {
          const output = new TextDecoder().decode(stdout);
          // Check for server-specific processes
          const serverPatterns = [
            server.name,
            `mcp-${server.name}`,
            `${server.name}-server`,
            `mcp_${server.name}`,
          ];

          for (const pattern of serverPatterns) {
            if (output.includes(pattern)) {
              return "running";
            }
          }
        }

        return "stopped";
      } catch (psError) {
        console.warn(
          `Failed to check process list for ${server.name}:`,
          psError,
        );
        return "unknown";
      }
    }

    return "unknown";
  } catch (error) {
    console.error(`Error checking status for server ${server.name}:`, error);
    return "error";
  }
}

async function checkClaudeCodeConnection(): Promise<{
  status: "connected" | "disconnected" | "error";
  version?: string;
  message?: string;
}> {
  try {
    // First check if Claude CLI is available
    const versionCmd = new Deno.Command("claude", {
      args: ["--version"],
      stdout: "piped",
      stderr: "piped",
    });

    const { code: versionCode, stdout: versionStdout, stderr: versionStderr } = await versionCmd.output();

    if (versionCode !== 0) {
      const errorOutput = new TextDecoder().decode(versionStderr);
      console.error("Claude CLI not available:", errorOutput);
      return {
        status: "disconnected",
        message: "Claude CLI not found. Please ensure claude is installed and in PATH."
      };
    }

    const versionOutput = new TextDecoder().decode(versionStdout).trim();
    console.log("Claude version:", versionOutput);

    // Try to check if Claude can list MCP servers (this verifies it's fully functional)
    const testCmd = new Deno.Command("claude", {
      args: ["mcp", "list"],
      stdout: "piped",
      stderr: "piped",
    });

    const { code: testCode } = await testCmd.output();

    if (testCode === 0) {
      return {
        status: "connected",
        version: versionOutput,
        message: "Claude Code is connected and working properly"
      };
    } else {
      return {
        status: "error",
        version: versionOutput,
        message: "Claude CLI found but MCP commands not working"
      };
    }
  } catch (error) {
    console.error("Error checking Claude Code connection:", error);
    return {
      status: "error",
      message: `Failed to check connection: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}

async function getMCPServers(): Promise<MCPServer[]> {
  const claudeServers = await getClaudeMcpServers();
  const userConfig = await readUserMCPConfig();
  const servers: MCPServer[] = [];

  console.log(`Processing ${claudeServers.length} Claude MCP servers`); // Debug info

  // Process servers with parallel status checks for better performance
  const serverPromises = claudeServers.map(async (server) => {
    const userServerConfig = userConfig.servers?.[server.name];

    // Check server status
    const status = await checkServerStatus(server);
    console.log(`Server ${server.name} status: ${status}`); // Debug info

    return {
      name: server.name,
      status,
      type: server.type === "HTTP"
        ? "HTTP MCP Server"
        : server.type === "Local"
        ? "Local MCP Server"
        : `${server.type} MCP Server`,
      description: userServerConfig?.customDescription ||
        (server.url
          ? `MCP server at ${server.url}`
          : `Local MCP server: ${server.name}`),
      customDescription: userServerConfig?.customDescription,
      category: userServerConfig?.category || "其他",
      tools: [], // Could be enhanced to fetch actual tools list
      url: server.url,
    };
  });

  const processedServers = await Promise.all(serverPromises);
  servers.push(...processedServers);

  console.log(`Returning ${servers.length} processed MCP servers`); // Debug info
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

async function removeMCPServer(serverName: string): Promise<void> {
  try {
    const cmd = new Deno.Command("claude", {
      args: ["mcp", "remove", serverName],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await cmd.output();

    if (code !== 0) {
      const errorOutput = new TextDecoder().decode(stderr);
      console.error(
        `Error removing MCP server ${serverName} (exit code ${code}):`,
        errorOutput,
      );
      throw new Error(`Failed to remove server: ${errorOutput}`);
    }

    const output = new TextDecoder().decode(stdout);
    console.log(`Successfully removed MCP server ${serverName}:`, output);
  } catch (error) {
    console.error(
      `Failed to execute claude mcp remove for ${serverName}:`,
      error,
    );
    throw error;
  }
}

export async function handleMCP(ctx: Context): Promise<Response> {
  const url = new URL(ctx.request.url);
  const method = ctx.request.method;
  const pathname = url.pathname;

  // Handle MCP servers listing
  if (pathname === "/api/mcp" && method === "GET") {
    try {
      const servers = await getMCPServers();
      const claudeConnection = await checkClaudeCodeConnection();

      return new Response(
        JSON.stringify({
          servers,
          claudeConnection,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
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
        },
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
        },
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
        },
      );
    }
  }

  // Handle server configuration updates
  if (pathname === "/api/mcp/config" && method === "PUT") {
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
          },
        );
      }

      const currentConfig = await readUserMCPConfig();

      if (!currentConfig.servers) {
        currentConfig.servers = {};
      }

      currentConfig.servers[serverName] = {
        customDescription,
        category,
      };

      await writeUserMCPConfig(currentConfig);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully updated configuration for ${serverName}`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
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
        },
      );
    }
  }

  // Handle server removal
  if (pathname === "/api/mcp/remove" && method === "DELETE") {
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
          },
        );
      }

      console.log(`Attempting to remove MCP server: ${serverName}`);
      await removeMCPServer(serverName);

      // Also remove from user config
      try {
        const currentConfig = await readUserMCPConfig();
        if (currentConfig.servers && currentConfig.servers[serverName]) {
          delete currentConfig.servers[serverName];
          await writeUserMCPConfig(currentConfig);
          console.log(`Removed ${serverName} from user config`);
        }
      } catch (configError) {
        console.warn(
          "Failed to update user config after removal:",
          configError,
        );
        // Don't fail the whole operation for this
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully removed MCP server: ${serverName}`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Error removing MCP server:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to remove MCP server",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // Handle unknown routes
  return new Response(
    JSON.stringify({
      error: "Not Found",
      message: `Route ${pathname} not found`,
    }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    },
  );
}
