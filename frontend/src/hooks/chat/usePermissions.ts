import { useState, useCallback } from "react";

interface PermissionDialog {
  isOpen: boolean;
  toolName: string;
  pattern: string;
  toolUseId: string;
}

export function usePermissions() {
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [permissionDialog, setPermissionDialog] =
    useState<PermissionDialog | null>(null);

  const showPermissionDialog = useCallback(
    (toolName: string, pattern: string, toolUseId: string) => {
      setPermissionDialog({
        isOpen: true,
        toolName,
        pattern,
        toolUseId,
      });
    },
    [],
  );

  const closePermissionDialog = useCallback(() => {
    setPermissionDialog(null);
  }, []);

  const allowToolTemporary = useCallback(
    (pattern: string) => {
      return [...allowedTools, pattern];
    },
    [allowedTools],
  );

  const allowToolPermanent = useCallback(
    (pattern: string) => {
      const updatedAllowedTools = [...allowedTools, pattern];
      setAllowedTools(updatedAllowedTools);
      return updatedAllowedTools;
    },
    [allowedTools],
  );

  const resetPermissions = useCallback(() => {
    setAllowedTools([]);
  }, []);

  return {
    allowedTools,
    permissionDialog,
    showPermissionDialog,
    closePermissionDialog,
    allowToolTemporary,
    allowToolPermanent,
    resetPermissions,
  };
}
