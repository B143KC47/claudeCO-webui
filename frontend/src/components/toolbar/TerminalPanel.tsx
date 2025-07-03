import { useState, useRef, useEffect } from "react";
import { 
  CommandLineIcon, 
  TrashIcon,
  DocumentDuplicateIcon 
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

export function TerminalPanel({ workingDirectory = "~" }: TerminalPanelProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([
    {
      id: 1,
      type: "output",
      content: `Welcome to Claude Terminal Simulator\nCurrent directory: ${workingDirectory}`,
      timestamp: new Date(),
    },
  ]);
  const [currentCommand, setCurrentCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [entries]);

  // Focus input when terminal is clicked
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  // Simulate command execution
  const executeCommand = (command: string): string => {
    const cmd = command.trim().toLowerCase();
    
    // Simulate different commands
    switch (true) {
      case cmd === "help":
        return `Available commands:
  help          - Show this help message
  clear         - Clear terminal
  pwd           - Print working directory
  ls            - List directory contents
  date          - Show current date
  whoami        - Show current user
  echo <text>   - Echo text
  node --version - Show Node.js version
  npm --version  - Show npm version`;
      
      case cmd === "clear":
        return "CLEAR_TERMINAL";
      
      case cmd === "pwd":
        return workingDirectory || "~";
      
      case cmd === "ls":
        return `src/
components/
package.json
README.md
node_modules/
.git/`;
      
      case cmd === "date":
        return new Date().toString();
      
      case cmd === "whoami":
        return "claude-user";
      
      case cmd.startsWith("echo "):
        return cmd.substring(5);
      
      case cmd === "node --version":
        return "v18.17.0";
      
      case cmd === "npm --version":
        return "9.6.7";
      
      case cmd === "":
        return "";
      
      default:
        return `Command not found: ${command}\nType 'help' for available commands.`;
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentCommand.trim()) return;
    
    // Add command to entries
    const commandEntry: TerminalEntry = {
      id: Date.now(),
      type: "command",
      content: currentCommand,
      timestamp: new Date(),
    };
    
    // Execute command and get output
    const output = executeCommand(currentCommand);
    
    if (output === "CLEAR_TERMINAL") {
      // Special case for clear command
      setEntries([]);
    } else {
      const outputEntry: TerminalEntry = {
        id: Date.now() + 1,
        type: output.includes("not found") || output.includes("error") ? "error" : "output",
        content: output,
        timestamp: new Date(),
      };
      
      setEntries(prev => [...prev, commandEntry, outputEntry]);
    }
    
    // Update command history
    setCommandHistory(prev => [...prev, currentCommand]);
    setCurrentCommand("");
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex + 1;
        if (newIndex < commandHistory.length) {
          setHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
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
    <div className="space-y-4">
      {/* Terminal Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-secondary text-sm">
          <CommandLineIcon className="w-4 h-4 text-accent" />
          <span>Terminal - {workingDirectory}</span>
        </div>
        
        <div className="flex items-center gap-2">
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
        className="glass-card rounded-lg p-4 font-mono text-sm cursor-text"
        style={{ height: "400px", overflowY: "auto" }}
      >
        {entries.map((entry) => (
          <div key={entry.id} className="mb-2 group">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {entry.type === "command" && (
                  <div className="flex items-center gap-2 text-accent">
                    <span className="text-green-400">$</span>
                    <span className="text-primary">{entry.content}</span>
                  </div>
                )}
                
                {entry.type === "output" && (
                  <div className="text-secondary whitespace-pre-wrap ml-4">
                    {entry.content}
                  </div>
                )}
                
                {entry.type === "error" && (
                  <div className="text-red-400 whitespace-pre-wrap ml-4">
                    {entry.content}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 smooth-transition">
                <span className="text-xs text-tertiary">
                  {formatTimestamp(entry.timestamp)}
                </span>
                <button
                  onClick={() => copyEntry(entry.content)}
                  className="p-1 hover:bg-black-secondary/50 rounded"
                  aria-label="Copy"
                >
                  <DocumentDuplicateIcon className="w-3 h-3 text-tertiary" />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {/* Command Input */}
        <form onSubmit={handleCommandSubmit} className="flex items-center gap-2">
          <span className="text-green-400">$</span>
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-primary outline-none font-mono"
            placeholder="Type a command..."
            autoFocus
          />
        </form>
      </div>
      
      {/* Status Bar */}
      <div className="text-xs text-tertiary flex items-center justify-between">
        <span>Commands: {commandHistory.length}</span>
        <span>Use ↑/↓ arrows to navigate history</span>
      </div>
    </div>
  );
} 