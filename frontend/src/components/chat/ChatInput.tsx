import React, { useRef, useEffect, useState } from "react";
import { StopIcon, CommandLineIcon } from "@heroicons/react/24/solid";
import { UI_CONSTANTS, KEYBOARD_SHORTCUTS } from "../../utils/constants";
import { useLanguage } from "../../contexts/LanguageContext";

// Available Claude Code slash commands
const SLASH_COMMANDS = [
  { command: "/new", description: "Start a new conversation" },
  { command: "/clear", description: "Clear the current conversation" },
  { command: "/help", description: "Show help information" },
  { command: "/settings", description: "Open settings" },
  { command: "/history", description: "View conversation history" },
];

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  currentRequestId: string | null;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
}

export function ChatInput({
  input,
  isLoading,
  currentRequestId,
  onInputChange,
  onSubmit,
  onAbort,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const { t } = useLanguage();

  // Check if input starts with "/" for command mode
  const isCommandMode = input.trim().startsWith("/");

  // Filter commands based on input
  const filteredCommands = isCommandMode
    ? SLASH_COMMANDS.filter((cmd) =>
        cmd.command.toLowerCase().includes(input.trim().toLowerCase())
      )
    : [];

  // Show command menu when in command mode and there are matching commands
  useEffect(() => {
    setShowCommandMenu(isCommandMode && filteredCommands.length > 0);
    setSelectedCommandIndex(0);
  }, [isCommandMode, filteredCommands.length]);

  // Focus input when not loading
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const computedStyle = getComputedStyle(textarea);
      const maxHeight =
        parseInt(computedStyle.maxHeight, 10) ||
        UI_CONSTANTS.TEXTAREA_MAX_HEIGHT;
      const scrollHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle command menu navigation
    if (showCommandMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev > 0 ? prev - 1 : prev));
        return;
      } else if (e.key === "Tab") {
        e.preventDefault();
        const selectedCommand = filteredCommands[selectedCommandIndex];
        if (selectedCommand) {
          onInputChange(selectedCommand.command);
          setShowCommandMenu(false);
        }
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowCommandMenu(false);
        return;
      }
    }

    // Handle submit
    if (e.key === KEYBOARD_SHORTCUTS.SUBMIT && !e.shiftKey && !isComposing) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleCommandSelect = (command: string) => {
    onInputChange(command);
    setShowCommandMenu(false);
    inputRef.current?.focus();
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    // Add small delay to handle race condition between composition and keydown events
    setTimeout(() => setIsComposing(false), 0);
  };

  return (
    <div className="flex-shrink-0 pb-safe">
      <form onSubmit={handleSubmit} className="relative">
        {/* Command Menu Dropdown */}
        {showCommandMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-2 glass-card rounded-2xl shadow-2xl overflow-hidden border border-accent/20 z-50 animate-fade-in">
            <div className="p-2 border-b border-accent/10 bg-black-secondary/50">
              <div className="flex items-center gap-2 px-2 text-xs text-accent">
                <CommandLineIcon className="w-4 h-4" />
                <span className="font-semibold">Commands</span>
                <span className="text-tertiary ml-auto">
                  ↑↓ Navigate • Tab/Enter Select • Esc Close
                </span>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.command}
                  type="button"
                  onClick={() => handleCommandSelect(cmd.command)}
                  className={`
                    w-full px-4 py-3 text-left smooth-transition
                    flex items-center gap-3
                    ${
                      index === selectedCommandIndex
                        ? "bg-accent/20 text-primary"
                        : "text-secondary hover:bg-accent/10 hover:text-primary"
                    }
                  `}
                >
                  <CommandLineIcon className="w-4 h-4 text-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-semibold text-sm">
                      {cmd.command}
                    </div>
                    <div className="text-xs text-tertiary mt-0.5">
                      {cmd.description}
                    </div>
                  </div>
                  {index === selectedCommandIndex && (
                    <span className="text-xs text-accent">Selected</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Field */}
        <div
          className={`
            relative ios-glass-input rounded-3xl shadow-lg hover:shadow-xl smooth-transition
            ring-2 ring-transparent focus-within:ring-accent focus-within:ring-opacity-50
            ${isCommandMode ? "ring-accent/30 bg-accent/5" : ""}
          `}
        >
          {/* Command Mode Indicator */}
          {isCommandMode && (
            <div className="absolute left-4 top-4 flex items-center gap-2 pointer-events-none">
              <CommandLineIcon className="w-5 h-5 text-accent animate-pulse-glow" />
              <span className="text-xs font-semibold text-accent">
                Command Mode
              </span>
            </div>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={
              isLoading && currentRequestId
                ? `${t("chat.thinking")} (ESC)`
                : isCommandMode
                ? "Type a command... (Try /help)"
                : t("chat.placeholder")
            }
            rows={1}
            className={`
              w-full px-6 py-4 ${isCommandMode ? "pt-12" : ""} pr-36
              bg-transparent
              text-primary text-[15px]
              placeholder-text-tertiary
              resize-none overflow-hidden
              min-h-[60px] max-h-[${UI_CONSTANTS.TEXTAREA_MAX_HEIGHT}px]
              smooth-transition
              border-0 focus:outline-none
              rounded-3xl
              ${isCommandMode ? "font-mono" : ""}
            `}
            disabled={isLoading}
            aria-label="Message input"
          />
          <div className="absolute right-3 bottom-3 flex gap-2 items-center">
            {isLoading && currentRequestId && (
              <button
                type="button"
                onClick={onAbort}
                className="p-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 smooth-transition rounded-2xl shadow-sm hover:shadow-md backdrop-blur-sm ios-button-press"
                title="Stop (ESC)"
                aria-label="Stop generating"
              >
                <StopIcon className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="
                px-5 py-2.5
                bg-gradient-primary
                text-white
                rounded-2xl
                font-semibold
                smooth-transition
                glow-effect
                ios-button-press
                disabled:cursor-not-allowed
                disabled:opacity-50
                disabled:transform-none
                hover:scale-105
                text-[14px]
                shadow-md
                hover:shadow-lg
              "
              aria-label="Send message"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-pulse">●</span>
                  <span className="animate-pulse animation-delay-200">●</span>
                  <span className="animate-pulse animation-delay-400">●</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t("chat.send")}
                  <span>→</span>
                </span>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
