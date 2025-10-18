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
    <div className="flex-shrink-0 pb-safe">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative ios-glass-input rounded-3xl shadow-lg hover:shadow-xl smooth-transition ring-2 ring-transparent focus-within:ring-accent focus-within:ring-opacity-50">
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
            className={`
              w-full px-6 py-4 pr-36
              bg-transparent
              text-primary text-[15px]
              placeholder-text-tertiary
              resize-none overflow-hidden
              min-h-[60px] max-h-[${UI_CONSTANTS.TEXTAREA_MAX_HEIGHT}px]
              smooth-transition
              border-0 focus:outline-none
              rounded-3xl
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
