import { useState, useEffect, useCallback } from "react";
import type {
  CommandSuggestion,
  CommandShowcaseContext,
} from "../types";
import { getGitStatusUrl } from "../config/api";

/**
 * Hook to generate context-aware command suggestions that update automatically
 * based on git status, working directory, and other project state.
 */
export function useCommandSuggestions(workingDirectory?: string) {
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [context, setContext] = useState<CommandShowcaseContext>({
    hasGitRepo: false,
    hasUnstagedChanges: false,
    currentDirectory: workingDirectory || "",
    recentActivity: [],
  });

  /**
   * Generate command suggestions based on the current context
   */
  const generateSuggestions = useCallback(
    (ctx: CommandShowcaseContext): CommandSuggestion[] => {
      const commands: CommandSuggestion[] = [];

      // General commands - always show
      commands.push({
        icon: "💡",
        label: "What can you do?",
        command: "What capabilities do you have?",
        description: "Learn about Claude's features",
        category: "general",
      });

      // Git-aware suggestions
      if (ctx.hasGitRepo) {
        if (ctx.hasUnstagedChanges) {
          commands.push({
            icon: "📝",
            label: "Review changes",
            command: "Review my current git changes and provide feedback",
            description: "Get code review feedback",
            category: "git",
          });
          commands.push({
            icon: "💾",
            label: "Commit changes",
            command:
              "Create a descriptive commit message for my current changes",
            description: "Generate commit message",
            category: "git",
          });
        }

        commands.push({
          icon: "🌿",
          label: "Git status",
          command: "What is the current git status?",
          description: "Check repository state",
          category: "git",
        });
      }

      // File operations
      commands.push({
        icon: "📂",
        label: "Explore codebase",
        command: "Explain the structure and architecture of this project",
        description: "Get project overview",
        category: "file",
      });

      commands.push({
        icon: "🔍",
        label: "Find in project",
        command: "Help me find specific code in the project",
        description: "Search codebase",
        category: "file",
      });

      // Terminal commands
      commands.push({
        icon: "⚡",
        label: "Run tests",
        command: "Run the test suite and explain the results",
        description: "Execute project tests",
        category: "terminal",
      });

      commands.push({
        icon: "🏗️",
        label: "Build project",
        command: "Build the project and report any issues",
        description: "Run build command",
        category: "terminal",
      });

      // MCP/Tools commands
      commands.push({
        icon: "🛠️",
        label: "Available tools",
        command: "What MCP tools and servers are available?",
        description: "Explore MCP capabilities",
        category: "mcp",
      });

      // Help and documentation
      commands.push({
        icon: "📚",
        label: "Code explanation",
        command: "Explain how a specific part of the code works",
        description: "Understand code logic",
        category: "general",
      });

      commands.push({
        icon: "🐛",
        label: "Debug help",
        command: "Help me debug an issue in my code",
        description: "Troubleshoot problems",
        category: "general",
      });

      commands.push({
        icon: "✨",
        label: "Refactor code",
        command: "Suggest refactoring improvements for better code quality",
        description: "Improve code structure",
        category: "general",
      });

      return commands;
    },
    [],
  );

  /**
   * Fetch git status to update context
   */
  const updateGitContext = useCallback(async () => {
    if (!workingDirectory) return;

    try {
      const response = await fetch(getGitStatusUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workingDirectory }),
      });
      if (response.ok) {
        const gitStatus = await response.json();
        setContext((prev) => ({
          ...prev,
          hasGitRepo: true,
          hasUnstagedChanges:
            (gitStatus.modified?.length > 0) ||
            (gitStatus.added?.length > 0) ||
            (gitStatus.deleted?.length > 0) ||
            (gitStatus.untracked?.length > 0) ||
            false,
        }));
      }
    } catch (error) {
      // Git not available or not a git repo
      console.debug("Git status not available:", error);
      setContext((prev) => ({
        ...prev,
        hasGitRepo: false,
        hasUnstagedChanges: false,
      }));
    }
  }, [workingDirectory]);

  /**
   * Update suggestions whenever context changes
   */
  useEffect(() => {
    const newSuggestions = generateSuggestions(context);
    setSuggestions(newSuggestions);
  }, [context, generateSuggestions]);

  /**
   * Update working directory in context
   */
  useEffect(() => {
    setContext((prev) => ({
      ...prev,
      currentDirectory: workingDirectory || "",
    }));
  }, [workingDirectory]);

  /**
   * Fetch git status on mount and set up polling
   */
  useEffect(() => {
    // Initial fetch
    updateGitContext();

    // Poll every 10 seconds for git status updates
    const interval = setInterval(updateGitContext, 10000);

    return () => clearInterval(interval);
  }, [updateGitContext]);

  /**
   * Manually refresh suggestions (can be called after user actions)
   */
  const refresh = useCallback(() => {
    updateGitContext();
  }, [updateGitContext]);

  return {
    suggestions,
    context,
    refresh,
  };
}
