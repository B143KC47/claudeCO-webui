import React, { useRef, useEffect, useState } from "react";
import { StopIcon } from "@heroicons/react/24/solid";
import { UI_CONSTANTS, KEYBOARD_SHORTCUTS } from "../../utils/constants";
import { useLanguage } from "../../contexts/LanguageContext";

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
  const { t } = useLanguage();

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
    if (e.key === KEYBOARD_SHORTCUTS.SUBMIT && !e.shiftKey && !isComposing) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    // Add small delay to handle race condition between composition and keydown events
    setTimeout(() => setIsComposing(false), 0);
  };

  return (
    <div className="flex-shrink-0">
      <form onSubmit={handleSubmit} className="relative">
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
              : t("chat.placeholder")
          }
          rows={1}
          className={`w-full px-4 py-3 pr-32 glass-input text-primary placeholder-text-tertiary resize-none overflow-hidden min-h-[48px] max-h-[${UI_CONSTANTS.TEXTAREA_MAX_HEIGHT}px] smooth-transition rounded-2xl`}
          disabled={isLoading}
        />
        <div className="absolute right-3 bottom-3 flex gap-2">
          {isLoading && currentRequestId && (
            <button
              type="button"
              onClick={onAbort}
              className="p-2 glass-button text-accent glow-border smooth-transition rounded-xl"
              title="Stop (ESC)"
            >
              <StopIcon className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-gradient-primary text-primary rounded-xl font-medium smooth-transition glow-effect disabled:cursor-not-allowed disabled:opacity-50 text-sm"
          >
            {isLoading ? "..." : t("chat.send")}
          </button>
        </div>
      </form>
    </div>
  );
}
