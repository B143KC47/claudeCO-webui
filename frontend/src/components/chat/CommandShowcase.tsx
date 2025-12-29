import type { CommandSuggestion } from "../../types";

interface CommandShowcaseProps {
  suggestions: CommandSuggestion[];
  onCommandClick: (command: string) => void;
}

/**
 * Command Showcase Component
 * Displays context-aware command suggestions to help users get started
 * and discover Claude's capabilities.
 */
export function CommandShowcase({
  suggestions,
  onCommandClick,
}: CommandShowcaseProps) {
  // Group suggestions by category
  const groupedSuggestions = suggestions.reduce(
    (acc, suggestion) => {
      if (!acc[suggestion.category]) {
        acc[suggestion.category] = [];
      }
      acc[suggestion.category].push(suggestion);
      return acc;
    },
    {} as Record<string, CommandSuggestion[]>,
  );

  // Category display config
  const categoryConfig = {
    general: { label: "General", color: "text-blue-400" },
    git: { label: "Git Operations", color: "text-green-400" },
    file: { label: "File & Project", color: "text-purple-400" },
    terminal: { label: "Terminal", color: "text-yellow-400" },
    mcp: { label: "Tools & MCP", color: "text-pink-400" },
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-gradient mb-3">
          ✨ Quick Actions
        </h2>
        <p className="text-secondary text-sm md:text-base">
          Click any suggestion below to get started, or type your own question
        </p>
      </div>

      {/* Command Grid */}
      <div className="space-y-6">
        {Object.entries(groupedSuggestions).map(([category, items]) => {
          const config =
            categoryConfig[category as keyof typeof categoryConfig];
          if (!config || items.length === 0) return null;

          return (
            <div key={category} className="space-y-3">
              {/* Category Header */}
              <h3
                className={`text-sm font-semibold uppercase tracking-wider ${config.color}`}
              >
                {config.label}
              </h3>

              {/* Commands in this category */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((suggestion, idx) => (
                  <button
                    key={`${category}-${idx}`}
                    onClick={() => onCommandClick(suggestion.command)}
                    className="
                      glass-card p-4 rounded-xl text-left smooth-transition
                      hover:scale-105 hover:glow-border
                      focus:outline-none focus:ring-2 focus:ring-accent/50
                      active:scale-95
                      group
                    "
                  >
                    {/* Icon and Label */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl" role="img" aria-hidden="true">
                        {suggestion.icon}
                      </span>
                      <span className="text-primary font-semibold text-sm group-hover:text-accent smooth-transition">
                        {suggestion.label}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-tertiary text-xs leading-relaxed">
                      {suggestion.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer tip */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-xs text-secondary">
          <span className="text-accent">💡 Tip:</span>
          <span>
            Commands update automatically based on your project's git status
          </span>
        </div>
      </div>
    </div>
  );
}
