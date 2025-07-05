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
} from "@heroicons/react/24/outline";
import type { ChatRequest, ChatMessage, ProjectInfo } from "../types";
import { THINKING_MODE_CONFIGS } from "../types";
import { useTheme } from "../hooks/useTheme";
import { useClaudeStreaming } from "../hooks/useClaudeStreaming";
import { useChatState } from "../hooks/chat/useChatState";
import { usePermissions } from "../hooks/chat/usePermissions";
import { useAbortController } from "../hooks/chat/useAbortController";
import { useSessionPersistence } from "../hooks/useSessionPersistence";
import { ThemeToggle } from "./chat/ThemeToggle";
import { HistoryButton } from "./chat/HistoryButton";
import { ChatInput } from "./chat/ChatInput";
import { ChatMessages } from "./chat/ChatMessages";
import { ThinkingModeSelector } from "./chat/ThinkingModeSelector";
import { PermissionDialog } from "./PermissionDialog";
import { HistoryView } from "./HistoryView";
import { SessionManager } from "./SessionManager";
import { BrowserPanel } from "./toolbar/BrowserPanel";
import { TerminalPanel } from "./toolbar/TerminalPanel";
import { ExplorerPanel } from "./toolbar/ExplorerPanel";
import { getChatUrl, getProjectsUrl } from "../config/api";
import { KEYBOARD_SHORTCUTS, BUTTON_STYLES } from "../utils/constants";
import type { StreamingContext } from "../hooks/streaming/useMessageProcessor";

// Tab type definition
type MainTab = "chat" | "browser" | "terminal" | "explorer";

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

  const {
    messages,
    input,
    isLoading,
    currentSessionId,
    currentRequestId,
    hasShownInitMessage,
    currentAssistantMessage,
    thinkingMode,
    setMessages,
    setInput,
    setCurrentSessionId,
    setHasShownInitMessage,
    setHasReceivedInit,
    setCurrentAssistantMessage,
    setThinkingMode,
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
  const { saveSession, loadSession, createNewSession } = useSessionPersistence({
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
        // Prepare thinking configuration
        const thinkingConfig =
          thinkingMode !== "auto"
            ? {
                type: "enabled" as const,
                budget_tokens: THINKING_MODE_CONFIGS[thinkingMode].budgetTokens,
              }
            : undefined;

        const response = await fetch(getChatUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            requestId,
            ...(currentSessionId ? { sessionId: currentSessionId } : {}),
            allowedTools: tools || allowedTools,
            ...(workingDirectory ? { workingDirectory } : {}),
            ...(thinkingConfig ? { thinking: thinkingConfig } : {}),
          } as ChatRequest),
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
          onSessionId: setCurrentSessionId,
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
      } catch (error) {
        console.error("Failed to send message:", error);
        addMessage({
          type: "chat",
          role: "assistant",
          content: "Error: Failed to get response",
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
      thinkingMode,
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

    if (currentSessionId) {
      sendMessage("continue", allowToolTemporary(pattern), true);
    }
  }, [
    permissionDialog,
    currentSessionId,
    sendMessage,
    allowToolTemporary,
    closePermissionDialog,
  ]);

  const handlePermissionAllowPermanent = useCallback(() => {
    if (!permissionDialog) return;

    const pattern = permissionDialog.pattern;
    const updatedAllowedTools = allowToolPermanent(pattern);
    closePermissionDialog();

    if (currentSessionId) {
      sendMessage("continue", updatedAllowedTools, true);
    }
  }, [
    permissionDialog,
    currentSessionId,
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
  const handleSessionSelect = useCallback(async (sessionId: string) => {
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
  }, [loadSession, setMessages, setCurrentSessionId, searchParams, setSearchParams]);

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
  }, [createNewSession, setMessages, setCurrentSessionId, setHasShownInitMessage, setHasReceivedInit, searchParams, setSearchParams]);

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
        <div className="flex items-center justify-between mb-4 md:mb-8 flex-shrink-0">
          <div className="flex items-center gap-4">
            {isHistoryView && (
              <button
                onClick={handleBackToChat}
                className={BUTTON_STYLES.ICON_BUTTON}
                aria-label="Back to chat"
              >
                <ChevronLeftIcon className="w-5 h-5 text-accent" />
              </button>
            )}
            <div>
              <h1 className="text-primary text-3xl font-bold tracking-tight text-gradient">
                {isHistoryView ? "Conversation History" : "Claude Code Web UI"}
              </h1>
              {workingDirectory && (
                <p className="text-tertiary text-sm font-mono mt-1">
                  {workingDirectory}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isHistoryView && <HistoryButton onClick={handleHistoryClick} />}
            <button
              onClick={handleOpenSettings}
              className={BUTTON_STYLES.ICON_BUTTON}
              aria-label="Settings"
            >
              <CogIcon className="w-5 h-5 text-accent" />
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
            <div className="flex-1 glass-card rounded-xl glow-effect flex flex-col min-h-0">
              {/* Tab Header */}
              <div className="flex items-center justify-between border-b border-accent/20 px-3 md:px-4 py-2 md:py-3 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab("chat")}
                    className={`
                      flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg smooth-transition text-sm font-medium
                      ${
                        activeTab === "chat"
                          ? "bg-gradient-primary text-primary glow-effect"
                          : "text-secondary hover:text-primary hover:bg-black-secondary/50"
                      }
                    `}
                  >
                    <ChatBubbleLeftIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Chat</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("browser")}
                    className={`
                      flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg smooth-transition text-sm font-medium
                      ${
                        activeTab === "browser"
                          ? "bg-gradient-primary text-primary glow-effect"
                          : "text-secondary hover:text-primary hover:bg-black-secondary/50"
                      }
                    `}
                  >
                    <ComputerDesktopIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Browser</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("terminal")}
                    className={`
                      flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg smooth-transition text-sm font-medium
                      ${
                        activeTab === "terminal"
                          ? "bg-gradient-primary text-primary glow-effect"
                          : "text-secondary hover:text-primary hover:bg-black-secondary/50"
                      }
                    `}
                  >
                    <CommandLineIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Terminal</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("explorer")}
                    className={`
                      flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg smooth-transition text-sm font-medium
                      ${
                        activeTab === "explorer"
                          ? "bg-gradient-primary text-primary glow-effect"
                          : "text-secondary hover:text-primary hover:bg-black-secondary/50"
                      }
                    `}
                  >
                    <FolderIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Explorer</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
                  className="p-2 text-tertiary hover:text-primary smooth-transition rounded-lg hover:bg-black-secondary/50"
                  aria-label={
                    isToolbarCollapsed ? "Expand toolbar" : "Collapse toolbar"
                  }
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Panel Content */}
              {!isToolbarCollapsed && (
                <div className="flex-1 p-3 md:p-4 min-h-0">
                  {/* Chat Interface */}
                  {activeTab === "chat" && (
                    <div className="h-full flex flex-col space-y-3 md:space-y-4 min-h-0">
                      {/* Chat Messages */}
                      <ChatMessages messages={messages} isLoading={isLoading} />

                      {/* Thinking Mode Selector */}
                      <div className="flex-shrink-0">
                        <ThinkingModeSelector
                          value={thinkingMode}
                          onChange={setThinkingMode}
                          disabled={isLoading}
                        />
                      </div>

                      {/* Chat Input */}
                      <ChatInput
                        input={input}
                        isLoading={isLoading}
                        currentRequestId={currentRequestId}
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
