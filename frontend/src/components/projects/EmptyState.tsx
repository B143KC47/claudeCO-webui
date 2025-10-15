import { FolderPlusIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useLanguage } from "../../contexts/LanguageContext";

interface EmptyStateProps {
  onAddProject: () => void;
  searchQuery?: string;
  showFavoritesOnly?: boolean;
}

export function EmptyState({
  onAddProject,
  searchQuery,
  showFavoritesOnly,
}: EmptyStateProps) {
  const { t } = useLanguage();

  // Different messages based on context
  const getEmptyStateContent = () => {
    if (showFavoritesOnly) {
      return {
        icon: <SparklesIcon className="h-24 w-24 text-accent opacity-50" />,
        title: "No Favorite Projects",
        description:
          "Star your frequently used projects to quickly access them here.",
        showButton: false,
      };
    }

    if (searchQuery) {
      return {
        icon: <div className="text-6xl opacity-50">🔍</div>,
        title: "No Projects Found",
        description: `No projects match "${searchQuery}". Try a different search term.`,
        showButton: false,
      };
    }

    return {
      icon: <FolderPlusIcon className="h-24 w-24 text-accent opacity-50" />,
      title: "Welcome to Claude Code",
      description:
        "Get started by adding your first project. You can select any directory on your system to begin.",
      showButton: true,
    };
  };

  const { icon, title, description, showButton } = getEmptyStateContent();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Icon/Illustration */}
      <div className="mb-6 animate-pulse-glow">{icon}</div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-primary mb-3 text-gradient">
        {title}
      </h2>

      {/* Description */}
      <p className="text-secondary max-w-md mb-8 leading-relaxed">
        {description}
      </p>

      {/* CTA Button */}
      {showButton && (
        <button
          onClick={onAddProject}
          className="flex items-center gap-3 px-6 py-3 bg-gradient-primary glow-effect hover:glow-border smooth-transition rounded-lg text-primary font-medium shadow-lg hover:shadow-xl"
        >
          <FolderPlusIcon className="h-5 w-5" />
          <span>{t("project.custom")}</span>
        </button>
      )}

      {/* Tips for first-time users */}
      {!searchQuery && !showFavoritesOnly && (
        <div className="mt-12 glass-card p-6 max-w-2xl rounded-2xl border border-accent/20">
          <h3 className="text-primary font-semibold mb-4 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-accent" />
            Quick Tips
          </h3>
          <div className="space-y-3 text-left">
            <div className="flex gap-3">
              <span className="text-accent font-bold">1.</span>
              <p className="text-secondary text-sm">
                Projects are automatically saved to your Claude configuration
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-accent font-bold">2.</span>
              <p className="text-secondary text-sm">
                Use the star icon to favorite important projects for quick
                access
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-accent font-bold">3.</span>
              <p className="text-secondary text-sm">
                Recently opened projects appear at the top for easy navigation
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
