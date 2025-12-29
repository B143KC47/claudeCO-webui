import React, { useRef, useEffect, useState } from "react";
import { StopIcon, CommandLineIcon } from "@heroicons/react/24/solid";
import { UI_CONSTANTS, KEYBOARD_SHORTCUTS } from "../../utils/constants";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCommandDiscovery } from "../../hooks/useCommandDiscovery";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  currentRequestId: string | null;
  workingDirectory?: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
}

export function ChatInput({
  input,
  isLoading,
  currentRequestId,
  workingDirectory,
  onInputChange,
  onSubmit,
  onAbort,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const { t } = useLanguage();

  // Discover commands automatically
  const { commands, searchCommands } = useCommandDiscovery({
    workingDirectory,
    autoRefresh: true,
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  // Check if input starts with "/" for command mode
  const isCommandMode = input.trim().startsWith("/");

  // Filter commands based on input using the search function
  const filteredCommands = isCommandMode
    ? searchCommands(input.trim())
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
      } else if (e.key === "Tab" || e.key === "Enter") {
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
          <div className="absolute bottom-full left-0 right-0 mb-3 glass-card rounded-3xl shadow-2xl overflow-hidden border border-accent/25 z-50 animate-scale-in backdrop-blur-2xl">
            <div className="p-3 border-b border-accent/15 bg-gradient-to-r from-accent/10 to-transparent">
              <div className="flex items-center gap-3 px-3 text-xs text-accent">
                <CommandLineIcon className="w-5 h-5" />
                <span className="font-bold text-sm">Commands</span>
                <span className="text-tertiary ml-auto text-[11px]">
                  ↑↓ Navigate • Tab/Enter Select • Esc Close
                </span>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredCommands.map((cmd, index) => (
                <button
                  key={`${cmd.category}-${cmd.command}`}
                  type="button"
                  onClick={() => handleCommandSelect(cmd.command)}
                  className={`
                    w-full px-5 py-3.5 text-left smooth-transition
                    flex items-center gap-3
                    ${
                      index === selectedCommandIndex
                        ? "bg-gradient-to-r from-accent/25 to-accent/10 text-primary border-l-2 border-accent"
                        : "text-secondary hover:bg-accent/10 hover:text-primary border-l-2 border-transparent"
                    }
                  `}
                >
                  <CommandLineIcon className="w-5 h-5 text-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">
                        {cmd.command}
                      </span>
                      {cmd.argumentHint && (
                        <span className="text-xs text-accent/70 font-mono">
                          {cmd.argumentHint}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-tertiary mt-1">
                      {cmd.description}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                          cmd.category === "builtin"
                            ? "bg-blue-500/20 text-blue-400"
                            : cmd.category === "project"
                            ? "bg-green-500/20 text-green-400"
                            : cmd.category === "personal"
                            ? "bg-purple-500/20 text-purple-400"
                            : cmd.category === "mcp"
                            ? "bg-orange-500/20 text-orange-400"
                            : "bg-pink-500/20 text-pink-400"
                        }`}
                      >
                        {cmd.category}
                      </span>
                      {cmd.source && (
                        <span className="text-[10px] text-tertiary">
                          {cmd.source}
                        </span>
                      )}
                    </div>
                  </div>
                  {index === selectedCommandIndex && (
                    <span className="text-xs text-accent font-semibold">Selected</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Field */}
        <div
          className={`
            relative ios-glass-input rounded-3xl shadow-xl hover:shadow-2xl smooth-transition
            ring-2 ring-transparent focus-within:ring-accent/40 focus-within:shadow-2xl
            ${isCommandMode ? "ring-accent/40 bg-gradient-to-r from-accent/8 to-accent/5 animate-glow-pulse-subtle" : ""}
          `}
        >
          {/* Command Mode Indicator */}
          {isCommandMode && (
            <div className="absolute left-5 top-5 flex items-center gap-2.5 pointer-events-none z-10">
              <CommandLineIcon className="w-5 h-5 text-accent animate-pulse-glow" />
              <span className="text-xs font-bold text-accent tracking-wider uppercase">
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
              w-full px-7 py-5 ${isCommandMode ? "pt-14" : ""} pr-40
              bg-transparent
              text-primary text-[15px] font-medium
              placeholder-text-tertiary placeholder:font-normal
              resize-none overflow-hidden
              min-h-[68px] max-h-[${UI_CONSTANTS.TEXTAREA_MAX_HEIGHT}px]
              smooth-transition
              border-0 focus:outline-none
              rounded-3xl
              ${isCommandMode ? "font-mono" : ""}
            `}
            disabled={isLoading}
            aria-label="Message input"
          />
          <div className="absolute right-4 bottom-4 flex gap-2.5 items-center">
            {isLoading && currentRequestId && (
              <button
                type="button"
                onClick={onAbort}
                className="p-3 bg-gradient-to-r from-red-500/25 to-red-600/25 hover:from-red-500/35 hover:to-red-600/35 text-red-400 border border-red-500/40 smooth-transition rounded-2xl shadow-lg hover:shadow-xl backdrop-blur-sm modern-button"
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
                px-6 py-3
                bg-gradient-primary
                text-white
                rounded-2xl
                font-bold
                smooth-transition
                glow-effect
                modern-button
                disabled:cursor-not-allowed
                disabled:opacity-50
                disabled:transform-none
                hover:scale-105
                text-[14px]
                shadow-lg
                hover:shadow-2xl
                tracking-wide
              "
              aria-label="Send message"
            >
              {isLoading ? (
                <span className="flex items-center gap-2.5">
                  <span className="animate-pulse">●</span>
                  <span className="animate-pulse animation-delay-200">●</span>
                  <span className="animate-pulse animation-delay-400">●</span>
                </span>
              ) : (
                <span className="flex items-center gap-2.5">
                  {t("chat.send")}
                  <span className="text-lg">→</span>
                </span>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
