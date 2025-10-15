import { useState } from "react";
import {
  FolderIcon,
  StarIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  CommandLineIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import type { ProjectMetadata } from "../../hooks/useProjectMetadata";

interface ProjectCardProps {
  path: string;
  name: string;
  truncatedPath: string;
  metadata: ProjectMetadata;
  isRecent?: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  getRelativeTime: (timestamp: number) => string;
  bentoSize?: "large" | "medium" | "normal"; // For Bento grid sizing
  isFocused?: boolean; // For keyboard navigation
}

export function ProjectCard({
  path,
  name,
  truncatedPath,
  metadata,
  isRecent,
  onSelect,
  onToggleFavorite,
  getRelativeTime,
  bentoSize = "normal",
  isFocused = false,
}: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showRipple, setShowRipple] = useState(false);
  const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });

  // Determine Bento grid class and blur level
  const bentoClass =
    bentoSize === "large"
      ? "bento-card-large"
      : bentoSize === "medium"
        ? "bento-card-medium"
        : "";

  const blurClass = isHovered
    ? "progressive-blur-heavy"
    : bentoSize === "large"
      ? "progressive-blur-medium"
      : "progressive-blur-light";

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't trigger if clicking the favorite star
    if ((e.target as HTMLElement).closest(".favorite-button")) {
      return;
    }

    // Create ripple effect
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setRipplePosition({ x, y });
    setShowRipple(true);

    // Remove ripple after animation
    setTimeout(() => setShowRipple(false), 600);

    // Navigate to project
    onSelect();
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite();
  };

  // Quick action handlers
  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    // You could add a toast notification here
  };

  const handleOpenTerminal = (e: React.MouseEvent) => {
    e.stopPropagation();
    // This would need to be implemented with actual terminal integration
    console.log("Open terminal in:", path);
  };

  const handleOpenFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(); // Just open the project for now
  };

  return (
    <div
      className={`relative group cursor-pointer overflow-hidden ${bentoClass}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Ripple Effect */}
      {showRipple && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: ripplePosition.x,
            top: ripplePosition.y,
          }}
        >
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
            style={{
              width: "20px",
              height: "20px",
              animation: "ripple-expand 0.6s ease-out",
            }}
          />
        </div>
      )}

      {/* Card */}
      <div
        className={`
          glass-card p-6 rounded-2xl border
          smooth-transition relative overflow-hidden ${blurClass}
          ${isFocused ? "border-accent ring-4 ring-accent/30" : "border-accent/20"}
          ${
            isHovered || isFocused
              ? "transform -translate-y-1 scale-[1.02] shadow-lg shadow-accent/30"
              : "shadow-md"
          }
        ${bentoSize === "large" ? "p-8" : bentoSize === "medium" ? "p-7" : "p-6"}
        `}
      >
        {/* Top Row: Favorite Star and Recent Badge */}
        <div className="flex items-start justify-between mb-4">
          {/* Favorite Star */}
          <button
            onClick={handleFavoriteClick}
            className="favorite-button p-2 -m-2 rounded-lg hover:bg-accent/10 smooth-transition group/star"
            aria-label={
              metadata.isFavorite ? "Remove from favorites" : "Add to favorites"
            }
          >
            {metadata.isFavorite ? (
              <StarIconSolid className="h-6 w-6 text-accent animate-favorite-bounce" />
            ) : (
              <StarIcon className="h-6 w-6 text-tertiary group-hover/star:text-accent smooth-transition" />
            )}
          </button>

          {/* Recent Badge */}
          {isRecent && (
            <span className="px-2 py-1 bg-accent/20 text-accent text-xs font-semibold rounded-full border border-accent/30">
              Recent
            </span>
          )}
        </div>

        {/* Folder Icon */}
        <div className="flex justify-center mb-4">
          <div
            className={`
              rounded-2xl bg-gradient-primary/10 border border-accent/30
              smooth-transition
              ${isHovered ? "scale-110 bg-gradient-primary/20" : ""}
              ${bentoSize === "large" ? "p-6" : bentoSize === "medium" ? "p-5" : "p-4"}
            `}
          >
            <FolderIcon
              className={`text-accent ${bentoSize === "large" ? "h-16 w-16" : bentoSize === "medium" ? "h-14 w-14" : "h-12 w-12"}`}
            />
          </div>
        </div>

        {/* Project Name */}
        <h3
          className={`text-primary font-bold mb-2 ${bentoSize === "large" ? "text-2xl" : bentoSize === "medium" ? "text-xl" : "text-lg"} ${bentoSize === "large" ? "line-clamp-2" : "truncate"}`}
          title={name}
        >
          {name}
        </h3>

        {/* Project Path */}
        <p
          className={`text-tertiary font-mono mb-4 ${bentoSize === "large" ? "text-base" : "text-sm"} ${bentoSize === "large" ? "line-clamp-2" : "truncate"}`}
          title={path}
        >
          {truncatedPath}
        </p>

        {/* Last Accessed */}
        {metadata.lastAccessed && (
          <div className="flex items-center gap-2 text-secondary text-xs">
            <ClockIcon className="h-4 w-4 text-accent" />
            <span>{getRelativeTime(metadata.lastAccessed)}</span>
          </div>
        )}

        {/* Quick Actions Bar - Appears on hover */}
        <div
          className={`
            absolute bottom-0 left-0 right-0
            flex items-center justify-center gap-2 p-3
            bg-gradient-primary/95 backdrop-blur-md
            border-t border-accent/30
            smooth-transition
            ${isHovered ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}
          `}
        >
          <button
            onClick={handleCopyPath}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg smooth-transition group/action"
            title="Copy Path"
            aria-label="Copy path to clipboard"
          >
            <DocumentDuplicateIcon className="h-4 w-4 text-white group-hover/action:scale-110 smooth-transition" />
          </button>
          <button
            onClick={handleOpenTerminal}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg smooth-transition group/action"
            title="Open in Terminal"
            aria-label="Open in terminal"
          >
            <CommandLineIcon className="h-4 w-4 text-white group-hover/action:scale-110 smooth-transition" />
          </button>
          <button
            onClick={handleOpenFolder}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg smooth-transition group/action"
            title="Open Project"
            aria-label="Open project"
          >
            <FolderOpenIcon className="h-4 w-4 text-white group-hover/action:scale-110 smooth-transition" />
          </button>
        </div>

        {/* Hover Glow Effect */}
        {isHovered && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(255, 107, 53, 0.1) 0%, transparent 70%)",
            }}
          />
        )}
      </div>

      {/* CSS Animation for Ripple */}
      <style>{`
        @keyframes ripple-expand {
          0% {
            width: 0;
            height: 0;
            opacity: 0.8;
          }
          100% {
            width: 400px;
            height: 400px;
            opacity: 0;
          }
        }

        @keyframes favorite-bounce {
          0%, 100% {
            transform: scale(1);
          }
          25% {
            transform: scale(1.3);
          }
          50% {
            transform: scale(0.9);
          }
          75% {
            transform: scale(1.1);
          }
        }

        .animate-favorite-bounce {
          animation: favorite-bounce 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
