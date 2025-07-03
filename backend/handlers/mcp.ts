import { Context } from "hono";

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

/**
 * Handles GET /api/mcp requests
 * Retrieves MCP server configuration and status from Claude configuration and CLI commands
 * @param c - Hono context object
 * @returns JSON response with MCP servers data
 */
export async function handleMCPRequest(c: Context) {
  try {
    const homeDir = Deno.env.get("HOME");
    if (!homeDir) {
      return c.json({ error: "HOME environment variable not found" }, 500);
    }

    const claudeConfigPath = `${homeDir}/.claude.json`;
    const servers: MCPServer[] = [];
    let nativeServerStatus: "running" | "stopped" | "unknown" = "unknown";

    try {
      // Read Claude configuration file
      const configContent = await Deno.readTextFile(claudeConfigPath);
      const config = JSON.parse(configContent);

      // Get current working directory from projects
      let currentProject = "";
      const cwd = Deno.cwd();
      
      // Find the current project in config
      for (const [projectPath, projectConfig] of Object.entries(config.projects || {})) {
        if (cwd.includes(projectPath) || projectPath.includes(cwd)) {
          currentProject = projectPath;
          break;
        }
      }

      // Get project-specific config if available
      const projectConfig = currentProject ? config.projects[currentProject] : null;
      
      // Add configured MCP servers from global config
      if (projectConfig && projectConfig.mcpServers) {
        for (const [serverName, serverConfig] of Object.entries(projectConfig.mcpServers)) {
          const server = serverConfig as any;
          servers.push({
            name: serverName,
            status: "unknown",
            type: server.type || "unknown",
            description: `${server.type?.toUpperCase()} server`,
            url: server.url,
            tools: []
          });
        }
      }

      // Get MCP server list using Claude CLI
      try {
        const mcpListCommand = await new Deno.Command("claude", {
          args: ["mcp", "list"],
          stdout: "piped",
          stderr: "piped",
          cwd: homeDir
        }).output();

        if (mcpListCommand.success) {
          const output = new TextDecoder().decode(mcpListCommand.stdout);
          
          if (output.includes("No MCP servers configured")) {
            // No additional servers from CLI
          } else {
            // Parse MCP list output to get server details
            const lines = output.split('\n').filter(line => line.trim());
            for (const line of lines) {
              if (line.includes('•') || line.includes('-')) {
                const serverName = line.replace(/[•\-\s]/g, '').split(':')[0];
                if (serverName) {
                  servers.push({
                    name: serverName,
                    status: "running",
                    type: "CLI configured",
                    description: "MCP server configured via CLI",
                    tools: []
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn("Failed to get MCP list:", error);
      }

      // Check if native Claude Code MCP server is available
      try {
        const mcpServeCheck = await new Deno.Command("claude", {
          args: ["mcp", "serve", "--help"],
          stdout: "piped",
          stderr: "piped",
          cwd: homeDir
        }).output();

        if (mcpServeCheck.success) {
          nativeServerStatus = "stopped"; // Available but not necessarily running
          
          // Add native Claude Code server
          servers.unshift({
            name: "Claude Code (Native)",
            status: "stopped",
            type: "Native",
            description: "Built-in Claude Code MCP server with file operations, code editing, and more",
            tools: [
              "File Operations",
              "Code Editing", 
              "Search",
              "Command Execution",
              "Project Management"
            ]
          });
        }
      } catch (error) {
        console.warn("Failed to check Claude MCP serve:", error);
      }

      // If no servers found, add a helpful message
      if (servers.length === 0) {
        servers.push({
          name: "No MCP Servers",
          status: "stopped",
          type: "None",
          description: "No MCP servers are currently configured. Use 'claude mcp add' to add servers.",
          tools: []
        });
      }

      const response: MCPResponse = {
        servers,
        nativeServerStatus
      };

      return c.json(response);

    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return c.json({
          servers: [{
            name: "No Configuration",
            status: "error",
            type: "Error",
            description: "Claude configuration file not found. Please run Claude Code first.",
            tools: []
          }],
          nativeServerStatus: "unknown"
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error reading MCP configuration:", error);
    return c.json({ error: "Failed to read MCP configuration" }, 500);
  }
} 