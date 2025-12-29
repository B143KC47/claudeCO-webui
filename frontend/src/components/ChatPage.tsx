import { useEffect, useCallback, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeftIcon,
  CogIcon,
  ChatBubbleLeftIcon,
  ComputerDesktopIcon,
  CommandLineIcon,
  FolderIcon,
  XMarkIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import type { ChatRequest, ChatMessage, ProjectInfo } from "../types";
import { THINKING_MODE_CONFIGS, type ThinkingMode } from "../types";
import { useTheme } from "../hooks/useTheme";
import { useClaudeStreaming } from "../hooks/useClaudeStreaming";
import { useChatState } from "../hooks/chat/useChatState";
import { usePermissions } from "../hooks/chat/usePermissions";
import { useAbortController } from "../hooks/chat/useAbortController";
import { useSessionPersistence } from "../hooks/useSessionPersistence";
import { useCommandSuggestions } from "../hooks/useCommandSuggestions";
import { useSlashCommands } from "../hooks/useSlashCommands";
import { ThemeToggle } from "./chat/ThemeToggle";
import { HistoryButton } from "./chat/HistoryButton";
import { ChatInput } from "./chat/ChatInput";
import { ChatMessages } from "./chat/ChatMessages";
import { PermissionDialog } from "./PermissionDialog";
import { HistoryView } from "./HistoryView";
import { SessionManager } from "./SessionManager";
import { BrowserPanel } from "./toolbar/BrowserPanel";
import { TerminalPanel } from "./toolbar/TerminalPanel";
import { ExplorerPanel } from "./toolbar/ExplorerPanel";
import { GitPanel } from "./toolbar/GitPanel";
import { getChatUrl, getProjectsUrl } from "../config/api";
import { KEYBOARD_SHORTCUTS, BUTTON_STYLES } from "../utils/constants";
import type { StreamingContext } from "../hooks/streaming/useMessageProcessor";
import { useLanguage } from "../contexts/LanguageContext";

// Tab type definition
type MainTab = "chat" | "browser" | "terminal" | "explorer" | "git";

export function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeTab, setActiveTab] = useState<MainTab>("chat");
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [showSessionManager, setShowSessionManager] = useState(false);

  // Extract and normalize working directory from URL
  const workingDirectory = (() => {
    const rawPath = location.pathname.replace("/projects", "");
    if (!rawPath) return undefined;

    // URL decode the path
    const decodedPath = decodeURIComponent(rawPath);

    console.log("[ChatPage] Extracted working directory from URL:");
    console.log("  Raw path:", rawPath);
    console.log("  Decoded path:", decodedPath);

    return decodedPath;
  })();

  // Get current view from query parameters
  const currentView = searchParams.get("view");
  const urlSessionId = searchParams.get("sessionId");
  const isHistoryView = currentView === "history";

  const { theme, toggleTheme } = useTheme();
  const { processStreamLine } = useClaudeStreaming();
  const { abortRequest, createAbortHandler } = useAbortController();
  const { t } = useLanguage();

  // Command suggestions hook for auto-updating showcase
  const { suggestions: commandSuggestions } =
    useCommandSuggestions(workingDirectory);

  const {
    messages,
    input,
    isLoading,
    currentSessionId,
    currentRequestId,
    hasShownInitMessage,
    currentAssistantMessage,
    setMessages,
    setInput,
    setCurrentSessionId,
    setHasShownInitMessage,
    setHasReceivedInit,
    setCurrentAssistantMessage,
    addMessage,
    updateLastMessage,
    clearInput,
    generateRequestId,
    resetRequestState,
    startRequest,
  } = useChatState();

  const {
    allowedTools,
    permissionDialog,
    showPermissionDialog,
    closePermissionDialog,
    allowToolTemporary,
    allowToolPermanent,
  } = usePermissions();

  // Session persistence
  const { loadSession, createNewSession } = useSessionPersistence({
    messages,
    currentSessionId,
    workingDirectory,
    onSessionIdChange: (sessionId) => {
      setCurrentSessionId(sessionId);
      // Update URL with new session ID
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set("sessionId", sessionId);
      setSearchParams(newSearchParams);
    },
  });

  // Slash command handlers
  const handleClearCommand = useCallback(() => {
    console.log("[SlashCommand] Clearing chat");
    setMessages([]);
    setHasShownInitMessage(false);
    setHasReceivedInit(false);
    setCurrentAssistantMessage(null);

    // Add system message to indicate clear
    addMessage({
      type: "system",
      subtype: "info",
      message: "Chat cleared. Session continues with existing context.",
      timestamp: Date.now(),
    });
  }, [setMessages, setHasShownInitMessage, setHasReceivedInit, setCurrentAssistantMessage, addMessage]);

  const handleNewCommand = useCallback(async () => {
    console.log("[SlashCommand] Starting new session");
    setMessages([]);
    setHasShownInitMessage(false);
    setHasReceivedInit(false);
    setCurrentAssistantMessage(null);

    // Create new session
    const newSessionId = await createNewSession();
    setCurrentSessionId(newSessionId);

    // Update URL
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("sessionId", newSessionId);
    setSearchParams(newSearchParams);

    // Add system message
    addMessage({
      type: "system",
      subtype: "info",
      message: `New session started: ${newSessionId.substring(0, 8)}...`,
      timestamp: Date.now(),
    });
  }, [
    setMessages,
    setHasShownInitMessage,
    setHasReceivedInit,
    setCurrentAssistantMessage,
    createNewSession,
    setCurrentSessionId,
    searchParams,
    setSearchParams,
    addMessage,
  ]);

  const handleHelpCommand = useCallback(() => {
    console.log("[SlashCommand] Showing help");
    const helpMessage = `
**Available Slash Commands:**

**Client-Side Commands** (handled locally):
• \`/clear\` - Clear the chat display
• \`/new\` - Start a new session
• \`/help\` - Show this help message

**Claude CLI Commands** (sent to backend):
• \`/model [name]\` - Switch Claude model (opus, sonnet, haiku)
• \`/cost\` - Show token usage and costs
• \`/permissions\` - Manage tool permissions
• \`/agents\` - View available subagents
• \`/plugin [action]\` - Manage plugins
• \`/resume [session-id]\` - Resume a previous session

**Custom Commands:**
• Project commands from \`.claude/commands/\`
• Personal commands from \`~/.claude/commands/\`
• MCP commands: \`/mcp__servername__command\`
• Plugin commands: \`/pluginname:command\`

Type \`/\` to see all available commands with autocomplete.
    `.trim();

    addMessage({
      type: "chat",
      role: "assistant",
      content: helpMessage,
      timestamp: Date.now(),
    });
  }, [addMessage]);

  const { processCommand } = useSlashCommands({
    onClear: handleClearCommand,
    onNew: handleNewCommand,
    onHelp: handleHelpCommand,
  });

  const handlePermissionError = useCallback(
    (toolName: string, pattern: string, toolUseId: string) => {
      showPermissionDialog(toolName, pattern, toolUseId);
    },
    [showPermissionDialog],
  );

  const sendMessage = useCallback(
    async (
      messageContent?: string,
      tools?: string[],
      hideUserMessage = false,
    ) => {
      const content = messageContent || input.trim();
      if (!content || isLoading) return;

      // Process slash commands
      const commandResult = processCommand(content);

      if (commandResult.handled && !commandResult.shouldSendToBackend) {
        // Command was handled client-side, don't send to backend
        console.log(`[SlashCommand] Handled locally: ${content}`);
        if (!messageContent) clearInput();
        return;
      }

      // Use existing session ID or let Claude SDK create one
      const sessionId = currentSessionId;
      if (!sessionId) {
        console.log(
          "[Session] No current session, will let Claude SDK create one",
        );
      } else {
        console.log("[Session] Using existing session:", sessionId);
      }

      const requestId = generateRequestId();

      // Only add user message to chat if not hidden
      if (!hideUserMessage) {
        const userMessage: ChatMessage = {
          type: "chat",
          role: "user",
          content: content,
          timestamp: Date.now(),
        };
        addMessage(userMessage);
      }

      if (!messageContent) clearInput();
      startRequest();

      try {
        // Thinking mode is always set to auto (no manual mode selection)
        const thinkingMode: ThinkingMode = "auto";

        // Prepare thinking configuration
        const thinkingConfig =
          thinkingMode !== "auto"
            ? {
                type: "enabled" as const,
                budget_tokens: THINKING_MODE_CONFIGS[thinkingMode].budgetTokens,
              }
            : undefined;

        const requestBody = {
          message: content,
          requestId,
          ...(sessionId ? { sessionId } : {}),
          allowedTools: tools || allowedTools,
          ...(workingDirectory ? { workingDirectory } : {}),
          ...(thinkingConfig ? { thinking: thinkingConfig } : {}),
        } as ChatRequest;

        console.log("[Session] Sending request with body:", requestBody);

        const response = await fetch(getChatUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Local state for this streaming session
        let localHasReceivedInit = false;
        let shouldAbort = false;

        const streamingContext: StreamingContext = {
          currentAssistantMessage,
          setCurrentAssistantMessage,
          addMessage,
          updateLastMessage,
          onSessionId: (newSessionId: string) => {
            console.log(
              "[Session] Received session ID from SDK:",
              newSessionId,
            );
            setCurrentSessionId(newSessionId);

            // Update URL with new session ID from SDK
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.set("sessionId", newSessionId);
            setSearchParams(newSearchParams);
          },
          sessionId: currentSessionId ?? undefined,
          shouldShowInitMessage: () => !hasShownInitMessage,
          onInitMessageShown: () => setHasShownInitMessage(true),
          get hasReceivedInit() {
            return localHasReceivedInit;
          },
          setHasReceivedInit: (received: boolean) => {
            localHasReceivedInit = received;
            setHasReceivedInit(received);
          },
          onPermissionError: handlePermissionError,
          onAbortRequest: async () => {
            shouldAbort = true;
            await createAbortHandler(requestId)();
          },
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || shouldAbort) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n").filter((line) => line.trim());

            for (const line of lines) {
              if (shouldAbort) break;
              processStreamLine(line, streamingContext);
            }

            if (shouldAbort) break;
          }
        } catch (readError) {
          // Handle read errors separately to catch connection issues
          if (
            readError instanceof TypeError &&
            readError.message.includes("Failed to fetch")
          ) {
            console.error("Connection to backend lost");
            addMessage({
              type: "error",
              subtype: "stream_error",
              message:
                "Connection to backend server lost. Please ensure the backend is running.",
              timestamp: Date.now(),
            });
          } else {
            throw readError;
          }
        }
      } catch (error) {
        // Suppress Chrome extension errors
        if (
          error instanceof Error &&
          error.message.includes("message port closed")
        ) {
          console.warn("Chrome extension communication error (ignored)");
          return;
        }

        console.error("Failed to send message:", error);
        addMessage({
          type: "chat",
          role: "assistant",
          content:
            "Error: Failed to get response. Please check if the backend server is running.",
          timestamp: Date.now(),
        });
      } finally {
        resetRequestState();
      }
    },
    [
      input,
      isLoading,
      currentSessionId,
      allowedTools,
      hasShownInitMessage,
      currentAssistantMessage,
      workingDirectory,
      processCommand,
      generateRequestId,
      clearInput,
      startRequest,
      addMessage,
      updateLastMessage,
      setCurrentSessionId,
      setHasShownInitMessage,
      setHasReceivedInit,
      setCurrentAssistantMessage,
      resetRequestState,
      processStreamLine,
      handlePermissionError,
      createAbortHandler,
      createNewSession,
      searchParams,
      setSearchParams,
    ],
  );

  const handleAbort = useCallback(() => {
    abortRequest(currentRequestId, isLoading, resetRequestState);
  }, [abortRequest, currentRequestId, isLoading, resetRequestState]);

  // Permission dialog handlers
  const handlePermissionAllow = useCallback(() => {
    if (!permissionDialog) return;

    const pattern = permissionDialog.pattern;
    closePermissionDialog();

    // Send continue message with allowed tools
    sendMessage("continue", allowToolTemporary(pattern), true);
  }, [
    permissionDialog,
    sendMessage,
    allowToolTemporary,
    closePermissionDialog,
  ]);

  const handlePermissionAllowPermanent = useCallback(() => {
    if (!permissionDialog) return;

    const pattern = permissionDialog.pattern;
    const updatedAllowedTools = allowToolPermanent(pattern);
    closePermissionDialog();

    // Send continue message with updated allowed tools
    sendMessage("continue", updatedAllowedTools, true);
  }, [
    permissionDialog,
    sendMessage,
    allowToolPermanent,
    closePermissionDialog,
  ]);

  const handlePermissionDeny = useCallback(() => {
    closePermissionDialog();
  }, [closePermissionDialog]);

  const handleHistoryClick = useCallback(() => {
    setShowSessionManager(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    navigate("/settings");
  }, [navigate]);

  // Session management handlers
  const handleSessionSelect = useCallback(
    async (sessionId: string) => {
      const loadedMessages = await loadSession(sessionId);
      if (loadedMessages.length > 0) {
        setMessages(loadedMessages);
        setCurrentSessionId(sessionId);

        // Update URL with selected session
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set("sessionId", sessionId);
        setSearchParams(newSearchParams);
      }
      setShowSessionManager(false);
    },
    [
      loadSession,
      setMessages,
      setCurrentSessionId,
      searchParams,
      setSearchParams,
    ],
  );

  const handleSessionCreate = useCallback(async () => {
    // Clear current session
    setMessages([]);
    setHasShownInitMessage(false);
    setHasReceivedInit(false);

    // Create new session
    const newSessionId = await createNewSession();
    setCurrentSessionId(newSessionId);

    // Update URL
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("sessionId", newSessionId);
    setSearchParams(newSearchParams);

    setShowSessionManager(false);
  }, [
    createNewSession,
    setMessages,
    setCurrentSessionId,
    setHasShownInitMessage,
    setHasReceivedInit,
    searchParams,
    setSearchParams,
  ]);

  // Load session from URL on mount
  useEffect(() => {
    if (urlSessionId && urlSessionId !== currentSessionId) {
      handleSessionSelect(urlSessionId);
    }
  }, [urlSessionId]);

  // Load projects to get encodedName mapping
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch(getProjectsUrl());
        if (response.ok) {
          const data = await response.json();
          setProjects(data.projects || []);
        }
      } catch (error) {
        console.error("Failed to load projects:", error);
      }
    };
    loadProjects();
  }, []);

  // Get encoded name for current working directory
  const getEncodedName = useCallback(() => {
    if (!workingDirectory || !projects.length) {
      return null;
    }

    const project = projects.find((p) => p.path === workingDirectory);
    return project?.encodedName || null;
  }, [workingDirectory, projects]);

  const handleBackToChat = useCallback(() => {
    navigate({ search: "" });
  }, [navigate]);

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === KEYBOARD_SHORTCUTS.ABORT && isLoading && currentRequestId) {
        e.preventDefault();
        handleAbort();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isLoading, currentRequestId, handleAbort]);

  return (
    <div className="fullscreen-page mobile-optimized">
      <div className="w-full h-full flex flex-col px-2 sm:px-4 md:px-6 py-4 md:py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-10 flex-shrink-0 pb-4 border-b border-accent/10">
          <div className="flex items-center gap-4">
            {isHistoryView && (
              <button
                onClick={handleBackToChat}
                className={`${BUTTON_STYLES.ICON_BUTTON} modern-button hover:bg-accent/15`}
                aria-label={t("chat.backToChat")}
              >
                <ChevronLeftIcon className="w-5 h-5 text-accent" />
              </button>
            )}
            <div>
              <h1 className="text-primary text-4xl md:text-5xl font-black tracking-tight enhanced-text-gradient drop-shadow-lg">
                {isHistoryView
                  ? t("chat.conversationHistory")
                  : t("chat.title")}
              </h1>
              {workingDirectory && (
                <p className="text-tertiary text-sm font-mono mt-2 px-3 py-1.5 bg-black-quaternary/50 rounded-lg inline-block border border-accent/10">
                  📁 {workingDirectory}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isHistoryView && <HistoryButton onClick={handleHistoryClick} />}
            <button
              onClick={handleOpenSettings}
              className={`${BUTTON_STYLES.ICON_BUTTON} modern-button hover:bg-accent/15 hover:scale-110`}
              aria-label={t("nav.settings")}
            >
              <CogIcon className="w-6 h-6 text-accent" />
            </button>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>

        {/* Main Content */}
        {isHistoryView ? (
          <HistoryView
            workingDirectory={workingDirectory || ""}
            encodedName={getEncodedName()}
            onBack={handleBackToChat}
          />
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="flex-1 glass-card rounded-3xl glow-effect flex flex-col min-h-0 border border-accent/15 card-transition shadow-xl">
              {/* Tab Header */}
              <div className="flex items-center justify-between border-b border-accent/15 px-4 md:px-5 py-3 md:py-4 flex-shrink-0 bg-gradient-to-r from-black-secondary/50 to-transparent backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("chat")}
                    className={`
                      flex items-center gap-2.5 px-3 md:px-4 py-2.5 rounded-xl smooth-transition text-sm font-bold
                      ${
                        activeTab === "chat"
                          ? "bg-gradient-primary text-white shadow-lg scale-105"
                          : "text-secondary hover:text-primary hover:bg-black-secondary/50 hover:scale-105"
                      }
                    `}
                  >
                    <ChatBubbleLeftIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("chat.chat")}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("browser")}
                    className={`
                      flex items-center gap-2.5 px-3 md:px-4 py-2.5 rounded-xl smooth-transition text-sm font-bold
                      ${
                        activeTab === "browser"
                          ? "bg-gradient-primary text-white shadow-lg scale-105"
                          : "text-secondary hover:text-primary hover:bg-black-secondary/50 hover:scale-105"
                      }
                    `}
                  >
                    <ComputerDesktopIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {t("chat.browser")}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("terminal")}
                    className={`
                      flex items-center gap-2.5 px-3 md:px-4 py-2.5 rounded-xl smooth-transition text-sm font-bold
                      ${
                        activeTab === "terminal"
                          ? "bg-gradient-primary text-white shadow-lg scale-105"
                          : "text-secondary hover:text-primary hover:bg-black-secondary/50 hover:scale-105"
                      }
                    `}
                  >
                    <CommandLineIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {t("chat.terminal")}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("explorer")}
                    className={`
                      flex items-center gap-2.5 px-3 md:px-4 py-2.5 rounded-xl smooth-transition text-sm font-bold
                      ${
                        activeTab === "explorer"
                          ? "bg-gradient-primary text-white shadow-lg scale-105"
                          : "text-secondary hover:text-primary hover:bg-black-secondary/50 hover:scale-105"
                      }
                    `}
                  >
                    <FolderIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {t("chat.explorer")}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("git")}
                    className={`
                      flex items-center gap-2.5 px-3 md:px-4 py-2.5 rounded-xl smooth-transition text-sm font-bold
                      ${
                        activeTab === "git"
                          ? "bg-gradient-primary text-white shadow-lg scale-105"
                          : "text-secondary hover:text-primary hover:bg-black-secondary/50 hover:scale-105"
                      }
                    `}
                  >
                    <CodeBracketIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Git</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
                  className="p-2.5 text-tertiary hover:text-primary smooth-transition rounded-xl hover:bg-black-secondary/50 modern-button"
                  aria-label={
                    isToolbarCollapsed
                      ? t("chat.expandToolbar")
                      : t("chat.collapseToolbar")
                  }
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Panel Content */}
              {!isToolbarCollapsed && (
                <div className="flex-1 p-3 md:p-4 min-h-0">
                  {/* Chat Interface */}
                  {activeTab === "chat" && (
                    <div className="h-full flex flex-col space-y-3 md:space-y-4 min-h-0">
                      {/* Chat Messages */}
                      <ChatMessages
                        messages={messages}
                        isLoading={isLoading}
                        suggestions={commandSuggestions}
                        onCommandClick={(command) => {
                          setInput(command);
                          // Optionally auto-send the command
                          // sendMessage(command);
                        }}
                      />

                      {/* Chat Input */}
                      <ChatInput
                        input={input}
                        isLoading={isLoading}
                        currentRequestId={currentRequestId}
                        workingDirectory={workingDirectory}
                        onInputChange={setInput}
                        onSubmit={() => sendMessage()}
                        onAbort={handleAbort}
                      />
                    </div>
                  )}

                  {/* Browser Panel */}
                  {activeTab === "browser" && (
                    <div className="h-full">
                      <BrowserPanel />
                    </div>
                  )}

                  {/* Terminal Panel */}
                  {activeTab === "terminal" && (
                    <div className="h-full">
                      <TerminalPanel workingDirectory={workingDirectory} />
                    </div>
                  )}

                  {/* Explorer Panel */}
                  {activeTab === "explorer" && (
                    <div className="h-full">
                      <ExplorerPanel workingDirectory={workingDirectory} />
                    </div>
                  )}

                  {/* Git Panel */}
                  {activeTab === "git" && workingDirectory && (
                    <div className="h-full relative">
                      <GitPanel
                        isOpen={true}
                        onClose={() => setActiveTab("chat")}
                        workingDirectory={workingDirectory}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Collapsed State */}
            {isToolbarCollapsed && (
              <div className="mb-2 md:mb-4">
                <button
                  onClick={() => setIsToolbarCollapsed(false)}
                  className="px-3 py-2 glass-button glow-border smooth-transition rounded-lg text-sm text-secondary hover:text-primary"
                >
                  Show Toolbar
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Permission Dialog */}
      {permissionDialog && (
        <PermissionDialog
          isOpen={permissionDialog.isOpen}
          toolName={permissionDialog.toolName}
          pattern={permissionDialog.pattern}
          onAllow={handlePermissionAllow}
          onAllowPermanent={handlePermissionAllowPermanent}
          onDeny={handlePermissionDeny}
          onClose={closePermissionDialog}
        />
      )}

      {/* Session Manager */}
      {showSessionManager && (
        <SessionManager
          currentSessionId={currentSessionId}
          workingDirectory={workingDirectory}
          onSessionSelect={handleSessionSelect}
          onSessionCreate={handleSessionCreate}
          onClose={() => setShowSessionManager(false)}
        />
      )}
    </div>
  );
}
