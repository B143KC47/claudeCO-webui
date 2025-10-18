import { useState, useEffect, useCallback, memo } from "react";
import {
  XMarkIcon,
  DocumentDuplicateIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import type { GitDiff, GitFile } from "../../../shared/gitTypes";
import { getGitDiff } from "../../actions/git";
import { getFileIcon, getFileExtension } from "../../utils/gitHelpers";

interface DiffViewerProps {
  file: GitFile;
  workingDirectory: string;
  isExpanded: boolean;
  onCollapse: () => void;
}

interface DiffLineProps {
  change: GitDiff["changes"][0];
  showLineNumbers: boolean;
  isUnified: boolean;
}

function DiffLine({ change, showLineNumbers, isUnified }: DiffLineProps) {
  const getLineClass = () => {
    switch (change.type) {
      case "add":
        return "bg-green-500/10 text-green-400 dark:bg-green-900/20";
      case "delete":
        return "bg-red-500/10 text-red-400 dark:bg-red-900/20";
      default:
        return "text-secondary";
    }
  };

  const getLineSymbol = () => {
    switch (change.type) {
      case "add":
        return "+";
      case "delete":
        return "-";
      default:
        return " ";
    }
  };

  return (
    <div className={`font-mono text-xs ${getLineClass()} flex`}>
      {showLineNumbers && (
        <>
          <span className="w-12 px-2 text-right select-none text-tertiary opacity-50">
            {change.oldLineNumber || ""}
          </span>
          <span className="w-12 px-2 text-right select-none text-tertiary opacity-50">
            {change.newLineNumber || ""}
          </span>
        </>
      )}
      <span className="w-6 text-center select-none opacity-70">
        {getLineSymbol()}
      </span>
      <pre className="flex-1 px-2 whitespace-pre overflow-x-auto">
        {change.content || " "}
      </pre>
    </div>
  );
}

const DiffViewer = memo(function DiffViewer({
  file,
  workingDirectory,
  isExpanded,
  onCollapse,
}: DiffViewerProps) {
  const [diff, setDiff] = useState<GitDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [isUnified, setIsUnified] = useState(true);

  const loadDiff = useCallback(async () => {
    if (!isExpanded) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getGitDiff(workingDirectory, file.path, file.staged);
      if (result.success) {
        setDiff(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load diff");
    } finally {
      setIsLoading(false);
    }
  }, [workingDirectory, file.path, file.staged, isExpanded]);

  useEffect(() => {
    if (isExpanded) {
      loadDiff();
    }
  }, [isExpanded, loadDiff]);

  const handleCopyDiff = useCallback(() => {
    if (!diff) return;

    const diffText = diff.changes
      .map((change) => {
        const symbol =
          change.type === "add" ? "+" : change.type === "delete" ? "-" : " ";
        return `${symbol}${change.content}`;
      })
      .join("\n");

    navigator.clipboard.writeText(diffText);
  }, [diff]);

  if (!isExpanded) return null;

  return (
    <div
      className={`
        mt-2 glass-card overflow-hidden smooth-transition
        ${isFullScreen ? "fixed inset-4 z-50" : ""}
      `}
    >
      {/* Diff Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent/20 bg-black-secondary/50">
        <div className="flex items-center gap-3">
          <span className="text-base">{getFileIcon(file.path)}</span>
          <span className="text-sm font-medium text-primary">{file.path}</span>
          {diff && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-400">+{diff.additions}</span>
              <span className="text-red-400">-{diff.deletions}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Line Numbers Toggle */}
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className="p-1.5 glass-button rounded text-tertiary hover:text-primary smooth-transition"
            title={showLineNumbers ? "Hide line numbers" : "Show line numbers"}
          >
            {showLineNumbers ? (
              <EyeSlashIcon className="w-4 h-4" />
            ) : (
              <EyeIcon className="w-4 h-4" />
            )}
          </button>

          {/* Copy Diff */}
          <button
            onClick={handleCopyDiff}
            className="p-1.5 glass-button rounded text-tertiary hover:text-primary smooth-transition"
            title="Copy diff"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 glass-button rounded text-tertiary hover:text-primary smooth-transition"
            title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullScreen ? (
              <ArrowsPointingInIcon className="w-4 h-4" />
            ) : (
              <ArrowsPointingOutIcon className="w-4 h-4" />
            )}
          </button>

          {/* Close Button */}
          <button
            onClick={onCollapse}
            className="p-1.5 glass-button rounded text-tertiary hover:text-primary smooth-transition"
            title="Close diff"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Diff Content */}
      <div
        className={`bg-black-tertiary/50 ${isFullScreen ? "h-[calc(100%-60px)]" : "max-h-96"} overflow-auto`}
      >
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
          </div>
        )}

        {error && (
          <div className="p-4 text-red-400 text-sm">
            Error loading diff: {error}
          </div>
        )}

        {diff && !isLoading && (
          <>
            {diff.isBinary ? (
              <div className="p-4 text-tertiary text-sm text-center">
                Binary file (not shown)
              </div>
            ) : diff.changes.length === 0 ? (
              <div className="p-4 text-tertiary text-sm text-center">
                No changes to display
              </div>
            ) : (
              <div className="p-2">
                {diff.changes.map((change, idx) => (
                  <DiffLine
                    key={idx}
                    change={change}
                    showLineNumbers={showLineNumbers}
                    isUnified={isUnified}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export { DiffViewer };

// Collapsible wrapper for inline diffs
interface InlineDiffViewerProps {
  file: GitFile;
  workingDirectory: string;
}

export function InlineDiffViewer({
  file,
  workingDirectory,
}: InlineDiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-1">
      {isExpanded ? (
        <DiffViewer
          file={file}
          workingDirectory={workingDirectory}
          isExpanded={isExpanded}
          onCollapse={() => setIsExpanded(false)}
        />
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full text-left px-3 py-2 text-xs glass-button rounded hover:glow-effect smooth-transition"
        >
          Show diff
        </button>
      )}
    </div>
  );
}
