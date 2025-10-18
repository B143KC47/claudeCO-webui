import { Fragment, ReactNode } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  footer?: ReactNode;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showCloseButton = true,
  footer,
  className = "",
}: ModalProps) {
  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "max-w-md";
      case "md":
        return "max-w-lg";
      case "lg":
        return "max-w-2xl";
      case "xl":
        return "max-w-4xl";
      case "full":
        return "max-w-7xl";
      default:
        return "max-w-lg";
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        </Transition.Child>

        {/* Modal Container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-4"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-4"
            >
              <Dialog.Panel
                className={`
                  w-full ${getSizeClasses()}
                  transform overflow-hidden rounded-2xl
                  glass-card progressive-blur-heavy border border-accent/30
                  glow-effect shadow-2xl
                  transition-all ${className}
                `}
              >
                {/* Header */}
                {(title || showCloseButton) && (
                  <div className="flex items-center justify-between p-6 pb-4 border-b border-accent/20">
                    {title && (
                      <Dialog.Title
                        as="h3"
                        className="text-xl font-bold text-primary text-gradient"
                      >
                        {title}
                      </Dialog.Title>
                    )}
                    {!title && <div />}
                    {showCloseButton && (
                      <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-secondary hover:text-primary rounded-lg hover:bg-black-quaternary/50 smooth-transition"
                        aria-label="Close modal"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="p-6">{children}</div>

                {/* Footer */}
                {footer && (
                  <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-accent/20">
                    {footer}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Pre-built button components for common use cases
export function ModalButton({
  onClick,
  variant = "primary",
  children,
  disabled = false,
  type = "button",
}: {
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) {
  const getVariantClasses = () => {
    switch (variant) {
      case "primary":
        return "bg-gradient-primary text-white glow-effect";
      case "secondary":
        return "glass-button text-primary";
      case "danger":
        return "bg-red-500 hover:bg-red-600 text-white";
      case "ghost":
        return "text-secondary hover:text-primary hover:bg-black-quaternary/50";
      default:
        return "glass-button text-primary";
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-2 text-sm font-medium rounded-lg smooth-transition
        disabled:opacity-50 disabled:cursor-not-allowed
        ${getVariantClasses()}
      `}
    >
      {children}
    </button>
  );
}
