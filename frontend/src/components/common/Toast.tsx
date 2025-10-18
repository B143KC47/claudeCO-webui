import React, { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Toast({ message, type, onClose, action }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
      case "error":
        return <XCircleIcon className="h-5 w-5 text-red-400" />;
      case "warning":
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />;
      case "info":
        return <InformationCircleIcon className="h-5 w-5 text-blue-400" />;
    }
  };

  const getStyles = () => {
    const baseStyles =
      "glass-card border-2 pointer-events-auto shadow-2xl min-w-[320px] max-w-md";

    switch (type) {
      case "success":
        return `${baseStyles} border-green-500/40 bg-green-500/10`;
      case "error":
        return `${baseStyles} border-red-500/40 bg-red-500/10`;
      case "warning":
        return `${baseStyles} border-yellow-500/40 bg-yellow-500/10`;
      case "info":
        return `${baseStyles} border-blue-500/40 bg-blue-500/10`;
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        ${getStyles()}
        transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="p-4 flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary font-medium leading-relaxed">
            {message}
          </p>

          {/* Action Button */}
          {action && (
            <button
              onClick={() => {
                action.onClick();
                handleClose();
              }}
              className="mt-2 text-xs font-semibold text-accent hover:text-accent-hover smooth-transition"
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 text-secondary hover:text-primary rounded-lg hover:bg-black-quaternary/50 smooth-transition"
          aria-label="Close notification"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar (optional enhancement) */}
      <div className="h-1 bg-black-quaternary/30 overflow-hidden rounded-b-2xl">
        <div
          className={`h-full ${
            type === "success"
              ? "bg-green-500"
              : type === "error"
                ? "bg-red-500"
                : type === "warning"
                  ? "bg-yellow-500"
                  : "bg-blue-500"
          }`}
          style={{
            animation: "toast-progress 5s linear forwards",
          }}
        />
      </div>

      <style>{`
        @keyframes toast-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
