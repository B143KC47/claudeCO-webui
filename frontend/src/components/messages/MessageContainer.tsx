import React from "react";

interface MessageContainerProps {
  alignment: "left" | "right" | "center";
  colorScheme: string;
  children: React.ReactNode;
  className?: string;
}

export function MessageContainer({
  alignment,
  colorScheme,
  children,
  className,
}: MessageContainerProps) {
  const justifyClass =
    alignment === "right"
      ? "justify-end"
      : alignment === "center"
        ? "justify-center"
        : "justify-start";

  return (
    <div className={`mb-4 flex ${justifyClass}`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-lg px-4 py-3 ${colorScheme} ${className || ""}`}
      >
        {children}
      </div>
    </div>
  );
}
