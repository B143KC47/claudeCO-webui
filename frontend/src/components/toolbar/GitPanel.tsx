import { useState, useEffect, useCallback } from "react";
import {
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  MinusIcon,
  CheckIcon,
  ArrowPathIcon,
  EllipsisHorizontalIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  FolderIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import { getApiUrl } from "../../config/api";
import type {
  GitStatus,
  GitFile,
  GitBranch,
  GitCommit,
  GitDiff,
  FileStatus,
} from "../../../shared/gitTypes";

interface GitPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workingDirectory: string;
}

export function GitPanel({ isOpen, onClose, workingDirectory }: GitPanelProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null);
  const [fileDiffs, setFileDiffs] = useState<Map<string, GitDiff>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [recentCommits, setRecentCommits] = useState<GitCommit[]>([]);
  const [activeTab, setActiveTab] = useState<"changes" | "history">("changes");

  // Load git status on mount and when working directory changes
  useEffect(() => {
    if (isOpen && workingDirectory) {
      loadGitStatus();
      loadBranches();
      loadRecentCommits();
    }
  }, [isOpen, workingDirectory]);

  const loadGitStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(getApiUrl("/api/git/status"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error || response.statusText;
        throw new Error(`Failed to load git status: ${errorMessage}`);
      }

      const data = await response.json();
      setGitStatus(data);
    } catch (err) {
      console.error("Error loading git status:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load git status",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const response = await fetch(getApiUrl("/api/git/branches"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory }),
      });

      if (!response.ok) {
        throw new Error(`Failed to load branches: ${response.statusText}`);
      }

      const data = await response.json();
      setBranches(data);
    } catch (err) {
      console.error("Error loading branches:", err);
    }
  };

  const loadRecentCommits = async () => {
    try {
      const response = await fetch(getApiUrl("/api/git/log"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory, limit: 20 }),
      });

      if (!response.ok) {
        throw new Error(`Failed to load commits: ${response.statusText}`);
      }

      const data = await response.json();
      setRecentCommits(data);
    } catch (err) {
      console.error("Error loading commits:", err);
    }
  };

  const loadFileDiff = async (filePath: string) => {
    try {
      const response = await fetch(getApiUrl("/api/git/diff"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory, path: filePath }),
      });

      if (!response.ok) {
        throw new Error(`Failed to load diff: ${response.statusText}`);
      }

      const data = await response.json();
      setFileDiffs((prev) => new Map(prev).set(filePath, data));
    } catch (err) {
      console.error("Error loading diff:", err);
    }
  };

  const handleStageFile = async (filePath: string) => {
    try {
      const response = await fetch(getApiUrl("/api/git/stage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory, paths: [filePath] }),
      });

      if (!response.ok) {
        throw new Error(`Failed to stage file: ${response.statusText}`);
      }

      await loadGitStatus();
    } catch (err) {
      console.error("Error staging file:", err);
      setError(err instanceof Error ? err.message : "Failed to stage file");
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    try {
      const response = await fetch(getApiUrl("/api/git/unstage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory, paths: [filePath] }),
      });

      if (!response.ok) {
        throw new Error(`Failed to unstage file: ${response.statusText}`);
      }

      await loadGitStatus();
    } catch (err) {
      console.error("Error unstaging file:", err);
      setError(err instanceof Error ? err.message : "Failed to unstage file");
    }
  };

  const handleStageAll = async () => {
    if (!gitStatus) return;

    const unstagedFiles = gitStatus.files
      .filter((file) => !file.staged)
      .map((file) => file.path);

    if (unstagedFiles.length === 0) return;

    try {
      const response = await fetch(getApiUrl("/api/git/stage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory, paths: unstagedFiles }),
      });

      if (!response.ok) {
        throw new Error(`Failed to stage files: ${response.statusText}`);
      }

      await loadGitStatus();
    } catch (err) {
      console.error("Error staging files:", err);
      setError(err instanceof Error ? err.message : "Failed to stage files");
    }
  };

  const handleUnstageAll = async () => {
    if (!gitStatus) return;

    const stagedFiles = gitStatus.files
      .filter((file) => file.staged)
      .map((file) => file.path);

    if (stagedFiles.length === 0) return;

    try {
      const response = await fetch(getApiUrl("/api/git/unstage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory, paths: stagedFiles }),
      });

      if (!response.ok) {
        throw new Error(`Failed to unstage files: ${response.statusText}`);
      }

      await loadGitStatus();
    } catch (err) {
      console.error("Error unstaging files:", err);
      setError(err instanceof Error ? err.message : "Failed to unstage files");
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError("Please enter a commit message");
      return;
    }

    try {
      const response = await fetch(getApiUrl("/api/git/commit"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory, message: commitMessage }),
      });

      if (!response.ok) {
        throw new Error(`Failed to commit: ${response.statusText}`);
      }

      setCommitMessage("");
      await loadGitStatus();
      await loadRecentCommits();
    } catch (err) {
      console.error("Error committing:", err);
      setError(err instanceof Error ? err.message : "Failed to commit");
    }
  };

  const handlePush = async () => {
    try {
      const response = await fetch(getApiUrl("/api/git/push"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory }),
      });

      if (!response.ok) {
        throw new Error(`Failed to push: ${response.statusText}`);
      }

      await loadGitStatus();
    } catch (err) {
      console.error("Error pushing:", err);
      setError(err instanceof Error ? err.message : "Failed to push");
    }
  };

  const handlePull = async () => {
    try {
      const response = await fetch(getApiUrl("/api/git/pull"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull: ${response.statusText}`);
      }

      await loadGitStatus();
    } catch (err) {
      console.error("Error pulling:", err);
      setError(err instanceof Error ? err.message : "Failed to pull");
    }
  };

  const handleBranchChange = async (branchName: string) => {
    try {
      const response = await fetch(getApiUrl("/api/git/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory, branch: branchName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to checkout branch: ${response.statusText}`);
      }

      setShowBranchMenu(false);
      await loadGitStatus();
      await loadBranches();
      await loadRecentCommits();
    } catch (err) {
      console.error("Error changing branch:", err);
      setError(err instanceof Error ? err.message : "Failed to change branch");
    }
  };

  const toggleFileSelection = (filePath: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  const toggleDiffExpansion = async (filePath: string) => {
    if (expandedDiff === filePath) {
      setExpandedDiff(null);
    } else {
      setExpandedDiff(filePath);
      if (!fileDiffs.has(filePath)) {
        await loadFileDiff(filePath);
      }
    }
  };

  const getFileStatusIcon = (status: FileStatus) => {
    switch (status) {
      case "modified":
        return "M";
      case "added":
        return "A";
      case "deleted":
        return "D";
      case "renamed":
        return "R";
      case "copied":
        return "C";
      case "untracked":
        return "U";
      case "conflicted":
        return "!";
      default:
        return "?";
    }
  };

  const getFileStatusColor = (status: FileStatus) => {
    switch (status) {
      case "modified":
        return "text-yellow-400";
      case "added":
        return "text-green-400";
      case "deleted":
        return "text-red-400";
      case "renamed":
        return "text-blue-400";
      case "copied":
        return "text-blue-400";
      case "untracked":
        return "text-tertiary";
      case "conflicted":
        return "text-accent";
      default:
        return "text-secondary";
    }
  };

  const renderFileItem = (file: GitFile) => {
    const isExpanded = expandedDiff === file.path;
    const diff = fileDiffs.get(file.path);

    return (
      <div key={file.path} className="mb-1">
        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-black-secondary/50 rounded smooth-transition group">
          <button
            onClick={() => toggleDiffExpansion(file.path)}
            className="p-0.5 hover:bg-black-tertiary/50 rounded smooth-transition"
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-3 w-3 text-tertiary" />
            ) : (
              <ChevronRightIcon className="h-3 w-3 text-tertiary" />
            )}
          </button>

          <span
            className={`font-mono text-xs font-bold ${getFileStatusColor(
              file.status,
            )}`}
          >
            {getFileStatusIcon(file.status)}
          </span>

          <span className="flex-1 text-sm text-secondary truncate">
            {file.path}
            {file.oldPath && (
              <span className="text-tertiary"> ← {file.oldPath}</span>
            )}
          </span>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {file.staged ? (
              <button
                onClick={() => handleUnstageFile(file.path)}
                className="p-1 glass-button rounded text-secondary hover:text-primary smooth-transition"
                title="Unstage"
              >
                <MinusIcon className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={() => handleStageFile(file.path)}
                className="p-1 glass-button rounded text-secondary hover:text-primary smooth-transition"
                title="Stage"
              >
                <PlusIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {isExpanded && diff && (
          <div className="mx-2 mt-1 bg-black-tertiary/50 p-2 font-mono text-xs overflow-x-auto rounded">
            {diff.isBinary ? (
              <div className="text-tertiary">Binary file</div>
            ) : (
              <div className="space-y-0.5">
                {diff.changes.map((change, idx) => (
                  <div
                    key={idx}
                    className={`px-1 ${
                      change.type === "add"
                        ? "bg-green-900/20 text-green-400"
                        : change.type === "delete"
                          ? "bg-red-900/20 text-red-400"
                          : "text-secondary"
                    }`}
                  >
                    <span className="select-none mr-2 text-tertiary opacity-50 text-[10px]">
                      {change.oldLineNumber || " "}
                    </span>
                    <span className="select-none mr-2 text-tertiary opacity-50 text-[10px]">
                      {change.newLineNumber || " "}
                    </span>
                    {change.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCommitItem = (commit: GitCommit) => {
    const authorInitial = commit.author?.name
      ? commit.author.name.charAt(0).toUpperCase()
      : "?";

    return (
      <div
        key={commit.hash}
        className="flex items-start gap-3 p-3 hover:bg-black-secondary/50 rounded smooth-transition mb-2"
      >
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-xs text-primary font-medium">
            {authorInitial}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-accent">
              {commit.abbreviatedHash}
            </span>
            {commit.refs?.map((ref) => (
              <span
                key={ref}
                className="text-xs px-2 py-0.5 rounded glass-button text-secondary"
              >
                {ref}
              </span>
            ))}
          </div>
          <p className="text-sm text-primary mt-1 font-medium">{commit.subject || "No commit message"}</p>
          <div className="flex items-center gap-4 mt-1 text-xs text-tertiary">
            <span>{commit.author?.name || "Unknown author"}</span>
            <span>{commit.author?.date ? new Date(commit.author.date).toLocaleString() : "Unknown date"}</span>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-secondary text-sm">
          <CodeBracketIcon className="w-4 h-4 text-accent" />
          <span>Source Control</span>
          {gitStatus && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBranchMenu(!showBranchMenu)}
                className="flex items-center gap-1 px-2 py-1 text-xs glass-button rounded text-secondary hover:text-primary smooth-transition"
              >
                <span>{gitStatus.branch}</span>
                <ChevronDownIcon className="h-3 w-3" />
              </button>
              {gitStatus.upstream && (
                <div className="flex items-center gap-1 text-xs text-tertiary">
                  {gitStatus.ahead > 0 && (
                    <span className="flex items-center">
                      <ArrowUpIcon className="h-3 w-3" />
                      {gitStatus.ahead}
                    </span>
                  )}
                  {gitStatus.behind > 0 && (
                    <span className="flex items-center">
                      <ArrowDownIcon className="h-3 w-3" />
                      {gitStatus.behind}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePull}
            className="p-2 glass-button glow-border smooth-transition rounded-lg"
            title="Pull"
          >
            <ArrowDownIcon className="w-4 h-4 text-accent" />
          </button>
          <button
            onClick={handlePush}
            className="p-2 glass-button glow-border smooth-transition rounded-lg"
            title="Push"
          >
            <ArrowUpIcon className="w-4 h-4 text-accent" />
          </button>
          <button
            onClick={loadGitStatus}
            className="p-2 glass-button glow-border smooth-transition rounded-lg"
            title="Refresh"
          >
            <ArrowPathIcon className="w-4 h-4 text-accent" />
          </button>
        </div>
      </div>

      {/* Branch Menu Dropdown */}
      {showBranchMenu && (
        <div className="absolute z-50 mt-2 w-64 glass-card glow-effect rounded-lg shadow-lg">
          <div className="max-h-64 overflow-y-auto p-2">
            {branches.map((branch) => (
              <button
                key={branch.name}
                onClick={() => handleBranchChange(branch.name)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-black-secondary/50 smooth-transition rounded flex items-center justify-between"
              >
                <span className="text-secondary">{branch.name}</span>
                {branch.current && (
                  <CheckIcon className="h-4 w-4 text-accent" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("changes")}
          className={`px-3 py-1.5 text-sm rounded-lg smooth-transition ${
            activeTab === "changes"
              ? "bg-gradient-primary text-primary glow-effect"
              : "glass-button text-secondary hover:text-primary"
          }`}
        >
          Changes
          {gitStatus && gitStatus.files.length > 0 && (
            <span className="ml-2 text-xs">
              ({gitStatus.files.length})
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-3 py-1.5 text-sm rounded-lg smooth-transition ${
            activeTab === "history"
              ? "bg-gradient-primary text-primary glow-effect"
              : "glass-button text-secondary hover:text-primary"
          }`}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 glass-card rounded-lg overflow-hidden flex flex-col min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-red-400 text-sm bg-red-500/10 rounded-lg m-4">{error}</div>
        ) : activeTab === "changes" ? (
          <>
            {/* Commit Message Input */}
            <div className="p-4">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                className="w-full px-3 py-2 bg-black-secondary text-primary text-sm rounded-lg border border-accent/20 focus:border-accent focus:outline-none resize-none smooth-transition"
                rows={3}
              />
              <div className="flex justify-between items-center mt-3">
                <div className="flex gap-2">
                  <button
                    onClick={handleStageAll}
                    className="text-xs px-3 py-1 glass-button glow-border rounded text-secondary hover:text-primary smooth-transition"
                    disabled={
                      !gitStatus ||
                      gitStatus.files.filter((f) => !f.staged).length === 0
                    }
                  >
                    Stage All
                  </button>
                  <button
                    onClick={handleUnstageAll}
                    className="text-xs px-3 py-1 glass-button glow-border rounded text-secondary hover:text-primary smooth-transition"
                    disabled={
                      !gitStatus ||
                      gitStatus.files.filter((f) => f.staged).length === 0
                    }
                  >
                    Unstage All
                  </button>
                </div>
                <button
                  onClick={handleCommit}
                  className="px-4 py-1.5 bg-gradient-primary text-primary text-sm rounded-lg hover:glow-effect smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={
                    !commitMessage.trim() ||
                    !gitStatus ||
                    gitStatus.files.filter((f) => f.staged).length === 0
                  }
                >
                  Commit
                </button>
              </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto">
              {gitStatus && gitStatus.files.length > 0 ? (
                <>
                  {/* Staged Changes */}
                  {gitStatus.files.filter((f) => f.staged).length > 0 && (
                    <div className="mb-4">
                      <div className="px-3 py-2 text-xs text-tertiary uppercase tracking-wide">
                        Staged Changes ({gitStatus.files.filter((f) => f.staged).length})
                      </div>
                      <div className="px-2">
                        {gitStatus.files
                          .filter((f) => f.staged)
                          .map((file) => renderFileItem(file))}
                      </div>
                    </div>
                  )}

                  {/* Unstaged Changes */}
                  {gitStatus.files.filter((f) => !f.staged).length > 0 && (
                    <div className="mb-4">
                      <div className="px-3 py-2 text-xs text-tertiary uppercase tracking-wide">
                        Changes ({gitStatus.files.filter((f) => !f.staged).length})
                      </div>
                      <div className="px-2">
                        {gitStatus.files
                          .filter((f) => !f.staged)
                          .map((file) => renderFileItem(file))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-tertiary text-sm">
                  No changes
                </div>
              )}
            </div>
          </>
        ) : (
          /* History Tab */
          <div className="flex-1 overflow-y-auto p-4">
            {recentCommits.length > 0 ? (
              <div>
                {recentCommits.map((commit) => renderCommitItem(commit))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-tertiary text-sm">
                No commits found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
