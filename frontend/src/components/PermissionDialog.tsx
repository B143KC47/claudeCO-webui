import {
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useLanguage } from "../contexts/LanguageContext";

interface PermissionDialogProps {
  isOpen: boolean;
  toolName: string;
  pattern: string;
  onAllow: () => void;
  onAllowPermanent: () => void;
  onDeny: () => void;
  onClose: () => void;
  // Optional extension point for custom button styling (e.g., demo effects)
  getButtonClassName?: (
    buttonType: "allow" | "allowPermanent" | "deny",
    defaultClassName: string,
  ) => string;
}

export function PermissionDialog({
  isOpen,
  toolName,
  pattern,
  onAllow,
  onAllowPermanent,
  onDeny,
  onClose,
  getButtonClassName = (_, defaultClassName) => defaultClassName, // Default: no modification
}: PermissionDialogProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleDeny = () => {
    onDeny();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="glass-card glow-effect rounded-xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-accent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <ExclamationTriangleIcon className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-primary">
              {t("permission.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 glass-button rounded-lg smooth-transition"
            aria-label="Close dialog"
          >
            <XMarkIcon className="w-5 h-5 text-accent" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-secondary mb-6">
            {t("permission.message")}{" "}
            <span className="font-mono bg-black-quaternary text-accent px-2 py-1 rounded text-sm">
              {pattern}
            </span>
          </p>

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={onAllow}
              className={getButtonClassName(
                "allow",
                "w-full px-4 py-3 bg-gradient-primary glow-effect hover:glow-border text-primary rounded-lg font-medium smooth-transition shadow-sm hover:shadow-md",
              )}
            >
              {t("permission.allowOnce")}
            </button>
            <button
              onClick={onAllowPermanent}
              className={getButtonClassName(
                "allowPermanent",
                "w-full px-4 py-3 bg-gradient-secondary glow-effect hover:glow-border text-primary rounded-lg font-medium smooth-transition shadow-sm hover:shadow-md",
              )}
            >
              {t("permission.allowAlways")}
            </button>
            <button
              onClick={handleDeny}
              className={getButtonClassName(
                "deny",
                "w-full px-4 py-3 glass-button hover:glow-effect text-secondary rounded-lg font-medium smooth-transition",
              )}
            >
              {t("permission.deny")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
