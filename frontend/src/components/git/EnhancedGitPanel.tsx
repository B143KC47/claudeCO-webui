import { useCallback } from "react";
import { GitPanel } from "../toolbar/GitPanel";
import { ToastProvider, useToast } from "../../contexts/ToastContext";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { useState } from "react";

interface EnhancedGitPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workingDirectory: string;
}

// Inner component that uses toast
function GitPanelWithToast({
  isOpen,
  onClose,
  workingDirectory,
}: EnhancedGitPanelProps) {
  const { showToast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Example: Add toast notifications to git operations
  const handleGitOperation = useCallback(
    (operation: string, success: boolean, message?: string) => {
      if (success) {
        showToast({
          type: "success",
          title: `${operation} successful`,
          message,
        });
      } else {
        showToast({
          type: "error",
          title: `${operation} failed`,
          message,
        });
      }
    },
    [showToast],
  );

  // Example: Show confirmation dialog for dangerous operations
  const showConfirmation = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        onConfirm,
      });
    },
    [],
  );

  return (
    <>
      <GitPanel
        isOpen={isOpen}
        onClose={onClose}
        workingDirectory={workingDirectory}
      />
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(null)}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
          title={confirmDialog.title}
          message={confirmDialog.message}
          type="warning"
        />
      )}
    </>
  );
}

// Main component that provides toast context
export function EnhancedGitPanel(props: EnhancedGitPanelProps) {
  return (
    <ToastProvider>
      <GitPanelWithToast {...props} />
    </ToastProvider>
  );
}
