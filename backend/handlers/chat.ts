import { Context } from "hono";
import { AbortError, query } from "@anthropic-ai/claude-code";
import type { ChatRequest, StreamResponse } from "../../shared/types.ts";
import { convertWindowsPathToWSL } from "../history/pathUtils.ts";

/**
 * Executes a Claude command and yields streaming responses
 * @param message - User message or command
 * @param requestId - Unique request identifier for abort functionality
 * @param requestAbortControllers - Shared map of abort controllers
 * @param sessionId - Optional session ID for conversation continuity
 * @param allowedTools - Optional array of allowed tool names
 * @param workingDirectory - Optional working directory for Claude execution
 * @param thinking - Optional thinking configuration for Claude
 * @param debugMode - Enable debug logging
 * @returns AsyncGenerator yielding StreamResponse objects
 */
async function* executeClaudeCommand(
  message: string,
  requestId: string,
  requestAbortControllers: Map<string, AbortController>,
  sessionId?: string,
  allowedTools?: string[],
  workingDirectory?: string,
  thinking?: { type: "enabled"; budget_tokens: number },
  debugMode?: boolean,
): AsyncGenerator<StreamResponse> {
  let abortController: AbortController;

  try {
    // Process commands that start with '/'
    let processedMessage = message;
    if (message.startsWith("/")) {
      // Remove the '/' and send just the command
      processedMessage = message.substring(1);
    }

    // Create and store AbortController for this request
    abortController = new AbortController();
    requestAbortControllers.set(requestId, abortController);

    // Log working directory information
    if (workingDirectory) {
      console.log("[Chat] Original working directory:", workingDirectory);

      // Check if we're in WSL and need to convert the path
      const platform = Deno.build.os;
      let isWSL = false;

      if (platform === "linux") {
        try {
          const wslCheck = await new Deno.Command("uname", {
            args: ["-r"],
            stdout: "piped",
            stderr: "piped",
          }).output();

          if (wslCheck.success) {
            const kernelInfo = new TextDecoder().decode(wslCheck.stdout)
              .toLowerCase();
            isWSL = kernelInfo.includes("microsoft") ||
              kernelInfo.includes("wsl");
          }
        } catch {
          isWSL = Boolean(Deno.env.get("WSL_DISTRO_NAME")) ||
            Boolean(Deno.env.get("WSLENV"));
        }
      }

      if (isWSL) {
        const convertedPath = convertWindowsPathToWSL(workingDirectory);
        if (convertedPath !== workingDirectory) {
          console.log("[Chat] Converted to WSL path:", convertedPath);
        }
      }
    }

    // For compiled binaries, use system claude command to avoid bundled cli.js issues
    let claudePath: string = "claude"; // default fallback
    try {
      const whichResult = await new Deno.Command("which", {
        args: ["claude"],
        stdout: "piped",
        stderr: "piped",
      }).output();
      
      if (whichResult.success) {
        claudePath = new TextDecoder().decode(whichResult.stdout).trim();
        console.log("[Chat] Found Claude at:", claudePath);

        // Try to get version info (non-blocking)
        const versionCheck = await new Deno.Command(claudePath, {
          args: ["--version"],
          stdout: "piped",
          stderr: "piped",
        }).output();

        if (versionCheck.success) {
          const version = new TextDecoder().decode(versionCheck.stdout).trim();
          console.log("[Chat] Claude version:", version);
        }
      } else {
        console.log("[Chat] Using default 'claude' command");
      }
    } catch (error) {
      console.log("[Chat] Claude detection warning:", error.message);
      // Continue with default claude command
    }

    console.log(
      `[Chat] Starting Claude query with session: ${sessionId || "new"}`,
    );

    for await (
      const sdkMessage of query({
        prompt: processedMessage,
        options: {
          abortController,
          pathToClaudeCodeExecutable: claudePath,
          ...(sessionId ? { resume: sessionId } : {}),
          ...(allowedTools ? { allowedTools } : {}),
          ...(workingDirectory ? { cwd: workingDirectory } : {}),
          ...(thinking ? { thinking } : {}),
        },
      })
    ) {
      // Debug logging of raw SDK messages
      if (debugMode) {
        console.debug("[DEBUG] Claude SDK Message:");
        console.debug(JSON.stringify(sdkMessage, null, 2));
        console.debug("---");
      }
      
      // Log session ID extraction for debugging
      if (sdkMessage.session_id) {
        console.log(`[Session] SDK Message type: ${sdkMessage.type}, session_id: ${sdkMessage.session_id}`);
      }

      yield {
        type: "claude_json",
        data: sdkMessage,
      };
    }

    console.log("[Chat] Claude query completed successfully");

    yield { type: "done" };
  } catch (error) {
    // Check if error is due to abort
    if (error instanceof AbortError) {
      yield { type: "aborted" };
    } else {
      // Handle Claude Code exit code 1 specifically
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);

      // Check for common Claude Code exit scenarios
      if (
        errorMessage.includes("exit code 1") ||
        errorMessage.includes("exited with code 1")
      ) {
        console.error("[Chat] Claude Code process exited with code 1");
        console.error("[Chat] Full error:", error);
        console.error("[Chat] Stack trace:", error instanceof Error ? error.stack : "No stack trace");

        // Try to extract more specific error information
        let specificError = "Claude Code process exited unexpectedly.";
        let solutions = [];

        if (errorMessage.includes("ANTHROPIC_API_KEY")) {
          specificError = "Claude Code API key is not configured.";
          solutions = [
            "• Set your API key with: export ANTHROPIC_API_KEY='your-key'",
            "• Or use Claude Code Max which doesn't require an API key"
          ];
        } else if (errorMessage.includes("rate limit")) {
          specificError = "Claude API rate limit exceeded.";
          solutions = [
            "• Wait a few minutes before trying again",
            "• Check your usage at anthropic.com"
          ];
        } else if (
          errorMessage.includes("authentication") ||
          errorMessage.includes("401")
        ) {
          specificError = "Claude API authentication failed.";
          solutions = [
            "• Verify your API key is correct",
            "• Check if your API key has expired"
          ];
        } else if (errorMessage.includes("quota")) {
          specificError = "Claude API quota exceeded.";
          solutions = [
            "• Check your usage limits at anthropic.com",
            "• Upgrade your plan if needed"
          ];
        } else if (errorMessage.includes("Invalid request")) {
          specificError = "Invalid request sent to Claude.";
          solutions = [
            "• Check if the message format is correct",
            "• Try a simpler message to test"
          ];
        } else {
          // Generic error - check Claude authentication status
          solutions = [
            "• Run 'claude --version' to check Claude is working",
            "• For Claude Code Max users: ensure you're logged in with 'claude login'",
            "• For API users: ensure ANTHROPIC_API_KEY is set",
            "• Check the backend logs for more details"
          ];
        }

        yield {
          type: "error",
          error: `${specificError}\n\n` +
            "Possible solutions:\n" +
            solutions.join("\n") +
            "\n\nDebug info: " + errorMessage.substring(0, 300),
        };
      } else {
        console.error("[Chat] Claude query error:", error);
        yield {
          type: "error",
          error: errorMessage,
        };
      }
    }
  } finally {
    // Clean up AbortController from map
    if (requestAbortControllers.has(requestId)) {
      requestAbortControllers.delete(requestId);
    }
  }
}

/**
 * Handles POST /api/chat requests with streaming responses
 * @param c - Hono context object with config variables
 * @param requestAbortControllers - Shared map of abort controllers
 * @returns Response with streaming NDJSON
 */
export async function handleChatRequest(
  c: Context,
  requestAbortControllers: Map<string, AbortController>,
) {
  const chatRequest: ChatRequest = await c.req.json();
  const { debugMode } = c.var.config;

  if (debugMode) {
    console.debug(
      "[DEBUG] Received chat request:",
      JSON.stringify(chatRequest, null, 2),
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (
          const chunk of executeClaudeCommand(
            chatRequest.message,
            chatRequest.requestId,
            requestAbortControllers,
            chatRequest.sessionId,
            chatRequest.allowedTools,
            chatRequest.workingDirectory,
            chatRequest.thinking,
            debugMode,
          )
        ) {
          const data = JSON.stringify(chunk) + "\n";
          controller.enqueue(new TextEncoder().encode(data));
        }
        controller.close();
      } catch (error) {
        const errorResponse: StreamResponse = {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify(errorResponse) + "\n"),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
