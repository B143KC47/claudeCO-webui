import React, { ReactNode } from "react";
import {
  InboxIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ServerIcon,
  DevicePhoneMobileIcon,
  DocumentTextIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

export type EmptyStateIcon =
  | "inbox"
  | "search"
  | "warning"
  | "server"
  | "device"
  | "document"
  | "chart"
  | "custom";

interface EmptyStateProps {
  icon?: EmptyStateIcon;
  customIcon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon = "inbox",
  customIcon,
  title,
  description,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  const getIcon = () => {
    if (customIcon) return customIcon;

    const iconClasses = "h-12 w-12 text-accent";

    switch (icon) {
      case "inbox":
        return <InboxIcon className={iconClasses} />;
      case "search":
        return <MagnifyingGlassIcon className={iconClasses} />;
      case "warning":
        return <ExclamationTriangleIcon className={iconClasses} />;
      case "server":
        return <ServerIcon className={iconClasses} />;
      case "device":
        return <DevicePhoneMobileIcon className={iconClasses} />;
      case "document":
        return <DocumentTextIcon className={iconClasses} />;
      case "chart":
        return <ChartBarIcon className={iconClasses} />;
      default:
        return <InboxIcon className={iconClasses} />;
    }
  };

  return (
    <div
      className={`
        flex flex-col items-center justify-center
        text-center py-12 px-4
        ${className}
      `}
      role="status"
      aria-live="polite"
    >
      {/* Icon Container */}
      <div
        className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-primary/10 border-2 border-accent/30 mb-6 animate-fade-in"
        style={{
          animation: "fade-in 0.5s ease-out, float 3s ease-in-out infinite",
        }}
      >
        {getIcon()}
      </div>

      {/* Title */}
      <h3
        className="text-xl font-bold text-primary mb-2 animate-fade-in"
        style={{ animationDelay: "0.1s" }}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className="text-secondary max-w-md mb-6 animate-fade-in"
          style={{ animationDelay: "0.2s" }}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div
          className="flex flex-col sm:flex-row gap-3 animate-fade-in"
          style={{ animationDelay: "0.3s" }}
        >
          {action && (
            <button
              onClick={action.onClick}
              className="px-6 py-2.5 bg-gradient-primary text-white font-medium rounded-lg glow-effect hover:scale-105 smooth-transition"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-6 py-2.5 glass-button text-primary font-medium rounded-lg hover:scale-105 smooth-transition"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
}

// Pre-built empty states for common scenarios

export function NoDataEmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      icon="chart"
      title="No Data Available"
      description="There's no data to display yet. Start using the application to see your data here."
      action={onRefresh ? { label: "Refresh", onClick: onRefresh } : undefined}
    />
  );
}

export function NoResultsEmptyState({
  searchTerm,
  onClear,
}: {
  searchTerm?: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      icon="search"
      title="No Results Found"
      description={
        searchTerm
          ? `No results found for "${searchTerm}". Try adjusting your search or filters.`
          : "No results found. Try adjusting your search or filters."
      }
      action={onClear ? { label: "Clear Search", onClick: onClear } : undefined}
    />
  );
}

export function NoDevicesEmptyState({ onConnect }: { onConnect?: () => void }) {
  return (
    <EmptyState
      icon="device"
      title="No Devices Connected"
      description="You haven't connected any devices yet. Use the connection URLs above to add a device."
      action={
        onConnect ? { label: "Learn More", onClick: onConnect } : undefined
      }
    />
  );
}

export function NoServersEmptyState({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon="server"
      title="No Servers Configured"
      description="You haven't configured any MCP servers yet. Use the claude mcp add command to get started."
      action={onAdd ? { label: "Learn How", onClick: onAdd } : undefined}
    />
  );
}

export function ErrorEmptyState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon="warning"
      title="Something Went Wrong"
      description={
        message ||
        "We encountered an error loading this content. Please try again."
      }
      action={onRetry ? { label: "Try Again", onClick: onRetry } : undefined}
    />
  );
}
