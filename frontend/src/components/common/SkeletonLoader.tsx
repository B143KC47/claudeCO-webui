import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  width?: string | number;
  height?: string | number;
  count?: number;
}

export function Skeleton({
  className = "",
  variant = "text",
  width,
  height,
  count = 1,
}: SkeletonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case "text":
        return "h-4 rounded";
      case "circular":
        return "rounded-full";
      case "rectangular":
        return "rounded-none";
      case "rounded":
        return "rounded-lg";
      default:
        return "rounded";
    }
  };

  const getStyles = () => {
    const styles: React.CSSProperties = {};
    if (width) styles.width = typeof width === "number" ? `${width}px` : width;
    if (height)
      styles.height = typeof height === "number" ? `${height}px` : height;
    return styles;
  };

  const skeletonElement = (
    <div
      className={`
        bg-gradient-to-r from-black-tertiary via-black-quaternary to-black-tertiary
        bg-[length:200%_100%] animate-skeleton
        ${getVariantClasses()}
        ${className}
      `}
      style={getStyles()}
      aria-hidden="true"
    />
  );

  if (count === 1) {
    return skeletonElement;
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{skeletonElement}</div>
      ))}
    </div>
  );
}

// Pre-built skeleton layouts for common use cases

export function CardSkeleton({ count = 1 }: { count?: number }) {
  const card = (
    <div className="glass-card p-4 sm:p-6 space-y-4" aria-busy="true">
      <div className="flex items-center space-x-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </div>
      </div>
      <Skeleton count={3} />
    </div>
  );

  if (count === 1) return card;

  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{card}</div>
      ))}
    </div>
  );
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          className="flex items-center space-x-3 p-3 rounded-lg bg-black-quaternary/50"
        >
          <Skeleton variant="circular" width={32} height={32} />
          <div className="flex-1 space-y-2">
            <Skeleton width="70%" />
            <Skeleton width="40%" />
          </div>
          <Skeleton variant="rounded" width={60} height={24} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="overflow-x-auto" aria-busy="true">
      <table className="w-full">
        <thead>
          <tr className="border-b border-accent/20">
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className="py-3 px-4 text-left">
                <Skeleton width="80%" height={16} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-accent/10">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="py-3 px-4">
                  <Skeleton width="90%" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SettingsTabSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6" aria-busy="true">
      {/* Header */}
      <div>
        <Skeleton width="40%" height={32} className="mb-2" />
        <Skeleton width="60%" height={20} />
      </div>

      {/* Settings Cards */}
      {[1, 2, 3].map((index) => (
        <div
          key={index}
          className="glass-card p-6 progressive-blur-light border border-accent/20 rounded-2xl"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton variant="circular" width={20} height={20} />
              <Skeleton width="30%" height={24} />
            </div>
            <div className="space-y-3">
              <Skeleton count={2} />
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Skeleton variant="rounded" height={100} />
                <Skeleton variant="rounded" height={100} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DeviceCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="p-4 rounded-xl bg-black-quaternary/50 border border-accent/10"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <Skeleton variant="rounded" width={56} height={56} />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton width="40%" height={20} />
                  <Skeleton variant="rounded" width={60} height={20} />
                </div>
                <Skeleton width="60%" />
                <Skeleton width="50%" />
              </div>
            </div>
            <Skeleton variant="rounded" width={70} height={36} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="glass-card p-6" aria-busy="true">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton width="30%" height={24} />
          <Skeleton variant="rounded" width={100} height={32} />
        </div>
        <Skeleton variant="rounded" height={height} />
        <div className="flex justify-between">
          <Skeleton width="15%" />
          <Skeleton width="15%" />
          <Skeleton width="15%" />
          <Skeleton width="15%" />
        </div>
      </div>
    </div>
  );
}
