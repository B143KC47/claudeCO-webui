import { Context } from "hono";
import { join } from "@std/path";
import { exists } from "@std/fs";
import type { ClaudeCommand } from "../../shared/types.ts";

// Built-in Claude Code commands from official documentation
const BUILTIN_COMMANDS: ClaudeCommand[] = [
  {
    command: "/help",
    description: "Show help information and available commands",
    category: "builtin",
  },
  {
    command: "/clear",
    description: "Clear the current conversation history",
    category: "builtin",
  },
  {
    command: "/new",
    description: "Start a new conversation session",
    category: "builtin",
  },
  {
    command: "/cost",
    description: "Display token usage statistics and costs",
    category: "builtin",
  },
  {
    command: "/permissions",
    description: "Manage tool permissions and security settings",
    category: "builtin",
  },
  {
    command: "/agents",
    description: "View available specialized AI subagents",
    category: "builtin",
  },
  {
    command: "/model",
    description: "Switch between Claude models (opus, sonnet, haiku)",
    category: "builtin",
    argumentHint: "[model-name]",
  },
  {
    command: "/ide",
    description: "Connect to VS Code IDE integration",
    category: "builtin",
  },
  {
    command: "/resume",
    description: "Resume a previous conversation session",
    category: "builtin",
    argumentHint: "[session-id]",
  },
  {
    command: "/plugin",
    description: "Manage Claude Code plugins",
    category: "builtin",
    argumentHint: "[install|uninstall|list|validate]",
  },
];

/**
 * Parse frontmatter from a markdown file
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return {};

  const frontmatter: Record<string, unknown> = {};
  const lines = frontmatterMatch[1].split("\n");

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      let value: string | string[] = match[2].trim();

      // Parse arrays
      if (value.includes(",")) {
        value = value.split(",").map((v) => v.trim());
      }

      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

/**
 * Scan a directory for command files (.md files)
 */
async function scanCommandDirectory(
  dirPath: string,
  category: "project" | "personal",
): Promise<ClaudeCommand[]> {
  const commands: ClaudeCommand[] = [];

  try {
    if (!await exists(dirPath)) {
      return commands;
    }

    for await (const entry of Deno.readDir(dirPath)) {
      if (entry.isFile && entry.name.endsWith(".md")) {
        const commandName = entry.name.replace(/\.md$/, "");
        const filePath = join(dirPath, entry.name);

        try {
          const content = await Deno.readTextFile(filePath);
          const frontmatter = parseFrontmatter(content);

          commands.push({
            command: `/${commandName}`,
            description: (frontmatter.description as string) ||
              `Custom ${category} command`,
            category,
            source: filePath,
            argumentHint: frontmatter["argument-hint"] as string,
            allowedTools: Array.isArray(frontmatter["allowed-tools"])
              ? frontmatter["allowed-tools"] as string[]
              : undefined,
            model: frontmatter.model as string,
          });
        } catch (error) {
          console.warn(`Failed to read command file ${filePath}:`, error);
        }
      }
    }
  } catch (error) {
    console.debug(`Command directory not accessible: ${dirPath}`, error);
  }

  return commands;
}

/**
 * Discover MCP server commands
 */
async function discoverMCPCommands(): Promise<ClaudeCommand[]> {
  const commands: ClaudeCommand[] = [];

  try {
    // Try to list MCP servers
    const mcpListCommand = new Deno.Command("claude", {
      args: ["mcp", "list"],
      stdout: "piped",
      stderr: "piped",
    });

    const output = await mcpListCommand.output();
    if (output.success) {
      const outputText = new TextDecoder().decode(output.stdout);

      // Parse MCP server names from output
      // Format is typically: server-name - description
      const serverMatches = outputText.matchAll(/^(\S+)\s*-\s*(.+)$/gm);

      for (const match of serverMatches) {
        const serverName = match[1];
        const description = match[2];

        // MCP commands follow pattern: /mcp__servername__commandname
        commands.push({
          command: `/mcp__${serverName}__*`,
          description: `MCP Server: ${description}`,
          category: "mcp",
          source: serverName,
        });
      }
    }
  } catch (error) {
    console.debug("MCP command discovery failed:", error);
  }

  return commands;
}

/**
 * Discover installed plugin commands
 */
async function discoverPluginCommands(
  workingDirectory?: string,
): Promise<ClaudeCommand[]> {
  const commands: ClaudeCommand[] = [];
  const pluginDirs: string[] = [];

  // Check for project-level plugins
  if (workingDirectory) {
    pluginDirs.push(join(workingDirectory, ".claude", "plugins"));
  }

  // Check for user-level plugins
  const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
  if (homeDir) {
    pluginDirs.push(join(homeDir, ".claude", "plugins"));
  }

  for (const pluginDir of pluginDirs) {
    try {
      if (!await exists(pluginDir)) continue;

      for await (const entry of Deno.readDir(pluginDir)) {
        if (!entry.isDirectory) continue;

        const commandsDir = join(pluginDir, entry.name, "commands");
        if (await exists(commandsDir)) {
          const pluginCommands = await scanCommandDirectory(
            commandsDir,
            "plugin" as "project",
          );

          // Prefix with plugin name
          for (const cmd of pluginCommands) {
            commands.push({
              ...cmd,
              category: "plugin",
              command: `/${entry.name}:${cmd.command.substring(1)}`,
              source: entry.name,
            });
          }
        }
      }
    } catch (error) {
      console.debug(`Plugin directory not accessible: ${pluginDir}`, error);
    }
  }

  return commands;
}

/**
 * Main handler for command discovery
 */
export async function handleCommandsDiscovery(c: Context) {
  try {
    const { workingDirectory } = await c.req.json().catch(() => ({}));

    const allCommands: ClaudeCommand[] = [];

    // 1. Add built-in commands
    allCommands.push(...BUILTIN_COMMANDS);

    // 2. Scan project commands
    if (workingDirectory) {
      const projectCommandsDir = join(workingDirectory, ".claude", "commands");
      const projectCommands = await scanCommandDirectory(
        projectCommandsDir,
        "project",
      );
      allCommands.push(...projectCommands);
    }

    // 3. Scan personal commands
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
    if (homeDir) {
      const personalCommandsDir = join(homeDir, ".claude", "commands");
      const personalCommands = await scanCommandDirectory(
        personalCommandsDir,
        "personal",
      );
      allCommands.push(...personalCommands);
    }

    // 4. Discover MCP commands
    const mcpCommands = await discoverMCPCommands();
    allCommands.push(...mcpCommands);

    // 5. Discover plugin commands
    const pluginCommands = await discoverPluginCommands(workingDirectory);
    allCommands.push(...pluginCommands);

    return c.json({
      commands: allCommands,
      count: allCommands.length,
      categoryCounts: {
        builtin: allCommands.filter((cmd) => cmd.category === "builtin").length,
        project: allCommands.filter((cmd) => cmd.category === "project").length,
        personal: allCommands.filter((cmd) => cmd.category === "personal")
          .length,
        mcp: allCommands.filter((cmd) => cmd.category === "mcp").length,
        plugin: allCommands.filter((cmd) => cmd.category === "plugin").length,
      },
    });
  } catch (error) {
    console.error("Command discovery error:", error);
    return c.json(
      {
        error: "Failed to discover commands",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
