import { useState } from "react";
import {
  CodeBracketIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
} from "@heroicons/react/24/outline";
import type { GitStatus, GitBranch } from "../../../shared/gitTypes";
import { pullChanges, pushChanges } from "../../actions/git";

interface GitStatusBarProps {
  status: GitStatus | null;
  branches: GitBranch[];
  workingDirectory: string;
  onBranchChange: (branch: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function GitStatusBar({
  status,
  branches,
  workingDirectory,
  onBranchChange,
  onRefresh,
  isRefreshing,
}: GitStatusBarProps) {
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const handlePull = async () => {
    if (isPulling || !workingDirectory) return;

    setIsPulling(true);
    try {
      const result = await pullChanges(workingDirectory);
      if (result.success) {
        onRefresh();
      } else {
        console.error("Pull failed:", result.error);
      }
    } finally {
      setIsPulling(false);
    }
  };

  const handlePush = async () => {
    if (isPushing || !workingDirectory) return;

    setIsPushing(true);
    try {
      const result = await pushChanges(workingDirectory);
      if (result.success) {
        onRefresh();
      } else {
        console.error("Push failed:", result.error);
      }
    } finally {
      setIsPushing(false);
    }
  };

  const handleBranchSelect = (branchName: string) => {
    setShowBranchMenu(false);
    onBranchChange(branchName);
  };

  return (
    <div className="flex items-center justify-between flex-shrink-0 pb-3 border-b border-accent/20">
      <div className="flex items-center gap-3">
        {/* Git Icon */}
        <div className="flex items-center gap-2">
          <CodeBracketIcon className="w-5 h-5 text-accent" />
          <span className="text-sm font-medium text-secondary">
            Source Control
          </span>
        </div>

        {/* Branch Selector */}
        {status && (
          <div className="relative">
            <button
              onClick={() => setShowBranchMenu(!showBranchMenu)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm glass-button rounded-lg hover:glow-effect smooth-transition"
              aria-label={`Current branch: ${status.branch}`}
            >
              <span className="font-medium text-primary">{status.branch}</span>
              <ChevronDownIcon
                className={`h-4 w-4 text-tertiary transition-transform ${
                  showBranchMenu ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Branch Dropdown Menu */}
            {showBranchMenu && (
              <div className="absolute z-50 mt-2 w-72 glass-card glow-effect rounded-lg shadow-xl">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-medium text-tertiary uppercase tracking-wider">
                    Switch Branch
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {branches.map((branch) => (
                      <button
                        key={branch.name}
                        onClick={() => handleBranchSelect(branch.name)}
                        className={`
                          w-full text-left px-3 py-2 text-sm rounded-lg smooth-transition
                          flex items-center justify-between group
                          ${
                            branch.current
                              ? "bg-gradient-primary text-primary"
                              : "hover:bg-black-secondary/50 text-secondary hover:text-primary"
                          }
                        `}
                      >
                        <span className="font-medium">{branch.name}</span>
                        <div className="flex items-center gap-2">
                          {branch.upstream && (
                            <div className="flex items-center gap-1 text-xs">
                              {branch.ahead !== undefined &&
                                branch.ahead > 0 && (
                                  <span className="flex items-center gap-0.5 text-green-400">
                                    <ArrowUpIcon className="h-3 w-3" />
                                    {branch.ahead}
                                  </span>
                                )}
                              {branch.behind !== undefined &&
                                branch.behind > 0 && (
                                  <span className="flex items-center gap-0.5 text-yellow-400">
                                    <ArrowDownIcon className="h-3 w-3" />
                                    {branch.behind}
                                  </span>
                                )}
                            </div>
                          )}
                          {branch.current && (
                            <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {branches.length === 0 && (
                    <div className="px-3 py-4 text-sm text-tertiary text-center">
                      No branches found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sync Status */}
        {status?.upstream && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-black-secondary/50 text-xs">
            {status.ahead > 0 && (
              <span className="flex items-center gap-1 text-green-400">
                <ArrowUpIcon className="h-3 w-3" />
                {status.ahead}
              </span>
            )}
            {status.behind > 0 && (
              <span className="flex items-center gap-1 text-yellow-400">
                <ArrowDownIcon className="h-3 w-3" />
                {status.behind}
              </span>
            )}
            {status.ahead === 0 && status.behind === 0 && (
              <span className="text-green-400">✓ Up to date</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Pull Button */}
        <button
          onClick={handlePull}
          disabled={isPulling}
          className={`
            p-2 glass-button rounded-lg smooth-transition
            hover:glow-effect hover:border-accent
            ${isPulling ? "opacity-50 cursor-not-allowed" : ""}
          `}
          aria-label="Pull from remote"
          title="Pull from remote"
        >
          {isPulling ? (
            <ArrowPathIcon className="w-4 h-4 text-accent animate-spin" />
          ) : (
            <CloudArrowDownIcon className="w-4 h-4 text-accent" />
          )}
        </button>

        {/* Push Button */}
        <button
          onClick={handlePush}
          disabled={isPushing || (status?.ahead || 0) === 0}
          className={`
            p-2 glass-button rounded-lg smooth-transition
            hover:glow-effect hover:border-accent
            ${isPushing || (status?.ahead || 0) === 0 ? "opacity-50 cursor-not-allowed" : ""}
          `}
          aria-label={`Push to remote${status?.ahead ? ` (${status.ahead} commits)` : ""}`}
          title={`Push to remote${status?.ahead ? ` (${status.ahead} commits)` : ""}`}
        >
          {isPushing ? (
            <ArrowPathIcon className="w-4 h-4 text-accent animate-spin" />
          ) : (
            <CloudArrowUpIcon className="w-4 h-4 text-accent" />
          )}
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`
            p-2 glass-button rounded-lg smooth-transition
            hover:glow-effect hover:border-accent
            ${isRefreshing ? "opacity-50 cursor-not-allowed" : ""}
          `}
          aria-label="Refresh git status"
          title="Refresh"
        >
          <ArrowPathIcon
            className={`w-4 h-4 text-accent ${
              isRefreshing ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>
    </div>
  );
}
