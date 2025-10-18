import { useState, useCallback } from "react";
import { ClockIcon } from "@heroicons/react/24/outline";
import { useGitStatus, useFileSelection } from "../../hooks/useGitStatus";
import { checkoutBranch } from "../../actions/git";
import { GitStatusBar } from "../git/GitStatusBar";
import { FileList } from "../git/FileList";
import { InlineDiffViewer } from "../git/DiffViewer";
import { CommitForm, CommitHistory } from "../git/CommitForm";
import { groupFilesByStatus } from "../../utils/gitHelpers";

interface GitPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workingDirectory: string;
}

export function GitPanel({ isOpen, onClose, workingDirectory }: GitPanelProps) {
  const [activeTab, setActiveTab] = useState<"changes" | "history">("changes");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Use custom hooks
  const {
    status,
    branches,
    commits,
    isLoading,
    error: gitError,
    isRefreshing,
    refresh,
  } = useGitStatus({
    workingDirectory,
    enabled: isOpen,
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  const { selectedFiles, toggleFileSelection, selectAll, deselectAll } =
    useFileSelection();

  // Handle branch change
  const handleBranchChange = useCallback(
    async (branchName: string) => {
      try {
        setError(null);
        const result = await checkoutBranch(workingDirectory, branchName);
        if (result.success) {
          await refresh();
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to change branch",
        );
      }
    },
    [workingDirectory, refresh],
  );

  // Handle file expansion
  const toggleFileExpansion = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  if (!isOpen) return null;

  const groupedFiles = status ? groupFilesByStatus(status.files) : null;
  const stagedFiles = groupedFiles?.staged || [];

  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">
      {/* Status Bar */}
      <GitStatusBar
        status={status}
        branches={branches}
        workingDirectory={workingDirectory}
        onBranchChange={handleBranchChange}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />

      {/* Error Display */}
      {(error || gitError) && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error || gitError}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 px-4">
        <button
          onClick={() => setActiveTab("changes")}
          className={`
            px-3 py-1.5 text-sm rounded-lg smooth-transition font-medium
            ${
              activeTab === "changes"
                ? "bg-gradient-primary text-primary glow-effect"
                : "glass-button text-secondary hover:text-primary"
            }
          `}
        >
          Changes
          {status && status.files.length > 0 && (
            <span className="ml-2 text-xs opacity-70">
              ({status.files.length})
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`
            px-3 py-1.5 text-sm rounded-lg smooth-transition font-medium flex items-center gap-2
            ${
              activeTab === "history"
                ? "bg-gradient-primary text-primary glow-effect"
                : "glass-button text-secondary hover:text-primary"
            }
          `}
        >
          <ClockIcon className="w-4 h-4" />
          History
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 glass-card rounded-lg overflow-hidden flex flex-col min-h-0">
        {isLoading && !status ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
          </div>
        ) : activeTab === "changes" ? (
          <>
            {/* Commit Form */}
            {stagedFiles.length > 0 && (
              <CommitForm
                workingDirectory={workingDirectory}
                stagedFiles={stagedFiles}
                onCommitSuccess={refresh}
                onError={setError}
              />
            )}

            {/* File List */}
            <div className="flex-1 overflow-y-auto">
              {status && (
                <>
                  <FileList
                    files={status.files}
                    workingDirectory={workingDirectory}
                    expandedFiles={expandedFiles}
                    onFileExpand={toggleFileExpansion}
                    onRefresh={refresh}
                    selectedFiles={selectedFiles}
                    onFileSelect={toggleFileSelection}
                    onSelectAll={selectAll}
                    onDeselectAll={deselectAll}
                  />

                  {/* Inline Diff Viewers */}
                  {status.files.map(
                    (file) =>
                      expandedFiles.has(file.path) && (
                        <InlineDiffViewer
                          key={file.path}
                          file={file}
                          workingDirectory={workingDirectory}
                        />
                      ),
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          /* History Tab */
          <div className="flex-1 overflow-y-auto">
            <CommitHistory commits={commits} />
          </div>
        )}
      </div>
    </div>
  );
}
