import { useCallback } from "react";
import type {
  AllMessage,
  ChatMessage,
  SystemMessage,
  ToolMessage,
  ToolResultMessage,
  SDKMessage,
} from "../../types";
import { MESSAGE_CONSTANTS } from "../../utils/constants";
import { formatToolArguments } from "../../utils/toolUtils";

export interface StreamingContext {
  currentAssistantMessage: ChatMessage | null;
  setCurrentAssistantMessage: (msg: ChatMessage | null) => void;
  addMessage: (msg: AllMessage) => void;
  updateLastMessage: (content: string) => void;
  onSessionId?: (sessionId: string) => void;
  sessionId?: string;
  shouldShowInitMessage?: () => boolean;
  onInitMessageShown?: () => void;
  hasReceivedInit?: boolean;
  setHasReceivedInit?: (received: boolean) => void;
  onPermissionError?: (
    toolName: string,
    pattern: string,
    toolUseId: string,
  ) => void;
  onAbortRequest?: () => void;
}

export function useMessageProcessor() {
  const createSystemMessage = useCallback(
    (claudeData: Extract<SDKMessage, { type: "system" }>): SystemMessage => {
      return {
        ...claudeData,
        timestamp: Date.now(),
      };
    },
    [],
  );

  const createToolMessage = useCallback(
    (contentItem: {
      name?: string;
      input?: Record<string, unknown>;
    }): ToolMessage => {
      const toolName = contentItem.name || "Unknown";
      const argsDisplay = formatToolArguments(contentItem.input);

      return {
        type: "tool",
        content: `${toolName}${argsDisplay}`,
        timestamp: Date.now(),
      };
    },
    [],
  );

  const createResultMessage = useCallback(
    (claudeData: Extract<SDKMessage, { type: "result" }>): SystemMessage => {
      return {
        ...claudeData,
        timestamp: Date.now(),
      };
    },
    [],
  );

  const createToolResultMessage = useCallback(
    (toolName: string, content: string): ToolResultMessage => {
      const summary = generateSummary(content);

      return {
        type: "tool_result",
        toolName,
        content,
        summary,
        timestamp: Date.now(),
      };
    },
    [],
  );

  return {
    createSystemMessage,
    createToolMessage,
    createResultMessage,
    createToolResultMessage,
  };
}

// Generate a summary from tool result content
function generateSummary(content: string): string {
  if (content.includes("\n")) {
    const lines = content.split("\n").filter((line) => line.trim());
    if (lines.length > 0) {
      return `${lines.length} ${lines.length === 1 ? "line" : "lines"}`;
    }
  } else if (content.includes("Found")) {
    const match = content.match(/Found (\d+)/);
    if (match) {
      return `Found ${match[1]}`;
    }
  } else if (content.includes("files")) {
    const match = content.match(/(\d+)\s+files?/);
    if (match) {
      return `${match[1]} files`;
    }
  } else if (content.length < MESSAGE_CONSTANTS.SUMMARY_MAX_LENGTH) {
    return content.trim();
  }

  return `${content.length} chars`;
}
