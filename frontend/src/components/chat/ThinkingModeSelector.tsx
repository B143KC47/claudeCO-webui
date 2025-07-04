import React from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { ThinkingMode } from "../../types";
import { THINKING_MODE_LABELS, THINKING_MODE_CONFIGS } from "../../types";

interface ThinkingModeSelectorProps {
  value: ThinkingMode;
  onChange: (mode: ThinkingMode) => void;
  disabled?: boolean;
}

export function ThinkingModeSelector({
  value,
  onChange,
  disabled = false,
}: ThinkingModeSelectorProps) {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value as ThinkingMode);
  };

  const getCompactTokenDisplay = (mode: ThinkingMode) => {
    const config = THINKING_MODE_CONFIGS[mode];
    if (config.budgetTokens === 0) return "";

    // Use compact notation: 4K, 10K, 32K
    const tokens = config.budgetTokens;
    if (tokens >= 1000) {
      return ` (${Math.round(tokens / 1000)}K)`;
    }
    return ` (${tokens})`;
  };

  const getStatusText = (mode: ThinkingMode) => {
    const config = THINKING_MODE_CONFIGS[mode];
    if (config.budgetTokens === 0) {
      return "Standard response";
    }
    return `Enhanced thinking • ${config.budgetTokens.toLocaleString()} tokens`;
  };

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="thinking-mode"
        className="text-xs text-secondary whitespace-nowrap hidden sm:block"
      >
        Mode:
      </label>
      <div className="relative flex-1 min-w-0">
        <select
          id="thinking-mode"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={`
            appearance-none w-full px-2 py-1.5 pr-6 text-xs sm:text-sm
            glass-button glow-border smooth-transition rounded-md
            text-primary bg-black-secondary/50 border-accent/30
            focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent
            disabled:opacity-50 disabled:cursor-not-allowed
            hover:bg-black-secondary/70 hover:border-accent/50
            mobile-button mobile-text-xs
            max-w-[120px] sm:max-w-[140px] md:max-w-none
          `}
          title={getStatusText(value)}
        >
          {(Object.keys(THINKING_MODE_CONFIGS) as ThinkingMode[]).map(
            (mode) => (
              <option
                key={mode}
                value={mode}
                className="bg-black-secondary text-primary"
              >
                {THINKING_MODE_LABELS[mode]}
                {getCompactTokenDisplay(mode)}
              </option>
            ),
          )}
        </select>
        <ChevronDownIcon
          className={`
            absolute right-1.5 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4
            text-accent pointer-events-none smooth-transition
            ${disabled ? "opacity-50" : ""}
          `}
        />
      </div>

      {/* Status indicator - only show on larger screens */}
      <div className="hidden lg:block flex-shrink-0">
        <span className="text-xs text-tertiary">
          {value === "auto" ? (
            <span className="text-accent/70">●</span>
          ) : (
            <span className="text-accent animate-pulse-glow">●</span>
          )}
        </span>
      </div>
    </div>
  );
}
