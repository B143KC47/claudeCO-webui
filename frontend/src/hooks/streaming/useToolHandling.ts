import { useCallback } from "react";
import { extractToolInfo, generateToolPattern } from "../../utils/toolUtils";
import { isPermissionError } from "../../utils/messageTypes";
import type { StreamingContext } from "./useMessageProcessor";
import type { ToolResultMessage } from "../../types";

interface ToolCache {
  name: string;
  input: Record<string, unknown>;
}

export function useToolHandling() {
  // Store tool_use information for later matching with tool_result
  const toolUseCache = useCallback(() => {
    const cache = new Map<string, ToolCache>();
    return {
      set: (id: string, name: string, input: Record<string, unknown>) =>
        cache.set(id, { name, input }),
      get: (id: string) => cache.get(id),
      clear: () => cache.clear(),
    };
  }, [])();

  const handlePermissionError = useCallback(
    (
      contentItem: { tool_use_id?: string; content: string },
      context: StreamingContext,
    ) => {
      // Immediately abort the current request
      if (context.onAbortRequest) {
        context.onAbortRequest();
      }

      // Get cached tool_use information
      const toolUseId = contentItem.tool_use_id || "";
      const cachedToolInfo = toolUseCache.get(toolUseId);

      // Extract tool information for permission handling
      const { toolName, command } = extractToolInfo(
        cachedToolInfo?.name,
        cachedToolInfo?.input,
      );

      // Compute pattern based on tool type
      const pattern = generateToolPattern(toolName, command);

      // Notify parent component about permission error
      if (context.onPermissionError) {
        context.onPermissionError(toolName, pattern, toolUseId);
      }
    },
    [toolUseCache],
  );

  const processToolResult = useCallback(
    (
      contentItem: {
        tool_use_id?: string;
        content: string;
        is_error?: boolean;
      },
      context: StreamingContext,
      createToolResultMessage: (
        toolName: string,
        content: string,
      ) => ToolResultMessage,
    ) => {
      const content =
        typeof contentItem.content === "string"
          ? contentItem.content
          : JSON.stringify(contentItem.content);

      // Check for permission errors
      if (contentItem.is_error && isPermissionError(content)) {
        handlePermissionError(contentItem, context);
        return;
      }

      // Get the actual tool name from cache
      const toolUseId = contentItem.tool_use_id || "";
      const cachedToolInfo = toolUseCache.get(toolUseId);
      const toolName = cachedToolInfo?.name || "Tool result";

      // This is a regular tool result - create a ToolResultMessage
      const toolResultMessage = createToolResultMessage(toolName, content);
      context.addMessage(toolResultMessage);
    },
    [handlePermissionError],
  );

  return {
    toolUseCache,
    processToolResult,
  };
}
