import { useCallback } from "react";

export interface SlashCommandResult {
  handled: boolean;
  shouldSendToBackend: boolean;
  message?: string;
}

export interface SlashCommandHandlers {
  onClear: () => void;
  onNew: () => void;
  onHelp: () => void;
}

/**
 * Hook to handle client-side slash commands
 * Some commands like /clear and /new are handled locally
 * Others are passed through to the Claude CLI backend
 */
export function useSlashCommands(handlers: SlashCommandHandlers) {
  const { onClear, onNew, onHelp } = handlers;

  /**
   * Process a command and determine if it should be handled client-side
   * Returns whether the command was handled and if it should still be sent to backend
   */
  const processCommand = useCallback(
    (input: string): SlashCommandResult => {
      const trimmed = input.trim();

      // Check if this is a slash command
      if (!trimmed.startsWith("/")) {
        return { handled: false, shouldSendToBackend: true };
      }

      // Extract command and arguments
      const parts = trimmed.substring(1).split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      console.log(`[SlashCommand] Processing: /${command}`, args);

      switch (command) {
        case "clear":
          // Clear the chat display
          onClear();
          return {
            handled: true,
            shouldSendToBackend: false,
            message: "Chat cleared",
          };

        case "new":
          // Start a new session
          onNew();
          return {
            handled: true,
            shouldSendToBackend: false,
            message: "New session started",
          };

        case "help":
          // Show help dialog
          onHelp();
          return {
            handled: true,
            shouldSendToBackend: false,
            message: "Help displayed",
          };

        // Commands that should be sent to backend
        case "model":
        case "cost":
        case "permissions":
        case "agents":
        case "plugin":
        case "resume":
        case "ide":
          // These are Claude CLI commands that need backend processing
          return {
            handled: true,
            shouldSendToBackend: true,
          };

        default:
          // Unknown command or MCP/plugin command - send to backend
          // This includes commands like /mcp__*, /pluginname:*, etc.
          return {
            handled: false,
            shouldSendToBackend: true,
          };
      }
    },
    [onClear, onNew, onHelp]
  );

  /**
   * Check if input is a command
   */
  const isCommand = useCallback((input: string): boolean => {
    return input.trim().startsWith("/");
  }, []);

  /**
   * Get command name from input
   */
  const getCommandName = useCallback((input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) return null;

    const parts = trimmed.substring(1).split(/\s+/);
    return parts[0].toLowerCase();
  }, []);

  return {
    processCommand,
    isCommand,
    getCommandName,
  };
}
