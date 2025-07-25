import { useCallback } from "react";
import type {
  StreamResponse,
  SDKMessage,
  SystemMessage,
  AbortMessage,
} from "../../types";
import {
  isSystemMessage,
  isAssistantMessage,
  isResultMessage,
  isUserMessage,
} from "../../utils/messageTypes";
import {
  useMessageProcessor,
  type StreamingContext,
} from "./useMessageProcessor";
import { useToolHandling } from "./useToolHandling";

export function useStreamParser() {
  const {
    createSystemMessage,
    createToolMessage,
    createResultMessage,
    createToolResultMessage,
  } = useMessageProcessor();

  const { toolUseCache, processToolResult } = useToolHandling();

  const handleSystemMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "system" }>,
      context: StreamingContext,
    ) => {
      // Check if this is an init message and if we should show it
      if (claudeData.subtype === "init") {
        // Mark that we've received init
        context.setHasReceivedInit?.(true);

        const shouldShow = context.shouldShowInitMessage?.() ?? true;
        if (shouldShow) {
          const systemMessage = createSystemMessage(claudeData);
          context.addMessage(systemMessage);
          context.onInitMessageShown?.();
        }
      } else {
        // Always show non-init system messages
        const systemMessage = createSystemMessage(claudeData);
        context.addMessage(systemMessage);
      }
    },
    [createSystemMessage],
  );

  const handleAssistantTextMessage = useCallback(
    (contentItem: { text?: string }, context: StreamingContext) => {
      let messageToUpdate = context.currentAssistantMessage;

      if (!messageToUpdate) {
        messageToUpdate = {
          type: "chat",
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        };
        context.setCurrentAssistantMessage(messageToUpdate);
        context.addMessage(messageToUpdate);
      }

      const updatedContent =
        (messageToUpdate.content || "") + (contentItem.text || "");

      // Update the current assistant message state
      const updatedMessage = {
        ...messageToUpdate,
        content: updatedContent,
      };
      context.setCurrentAssistantMessage(updatedMessage);
      context.updateLastMessage(updatedContent);
    },
    [],
  );

  const handleToolUseMessage = useCallback(
    (
      contentItem: {
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      },
      context: StreamingContext,
    ) => {
      // Cache tool_use information for later permission error handling
      if (contentItem.id && contentItem.name) {
        toolUseCache.set(
          contentItem.id,
          contentItem.name,
          contentItem.input || {},
        );
      }

      const toolMessage = createToolMessage(contentItem);
      context.addMessage(toolMessage);
    },
    [createToolMessage, toolUseCache],
  );

  const handleAssistantMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "assistant" }>,
      context: StreamingContext,
    ) => {
      for (const contentItem of claudeData.message.content) {
        if (contentItem.type === "text") {
          handleAssistantTextMessage(contentItem, context);
        } else if (contentItem.type === "tool_use") {
          handleToolUseMessage(contentItem, context);
        }
      }
    },
    [handleAssistantTextMessage, handleToolUseMessage],
  );

  const handleResultMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "result" }>,
      context: StreamingContext,
    ) => {
      const resultMessage = createResultMessage(claudeData);
      context.addMessage(resultMessage);
      context.setCurrentAssistantMessage(null);
    },
    [createResultMessage],
  );

  const handleUserMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "user" }>,
      context: StreamingContext,
    ) => {
      // Check if this user message contains tool_result content
      const messageContent = claudeData.message.content;

      if (Array.isArray(messageContent)) {
        for (const contentItem of messageContent) {
          if (contentItem.type === "tool_result") {
            processToolResult(contentItem, context, createToolResultMessage);
          }
        }
      }
      // Note: We don't display regular user messages from the SDK as they represent Claude's internal tool results
    },
    [createToolResultMessage, processToolResult],
  );

  const processClaudeData = useCallback(
    (claudeData: SDKMessage, context: StreamingContext) => {
      // Extract session ID from any message that has it
      if (claudeData.session_id && context.onSessionId && !context.sessionId) {
        console.log(
          `[Session] Extracting session ID from ${claudeData.type} message:`,
          claudeData.session_id,
        );
        context.onSessionId(claudeData.session_id);
      }

      switch (claudeData.type) {
        case "system":
          if (isSystemMessage(claudeData)) {
            handleSystemMessage(claudeData, context);
          } else {
            console.warn("Invalid system message:", claudeData);
          }
          break;
        case "assistant":
          if (isAssistantMessage(claudeData)) {
            handleAssistantMessage(claudeData, context);
          } else {
            console.warn("Invalid assistant message:", claudeData);
          }
          break;
        case "result":
          if (isResultMessage(claudeData)) {
            handleResultMessage(claudeData, context);
          } else {
            console.warn("Invalid result message:", claudeData);
          }
          break;
        case "user":
          if (isUserMessage(claudeData)) {
            handleUserMessage(claudeData, context);
          } else {
            console.warn("Invalid user message:", claudeData);
          }
          break;
        default:
          console.log("Unknown Claude message type:", claudeData);
      }
    },
    [
      handleSystemMessage,
      handleAssistantMessage,
      handleResultMessage,
      handleUserMessage,
    ],
  );

  const processStreamLine = useCallback(
    (line: string, context: StreamingContext) => {
      try {
        const data: StreamResponse = JSON.parse(line);

        if (data.type === "claude_json" && data.data) {
          // data.data is already an SDKMessage object, no need to parse
          const claudeData = data.data as SDKMessage;
          processClaudeData(claudeData, context);
        } else if (data.type === "error") {
          const errorMessage: SystemMessage = {
            type: "error",
            subtype: "stream_error",
            message: data.error || "Unknown error",
            timestamp: Date.now(),
          };
          context.addMessage(errorMessage);

          // If error indicates Claude Code exit, provide more context
          if (data.error && data.error.includes("Claude Code process exited")) {
            console.error("Claude Code process terminated unexpectedly");
          }
        } else if (data.type === "aborted") {
          const abortedMessage: AbortMessage = {
            type: "system",
            subtype: "abort",
            message: "Operation was aborted by user",
            timestamp: Date.now(),
          };
          context.addMessage(abortedMessage);
          context.setCurrentAssistantMessage(null);
        }
      } catch (parseError) {
        console.error("Failed to parse stream line:", parseError);
        console.error("Raw line:", line);

        // Only show parse error if it's not an empty line or connection close
        if (line.trim() && !line.includes("event: close")) {
          const errorMessage: SystemMessage = {
            type: "error",
            subtype: "stream_error",
            message:
              "Failed to parse response from Claude. The connection may have been interrupted.",
            timestamp: Date.now(),
          };
          context.addMessage(errorMessage);
        }
      }
    },
    [processClaudeData],
  );

  return {
    processStreamLine,
  };
}
