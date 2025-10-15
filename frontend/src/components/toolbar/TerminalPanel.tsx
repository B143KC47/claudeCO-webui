import { useState, useRef, useEffect } from "react";
import {
  CommandLineIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  XMarkIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

interface TerminalEntry {
  id: number;
  type: "command" | "output" | "error";
  content: string;
  timestamp: Date;
}

interface SystemInfo {
  username: string;
  hostname: string;
  platform: string;
  homeDirectory: string;
  currentWorkingDirectory: string;
  isWSL: boolean;
}

interface TerminalSession {
  id: string;
  name: string;
  entries: TerminalEntry[];
  commandHistory: string[];
  historyIndex: number;
  isExecuting: boolean;
  currentRequestId: string | null;
  currentWorkingDirectory: string;
  currentCommand: string;
  systemInfo: SystemInfo | null;
  createdAt: Date;
}

interface TerminalPanelProps {
  workingDirectory?: string;
}

interface TerminalRequest {
  command: string;
  workingDirectory?: string;
  requestId: string;
  shell?: string;
}

interface TerminalStreamResponse {
  type: "stdout" | "stderr" | "error" | "exit" | "start";
  data?: string;
  exitCode?: number;
  error?: string;
}

// Maximum number of terminal sessions allowed
const MAX_TERMINALS = 6;

// Helper function to generate unique session ID
const generateSessionId = () =>
  `terminal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Helper function to create a new terminal session
const createInitialSession = (
  workingDir: string,
  sessionNumber: number,
): TerminalSession => ({
  id: generateSessionId(),
  name: `Terminal ${sessionNumber}`,
  entries: [],
  commandHistory: [],
  historyIndex: -1,
  isExecuting: false,
  currentRequestId: null,
  currentWorkingDirectory: workingDir,
  currentCommand: "",
  systemInfo: null,
  createdAt: new Date(),
});

export function TerminalPanel({ workingDirectory = "~" }: TerminalPanelProps) {
  // Multi-session state management
  const [sessions, setSessions] = useState<TerminalSession[]>(() => [
    createInitialSession(workingDirectory, 1),
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => sessions[0]?.id || "",
  );

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get active session
  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Helper function to update active session
  const updateActiveSession = (updates: Partial<TerminalSession>) => {
    setSessions((prevSessions) =>
      prevSessions.map((session) =>
        session.id === activeSessionId ? { ...session, ...updates } : session,
      ),
    );
  };

  // Create new terminal session
  const createNewSession = () => {
    if (sessions.length >= MAX_TERMINALS) {
      return;
    }

    const newSession = createInitialSession(
      workingDirectory,
      sessions.length + 1,
    );
    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newSession.id);

    // Load system info for new session
    loadSystemInfo(newSession.id);
  };

  // Close terminal session
  const closeSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);

    // Confirm if command is executing
    if (session?.isExecuting) {
      const confirmed = window.confirm(
        "A command is currently running in this terminal. Are you sure you want to close it?",
      );
      if (!confirmed) return;

      // Abort the running command
      if (session.currentRequestId) {
        fetch(`/api/terminal/abort/${session.currentRequestId}`, {
          method: "POST",
        }).catch(console.error);
      }
    }

    // Don't allow closing the last terminal
    if (sessions.length === 1) {
      // Instead of closing, clear the terminal
      setSessions([createInitialSession(workingDirectory, 1)]);
      setActiveSessionId(sessions[0].id);
      return;
    }

    // Remove session
    const newSessions = sessions.filter((s) => s.id !== sessionId);
    setSessions(newSessions);

    // Update active session if needed
    if (activeSessionId === sessionId) {
      setActiveSessionId(newSessions[0].id);
    }
  };

  // Auto-scroll to bottom when new entries are added to active session
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [activeSession?.entries, activeSessionId]);

  // Focus terminal input when clicked
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  // Load system info for a specific session
  const loadSystemInfo = async (sessionId: string) => {
    try {
      const response = await fetch("/api/terminal/info");
      if (response.ok) {
        const info = await response.json();

        setSessions((prevSessions) =>
          prevSessions.map((session) => {
            if (session.id !== sessionId) return session;

            // Only use system info directory if user hasn't selected a specific project directory
            const effectiveWorkingDirectory =
              workingDirectory && workingDirectory !== "~"
                ? workingDirectory
                : info.currentWorkingDirectory || workingDirectory;

            // Update working directory only if we don't have a user-specified one
            const finalWorkingDirectory =
              !workingDirectory || workingDirectory === "~"
                ? effectiveWorkingDirectory
                : session.currentWorkingDirectory;

            // Add welcome message
            const welcomeEntry: TerminalEntry = {
              id: Date.now(),
              type: "output",
              content: `Welcome to ${info.platform === "linux" && info.isWSL ? "WSL" : info.platform} Terminal\nUser: ${info.username}@${info.hostname}\nWorking Directory: ${finalWorkingDirectory}\n`,
              timestamp: new Date(),
            };

            return {
              ...session,
              systemInfo: info,
              currentWorkingDirectory: finalWorkingDirectory,
              entries: [welcomeEntry],
            };
          }),
        );
      }
    } catch (error) {
      console.error("Failed to load system info:", error);

      setSessions((prevSessions) =>
        prevSessions.map((session) => {
          if (session.id !== sessionId) return session;

          const fallbackEntry: TerminalEntry = {
            id: Date.now(),
            type: "output",
            content: `Welcome to Terminal\nWorking Directory: ${workingDirectory}\n`,
            timestamp: new Date(),
          };

          return {
            ...session,
            entries: [fallbackEntry],
          };
        }),
      );
    }
  };

  // Load system info on component mount for initial session
  useEffect(() => {
    if (sessions.length > 0 && sessions[0]) {
      loadSystemInfo(sessions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus input when switching sessions
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeSessionId]);

  // Keyboard shortcuts for terminal management
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Ctrl+Shift+T: New terminal
      if (e.ctrlKey && e.shiftKey && e.key === "T") {
        e.preventDefault();
        if (sessions.length < MAX_TERMINALS) {
          createNewSession();
        }
        return;
      }

      // Ctrl+Shift+W: Close terminal
      if (e.ctrlKey && e.shiftKey && e.key === "W") {
        e.preventDefault();
        closeSession(activeSessionId);
        return;
      }

      // Ctrl+Tab: Next terminal
      if (e.ctrlKey && e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = sessions.findIndex(
          (s) => s.id === activeSessionId,
        );
        const nextIndex = (currentIndex + 1) % sessions.length;
        setActiveSessionId(sessions[nextIndex].id);
        return;
      }

      // Ctrl+Shift+Tab: Previous terminal
      if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        const currentIndex = sessions.findIndex(
          (s) => s.id === activeSessionId,
        );
        const prevIndex =
          currentIndex === 0 ? sessions.length - 1 : currentIndex - 1;
        setActiveSessionId(sessions[prevIndex].id);
        return;
      }

      // Ctrl+1 through Ctrl+6: Switch to terminal N
      if (e.ctrlKey && e.key >= "1" && e.key <= "6") {
        e.preventDefault();
        const terminalIndex = parseInt(e.key) - 1;
        if (terminalIndex < sessions.length) {
          setActiveSessionId(sessions[terminalIndex].id);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, activeSessionId]);

  // Update working directory when prop changes
  useEffect(() => {
    // Always update when workingDirectory prop changes - this ensures user selection takes priority
    if (workingDirectory) {
      updateActiveSession({ currentWorkingDirectory: workingDirectory });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingDirectory]);

  // Detect and handle directory-changing commands
  const updateWorkingDirectoryFromCommand = (
    command: string,
    output: string,
  ) => {
    const trimmedCommand = command.trim().toLowerCase();

    // Handle 'pwd' command output
    if (trimmedCommand === "pwd" && output.trim().startsWith("/")) {
      const newDir = output.trim();
      if (newDir !== activeSession.currentWorkingDirectory) {
        updateActiveSession({ currentWorkingDirectory: newDir });
      }
      return;
    }

    // Handle 'cd' commands - but don't execute pwd automatically to avoid recursion
    if (trimmedCommand.startsWith("cd ")) {
      // For now, we'll let the backend handle the directory change
      // The working directory will be updated when the user manually runs pwd
      // or we could implement a smarter way to detect directory changes
    }
  };

  // Generate terminal title based on system info
  const getTerminalTitle = () => {
    const systemInfo = activeSession.systemInfo;
    const currentWorkingDirectory = activeSession.currentWorkingDirectory;

    if (!systemInfo) {
      return `${activeSession.name} - ${currentWorkingDirectory}`;
    }

    const platform = systemInfo.platform;
    const wsuffix = systemInfo.isWSL ? " (WSL)" : "";

    if (platform === "windows") {
      return `${activeSession.name}${wsuffix} - ${currentWorkingDirectory}`;
    } else if (platform === "darwin") {
      return `${activeSession.name} - ${currentWorkingDirectory}`;
    } else if (platform === "linux") {
      return `${activeSession.name}${wsuffix} - ${currentWorkingDirectory}`;
    } else {
      return `${activeSession.name} - ${currentWorkingDirectory}`;
    }
  };

  // Generate prompt based on system info
  const getPrompt = () => {
    const systemInfo = activeSession.systemInfo;
    const currentWorkingDirectory = activeSession.currentWorkingDirectory;

    const username = systemInfo?.username || "user";
    const hostname = systemInfo?.hostname || "claude";

    // Process working directory for display
    let displayDirectory = currentWorkingDirectory;

    // Simplify home directory display
    if (
      systemInfo?.homeDirectory &&
      displayDirectory.startsWith(systemInfo.homeDirectory)
    ) {
      if (displayDirectory === systemInfo.homeDirectory) {
        displayDirectory = "~";
      } else {
        displayDirectory =
          "~" + displayDirectory.substring(systemInfo.homeDirectory.length);
      }
    }

    // If directory is too long, show only the last few components
    if (displayDirectory.length > 50) {
      const parts = displayDirectory.split("/");
      if (parts.length > 3) {
        displayDirectory = ".../" + parts.slice(-2).join("/");
      }
    }

    return `${username}@${hostname}:${displayDirectory}$ `;
  };

  // Execute command via backend API
  const executeCommand = async (command: string): Promise<void> => {
    const requestId = `terminal-${Date.now()}-${Math.random()}`;
    updateActiveSession({
      currentRequestId: requestId,
      isExecuting: true,
    });

    // Store the command for directory tracking
    const originalCommand = command.trim();

    try {
      const terminalRequest: TerminalRequest = {
        command: originalCommand,
        workingDirectory: activeSession.currentWorkingDirectory,
        requestId,
        shell: "bash", // Use bash for WSL compatibility
      };

      const response = await fetch("/api/terminal/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(terminalRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let commandOutput = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const streamResponse: TerminalStreamResponse = JSON.parse(line);
              if (streamResponse.type === "stdout" && streamResponse.data) {
                commandOutput += streamResponse.data;
              }
              handleStreamResponse(streamResponse);
            } catch (e) {
              console.error("Error parsing stream response:", e);
            }
          }
        }
      }

      // Handle any remaining buffer content
      if (buffer.trim()) {
        try {
          const streamResponse: TerminalStreamResponse = JSON.parse(buffer);
          if (streamResponse.type === "stdout" && streamResponse.data) {
            commandOutput += streamResponse.data;
          }
          handleStreamResponse(streamResponse);
        } catch (e) {
          console.error("Error parsing final stream response:", e);
        }
      }

      // Check for directory changes after command completes
      updateWorkingDirectoryFromCommand(originalCommand, commandOutput);
    } catch (error) {
      console.error("Error executing command:", error);

      const errorEntry: TerminalEntry = {
        id: Date.now(),
        type: "error",
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };

      updateActiveSession({
        entries: [...activeSession.entries, errorEntry],
      });
    } finally {
      updateActiveSession({
        isExecuting: false,
        currentRequestId: null,
      });
    }
  };

  // Handle different types of stream responses
  const handleStreamResponse = (response: TerminalStreamResponse) => {
    switch (response.type) {
      case "start":
        // Command started - no action needed
        break;

      case "stdout":
        if (response.data) {
          const outputEntry: TerminalEntry = {
            id: Date.now() + Math.random(),
            type: "output",
            content: response.data,
            timestamp: new Date(),
          };
          updateActiveSession({
            entries: [...activeSession.entries, outputEntry],
          });
        }
        break;

      case "stderr":
        if (response.data) {
          const errorEntry: TerminalEntry = {
            id: Date.now() + Math.random(),
            type: "error",
            content: response.data,
            timestamp: new Date(),
          };
          updateActiveSession({
            entries: [...activeSession.entries, errorEntry],
          });
        }
        break;

      case "error": {
        const errorEntry: TerminalEntry = {
          id: Date.now() + Math.random(),
          type: "error",
          content: `Error: ${response.error || "Unknown error"}`,
          timestamp: new Date(),
        };
        updateActiveSession({
          entries: [...activeSession.entries, errorEntry],
        });
        break;
      }

      case "exit":
        // Command completed - could show exit code if non-zero
        if (response.exitCode && response.exitCode !== 0) {
          const exitEntry: TerminalEntry = {
            id: Date.now() + Math.random(),
            type: "error",
            content: `Process exited with code ${response.exitCode}`,
            timestamp: new Date(),
          };
          updateActiveSession({
            entries: [...activeSession.entries, exitEntry],
          });
        }
        break;
    }
  };

  // Cancel current command execution
  const cancelCommand = async () => {
    if (activeSession.currentRequestId) {
      try {
        await fetch(`/api/terminal/abort/${activeSession.currentRequestId}`, {
          method: "POST",
        });
      } catch (error) {
        console.error("Error cancelling command:", error);
      }
    }
    updateActiveSession({
      isExecuting: false,
      currentRequestId: null,
    });
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeSession.currentCommand.trim() || activeSession.isExecuting)
      return;

    // Handle clear command locally for immediate response
    if (activeSession.currentCommand.trim().toLowerCase() === "clear") {
      updateActiveSession({
        entries: [],
        currentCommand: "",
        commandHistory: [
          ...activeSession.commandHistory,
          activeSession.currentCommand,
        ],
        historyIndex: -1,
      });
      return;
    }

    // Add command to entries
    const commandEntry: TerminalEntry = {
      id: Date.now(),
      type: "command",
      content: activeSession.currentCommand,
      timestamp: new Date(),
    };

    const cmd = activeSession.currentCommand;

    updateActiveSession({
      entries: [...activeSession.entries, commandEntry],
      commandHistory: [
        ...activeSession.commandHistory,
        activeSession.currentCommand,
      ],
      currentCommand: "",
      historyIndex: -1,
    });

    // Execute command
    await executeCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (activeSession.commandHistory.length > 0) {
        const newIndex = activeSession.historyIndex + 1;
        if (newIndex < activeSession.commandHistory.length) {
          updateActiveSession({
            historyIndex: newIndex,
            currentCommand:
              activeSession.commandHistory[
                activeSession.commandHistory.length - 1 - newIndex
              ],
          });
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (activeSession.historyIndex > 0) {
        const newIndex = activeSession.historyIndex - 1;
        updateActiveSession({
          historyIndex: newIndex,
          currentCommand:
            activeSession.commandHistory[
              activeSession.commandHistory.length - 1 - newIndex
            ],
        });
      } else if (activeSession.historyIndex === 0) {
        updateActiveSession({
          historyIndex: -1,
          currentCommand: "",
        });
      }
    }
  };

  const clearTerminal = () => {
    updateActiveSession({
      entries: [],
    });
  };

  const copyEntry = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {
      // Fallback for clipboard API
      console.log("Could not copy to clipboard");
    });
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Terminal Tabs Bar */}
      <div
        role="tablist"
        className="flex items-center gap-1 border-b border-accent/20 pb-2 flex-shrink-0"
      >
        {/* Terminal Tabs */}
        {sessions.map((session) => (
          <button
            key={session.id}
            role="tab"
            aria-selected={session.id === activeSessionId}
            aria-controls={`terminal-panel-${session.id}`}
            onClick={() => setActiveSessionId(session.id)}
            className={`
              relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg smooth-transition text-sm font-medium
              ${
                session.id === activeSessionId
                  ? "bg-gradient-primary text-primary glow-effect"
                  : "text-secondary hover:text-primary hover:bg-black-secondary/50"
              }
            `}
          >
            <CommandLineIcon className="w-3.5 h-3.5" />
            <span>{session.name}</span>

            {/* Executing indicator */}
            {session.isExecuting && (
              <span
                className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"
                aria-label="Command executing"
              />
            )}

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeSession(session.id);
              }}
              className="ml-1 p-0.5 rounded hover:bg-red-900/20 smooth-transition"
              aria-label={`Close ${session.name}`}
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </button>
        ))}

        {/* New Terminal Button */}
        <button
          onClick={createNewSession}
          disabled={sessions.length >= MAX_TERMINALS}
          className="p-1.5 glass-button glow-border smooth-transition rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="New terminal"
          title={
            sessions.length >= MAX_TERMINALS
              ? `Maximum ${MAX_TERMINALS} terminals reached`
              : "New terminal (Ctrl+Shift+T)"
          }
        >
          <PlusIcon className="w-4 h-4 text-accent" />
        </button>
      </div>

      {/* Terminal Controls */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-secondary text-sm">
          <span>{getTerminalTitle()}</span>
          {activeSession.systemInfo?.isWSL && (
            <span className="text-orange-400 text-xs bg-orange-500/20 px-2 py-1 rounded">
              WSL
            </span>
          )}
          {activeSession.isExecuting && (
            <span className="text-yellow-400 animate-pulse">
              (executing...)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeSession.isExecuting && (
            <button
              onClick={cancelCommand}
              className="p-2 glass-button glow-border smooth-transition rounded-lg bg-red-500/20 hover:bg-red-500/30"
              aria-label="Cancel command"
            >
              <XMarkIcon className="w-4 h-4 text-red-400" />
            </button>
          )}
          <button
            onClick={clearTerminal}
            className="p-2 glass-button glow-border smooth-transition rounded-lg"
            aria-label="Clear terminal"
          >
            <TrashIcon className="w-4 h-4 text-accent" />
          </button>
        </div>
      </div>

      {/* Terminal Display */}
      <div
        ref={terminalRef}
        onClick={handleTerminalClick}
        id={`terminal-panel-${activeSession.id}`}
        role="tabpanel"
        aria-labelledby={`terminal-tab-${activeSession.id}`}
        className="flex-1 glass-card rounded-lg p-4 font-mono text-sm cursor-text overflow-y-auto min-h-0"
      >
        {/* Terminal Content */}
        <div className="space-y-2">
          {activeSession.entries.map((entry) => (
            <div key={entry.id} className="flex flex-col">
              {entry.type === "command" && (
                <div className="flex items-start gap-2">
                  <span className="text-accent font-medium flex-shrink-0">
                    {getPrompt()}
                  </span>
                  <span className="text-primary">{entry.content}</span>
                  <button
                    onClick={() => copyEntry(entry.content)}
                    className="ml-auto opacity-0 group-hover:opacity-100 hover:text-accent smooth-transition p-1"
                    aria-label="Copy command"
                  >
                    <DocumentDuplicateIcon className="w-3 h-3" />
                  </button>
                </div>
              )}

              {entry.type === "output" && (
                <div className="group flex items-start gap-2">
                  <span className="text-secondary whitespace-pre-wrap">
                    {entry.content}
                  </span>
                  <button
                    onClick={() => copyEntry(entry.content)}
                    className="ml-auto opacity-0 group-hover:opacity-100 hover:text-accent smooth-transition p-1"
                    aria-label="Copy output"
                  >
                    <DocumentDuplicateIcon className="w-3 h-3" />
                  </button>
                </div>
              )}

              {entry.type === "error" && (
                <div className="group flex items-start gap-2">
                  <span className="text-red-400 whitespace-pre-wrap">
                    {entry.content}
                  </span>
                  <button
                    onClick={() => copyEntry(entry.content)}
                    className="ml-auto opacity-0 group-hover:opacity-100 hover:text-accent smooth-transition p-1"
                    aria-label="Copy error"
                  >
                    <DocumentDuplicateIcon className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Current command input */}
          <form
            onSubmit={handleCommandSubmit}
            className="flex items-center gap-2"
          >
            <span className="text-accent font-medium flex-shrink-0">
              {getPrompt()}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={activeSession.currentCommand}
              onChange={(e) =>
                updateActiveSession({ currentCommand: e.target.value })
              }
              onKeyDown={handleKeyDown}
              disabled={activeSession.isExecuting}
              className={`flex-1 bg-transparent text-primary outline-none ${
                activeSession.isExecuting ? "opacity-50 cursor-not-allowed" : ""
              }`}
              placeholder={
                activeSession.isExecuting ? "Command executing..." : ""
              }
              autoComplete="off"
            />
          </form>
        </div>
      </div>
    </div>
  );
}
