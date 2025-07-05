import { useState, useRef, useEffect } from "react";
import {
  CommandLineIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface TerminalEntry {
  id: number;
  type: "command" | "output" | "error";
  content: string;
  timestamp: Date;
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

interface SystemInfo {
  username: string;
  hostname: string;
  platform: string;
  homeDirectory: string;
  currentWorkingDirectory: string;
  isWSL: boolean;
}

export function TerminalPanel({ workingDirectory = "~" }: TerminalPanelProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [currentCommand, setCurrentCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [currentWorkingDirectory, setCurrentWorkingDirectory] =
    useState(workingDirectory);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [entries]);

  // Focus terminal input when clicked
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  // Load system info on component mount
  useEffect(() => {
    const loadSystemInfo = async () => {
      try {
        const response = await fetch("/api/terminal/info");
        if (response.ok) {
          const info = await response.json();
          setSystemInfo(info);

          // Only use system info directory if user hasn't selected a specific project directory
          // workingDirectory prop takes priority over system currentWorkingDirectory
          const effectiveWorkingDirectory =
            workingDirectory && workingDirectory !== "~"
              ? workingDirectory
              : info.currentWorkingDirectory || workingDirectory;

          // Update working directory only if we don't have a user-specified one
          if (!workingDirectory || workingDirectory === "~") {
            setCurrentWorkingDirectory(effectiveWorkingDirectory);
          }

          // Add welcome message after system info is loaded
          const welcomeEntry: TerminalEntry = {
            id: Date.now(),
            type: "output",
            content: `Welcome to ${info.platform === "linux" && info.isWSL ? "WSL" : info.platform} Terminal\nUser: ${info.username}@${info.hostname}\nWorking Directory: ${currentWorkingDirectory}\n`,
            timestamp: new Date(),
          };
          setEntries([welcomeEntry]);
        }
      } catch (error) {
        console.error("Failed to load system info:", error);
        // Add fallback welcome message
        const fallbackEntry: TerminalEntry = {
          id: Date.now(),
          type: "output",
          content: `Welcome to Terminal\nWorking Directory: ${workingDirectory}\n`,
          timestamp: new Date(),
        };
        setEntries([fallbackEntry]);
      }
    };

    loadSystemInfo();
  }, [workingDirectory]);

  // Update working directory when prop changes
  useEffect(() => {
    // Always update when workingDirectory prop changes - this ensures user selection takes priority
    if (workingDirectory) {
      setCurrentWorkingDirectory(workingDirectory);
    }
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
      if (newDir !== currentWorkingDirectory) {
        setCurrentWorkingDirectory(newDir);
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
    if (!systemInfo) {
      return `Terminal - ${currentWorkingDirectory}`;
    }

    const platform = systemInfo.platform;
    const wsuffix = systemInfo.isWSL ? " (WSL)" : "";

    if (platform === "windows") {
      return `Windows Terminal${wsuffix} - ${currentWorkingDirectory}`;
    } else if (platform === "darwin") {
      return `macOS Terminal - ${currentWorkingDirectory}`;
    } else if (platform === "linux") {
      return `Linux Terminal${wsuffix} - ${currentWorkingDirectory}`;
    } else {
      return `Terminal - ${currentWorkingDirectory}`;
    }
  };

  // Generate prompt based on system info
  const getPrompt = () => {
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
    setCurrentRequestId(requestId);
    setIsExecuting(true);

    // Store the command for directory tracking
    const originalCommand = command.trim();

    try {
      const terminalRequest: TerminalRequest = {
        command: originalCommand,
        workingDirectory: currentWorkingDirectory,
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

      setEntries((prev) => [...prev, errorEntry]);
    } finally {
      setIsExecuting(false);
      setCurrentRequestId(null);
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
          setEntries((prev) => [...prev, outputEntry]);
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
          setEntries((prev) => [...prev, errorEntry]);
        }
        break;

      case "error":
        const errorEntry: TerminalEntry = {
          id: Date.now() + Math.random(),
          type: "error",
          content: `Error: ${response.error || "Unknown error"}`,
          timestamp: new Date(),
        };
        setEntries((prev) => [...prev, errorEntry]);
        break;

      case "exit":
        // Command completed - could show exit code if non-zero
        if (response.exitCode && response.exitCode !== 0) {
          const exitEntry: TerminalEntry = {
            id: Date.now() + Math.random(),
            type: "error",
            content: `Process exited with code ${response.exitCode}`,
            timestamp: new Date(),
          };
          setEntries((prev) => [...prev, exitEntry]);
        }
        break;
    }
  };

  // Cancel current command execution
  const cancelCommand = async () => {
    if (currentRequestId) {
      try {
        await fetch(`/api/terminal/abort/${currentRequestId}`, {
          method: "POST",
        });
      } catch (error) {
        console.error("Error cancelling command:", error);
      }
    }
    setIsExecuting(false);
    setCurrentRequestId(null);
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentCommand.trim() || isExecuting) return;

    // Handle clear command locally for immediate response
    if (currentCommand.trim().toLowerCase() === "clear") {
      setEntries([]);
      setCurrentCommand("");
      setCommandHistory((prev) => [...prev, currentCommand]);
      setHistoryIndex(-1);
      return;
    }

    // Add command to entries
    const commandEntry: TerminalEntry = {
      id: Date.now(),
      type: "command",
      content: currentCommand,
      timestamp: new Date(),
    };

    setEntries((prev) => [...prev, commandEntry]);

    // Update command history
    setCommandHistory((prev) => [...prev, currentCommand]);
    const cmd = currentCommand;
    setCurrentCommand("");
    setHistoryIndex(-1);

    // Execute command
    await executeCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex + 1;
        if (newIndex < commandHistory.length) {
          setHistoryIndex(newIndex);
          setCurrentCommand(
            commandHistory[commandHistory.length - 1 - newIndex],
          );
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentCommand("");
      }
    }
  };

  const clearTerminal = () => {
    setEntries([]);
  };

  const copyEntry = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {
      // Fallback for clipboard API
      console.log("Could not copy to clipboard");
    });
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Terminal Controls */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-secondary text-sm">
          <CommandLineIcon className="w-4 h-4 text-accent" />
          <span>{getTerminalTitle()}</span>
          {systemInfo?.isWSL && (
            <span className="text-orange-400 text-xs bg-orange-500/20 px-2 py-1 rounded">
              WSL
            </span>
          )}
          {isExecuting && (
            <span className="text-yellow-400 animate-pulse">
              (executing...)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isExecuting && (
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
        className="flex-1 glass-card rounded-lg p-4 font-mono text-sm cursor-text overflow-y-auto min-h-0"
      >
        {/* Terminal Content */}
        <div className="space-y-2">
          {entries.map((entry) => (
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
              value={currentCommand}
              onChange={(e) => setCurrentCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isExecuting}
              className={`flex-1 bg-transparent text-primary outline-none ${
                isExecuting ? "opacity-50 cursor-not-allowed" : ""
              }`}
              placeholder={isExecuting ? "Command executing..." : ""}
              autoComplete="off"
            />
          </form>
        </div>
      </div>
    </div>
  );
}
