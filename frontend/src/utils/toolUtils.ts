import { TOOL_CONSTANTS } from "./constants";

// Extract tool name and command from previous context
export function extractToolInfo(
  toolName?: string,
  input?: Record<string, unknown>,
): { toolName: string; command: string } {
  // Default tool name if not provided
  const extractedToolName = toolName || TOOL_CONSTANTS.DEFAULT_TOOL_NAME;

  // Extract command from input for pattern matching
  let command = "";

  // For Bash tool, parse command details
  if (
    extractedToolName === "Bash" &&
    input?.command &&
    typeof input.command === "string"
  ) {
    command = extractBashCommand(input.command);
  } else {
    // For all non-Bash tools (Write, Edit, Read, etc.), use wildcard
    command = TOOL_CONSTANTS.WILDCARD_COMMAND;
  }

  // Ensure command is never empty for non-Bash tools
  if (extractedToolName !== "Bash" && (!command || command === "")) {
    command = TOOL_CONSTANTS.WILDCARD_COMMAND;
  }

  return { toolName: extractedToolName, command };
}

// Extract command from Bash tool input
function extractBashCommand(commandString: string): string {
  const cmdParts = commandString.split(/\s+/);

  // Find the first option (starts with -)
  const optionIndex = cmdParts.findIndex((part) => part.startsWith("-"));

  if (optionIndex > 0) {
    // Take everything before the first option
    return cmdParts.slice(0, optionIndex).join(" ");
  } else {
    // No options found, take the first part(s)
    // Handle common patterns like "cargo run", "git log", etc.
    if (
      cmdParts.length >= 2 &&
      TOOL_CONSTANTS.MULTI_WORD_COMMANDS.includes(
        cmdParts[0] as (typeof TOOL_CONSTANTS.MULTI_WORD_COMMANDS)[number],
      )
    ) {
      return cmdParts.slice(0, 2).join(" ");
    } else {
      return cmdParts[0] || "";
    }
  }
}

// Generate tool pattern for permission checking
export function generateToolPattern(toolName: string, command: string): string {
  return toolName === "Bash" && command !== TOOL_CONSTANTS.WILDCARD_COMMAND
    ? `${toolName}(${command}:*)`
    : toolName;
}

// Format tool arguments for display
export function formatToolArguments(input?: Record<string, unknown>): string {
  if (!input) return "";

  // Special handling for common tool arguments
  if (input.path) return `(${input.path})`;
  if (input.file_path) return `(${input.file_path})`;
  if (input.command) return `(${input.command})`;
  if (input.pattern) return `(${input.pattern})`;
  if (input.url) return `(${input.url})`;

  // For other tools, show key arguments
  const keys = Object.keys(input);
  if (keys.length > 0) {
    const firstKey = keys[0];
    const value = input[firstKey];
    if (typeof value === "string" && value.length < 50) {
      return `(${value})`;
    } else {
      return `(${keys.length} ${keys.length === 1 ? "arg" : "args"})`;
    }
  }

  return "";
}
