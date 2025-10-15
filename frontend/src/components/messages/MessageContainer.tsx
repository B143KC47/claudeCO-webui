import React from "react";

interface MessageContainerProps {
  alignment: "left" | "right" | "center";
  colorScheme: string;
  children: React.ReactNode;
  className?: string;
  isGrouped?: "first" | "middle" | "last" | "single" | false;
  showTail?: boolean;
}

export function MessageContainer({
  alignment,
  colorScheme,
  children,
  className,
  isGrouped = false,
  showTail = true,
}: MessageContainerProps) {
  const justifyClass =
    alignment === "right"
      ? "justify-end"
      : alignment === "center"
        ? "justify-center"
        : "justify-start";

  // Determine message grouping class for iOS-style spacing
  const groupClass = isGrouped
    ? isGrouped === "single"
      ? "message-single"
      : isGrouped === "first"
        ? "message-group-first"
        : isGrouped === "middle"
          ? "message-group-middle"
          : "message-group-last"
    : "mb-5";

  // Add tail classes for iOS bubble appearance
  const tailClass =
    showTail && alignment !== "center"
      ? alignment === "right"
        ? "message-bubble-tail-right"
        : "message-bubble-tail-left"
      : "";

  return (
    <div
      className={`flex ${justifyClass} smooth-transition group ${groupClass}`}
    >
      <div
        className={`
          ios-message-bubble
          animate-ios-spring
          ${tailClass}
          ${colorScheme}
          ${className || ""}
        `}
      >
        {children}
      </div>
    </div>
  );
}
