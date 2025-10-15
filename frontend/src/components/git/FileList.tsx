import { useState, useCallback } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  MinusIcon,
  FolderOpenIcon,
  DocumentIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import type { GitFile } from "../../../shared/gitTypes";
import {
  FILE_STATUS_COLORS,
  FILE_STATUS_ICONS,
  FILE_STATUS_BG_COLORS,
  getFileIcon,
  formatFilePath,
  groupFilesByStatus,
} from "../../utils/gitHelpers";
import { stageFiles, unstageFiles, toggleFileStaging } from "../../actions/git";

interface FileListProps {
  files: GitFile[];
  workingDirectory: string;
  expandedFiles: Set<string>;
  onFileExpand: (path: string) => void;
  onRefresh: () => void;
  selectedFiles: Set<string>;
  onFileSelect: (path: string) => void;
  onSelectAll: (paths: string[]) => void;
  onDeselectAll: () => void;
}

interface FileGroupProps {
  title: string;
  files: GitFile[];
  isExpanded: boolean;
  onToggle: () => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  workingDirectory: string;
  expandedFiles: Set<string>;
  onFileExpand: (path: string) => void;
  onRefresh: () => void;
  selectedFiles: Set<string>;
  onFileSelect: (path: string) => void;
  onSelectAll: () => void;
  count: number;
}

function FileGroup({
  title,
  files,
  isExpanded,
  onToggle,
  onStageAll,
  onUnstageAll,
  workingDirectory,
  expandedFiles,
  onFileExpand,
  onRefresh,
  selectedFiles,
  onFileSelect,
  onSelectAll,
  count,
}: FileGroupProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBulkAction = async (action: () => Promise<any>) => {
    setIsProcessing(true);
    try {
      await action();
      onRefresh();
    } catch (error) {
      console.error("Bulk action failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const allSelected =
    files.length > 0 && files.every((f) => selectedFiles.has(f.path));
  const someSelected = files.some((f) => selectedFiles.has(f.path));

  return (
    <div className="mb-4">
      {/* Group Header */}
      <div className="flex items-center justify-between px-3 py-2 hover:bg-black-secondary/30 rounded-lg smooth-transition">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <div className="p-0.5">
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4 text-tertiary" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-tertiary" />
            )}
          </div>
          <span className="text-sm font-medium text-secondary">{title}</span>
          <span className="text-xs text-tertiary">({count})</span>
        </button>

        {/* Group Actions */}
        {isExpanded && files.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Select All Checkbox */}
            <button
              onClick={onSelectAll}
              className={`
                p-1 rounded smooth-transition
                ${
                  allSelected
                    ? "bg-accent text-primary"
                    : someSelected
                      ? "bg-accent/50 text-primary"
                      : "glass-button text-tertiary hover:text-primary"
                }
              `}
              aria-label={allSelected ? "Deselect all" : "Select all"}
            >
              <CheckIcon className="w-3.5 h-3.5" />
            </button>

            {/* Bulk Actions */}
            {onStageAll && (
              <button
                onClick={() => handleBulkAction(onStageAll)}
                disabled={isProcessing}
                className="text-xs px-2 py-1 glass-button rounded text-secondary hover:text-primary smooth-transition disabled:opacity-50"
              >
                Stage All
              </button>
            )}
            {onUnstageAll && (
              <button
                onClick={() => handleBulkAction(onUnstageAll)}
                disabled={isProcessing}
                className="text-xs px-2 py-1 glass-button rounded text-secondary hover:text-primary smooth-transition disabled:opacity-50"
              >
                Unstage All
              </button>
            )}
          </div>
        )}
      </div>

      {/* File List */}
      {isExpanded && (
        <div className="mt-1 space-y-0.5">
          {files.map((file) => (
            <FileItem
              key={file.path}
              file={file}
              workingDirectory={workingDirectory}
              isExpanded={expandedFiles.has(file.path)}
              onExpand={() => onFileExpand(file.path)}
              onRefresh={onRefresh}
              isSelected={selectedFiles.has(file.path)}
              onSelect={() => onFileSelect(file.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileItemProps {
  file: GitFile;
  workingDirectory: string;
  isExpanded: boolean;
  onExpand: () => void;
  onRefresh: () => void;
  isSelected: boolean;
  onSelect: () => void;
}

function FileItem({
  file,
  workingDirectory,
  isExpanded,
  onExpand,
  onRefresh,
  isSelected,
  onSelect,
}: FileItemProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleToggleStaging = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);

    try {
      const result = await toggleFileStaging(workingDirectory, file);
      if (result.success) {
        onRefresh();
      } else {
        console.error("Failed to toggle staging:", result.error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg smooth-transition
        hover:bg-black-secondary/50 group cursor-pointer
        ${isSelected ? "bg-accent/10 ring-1 ring-accent/30" : ""}
      `}
      onClick={onExpand}
    >
      {/* Selection Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`
          p-1 rounded smooth-transition flex-shrink-0
          ${
            isSelected
              ? "bg-accent text-primary"
              : "glass-button text-tertiary hover:text-primary opacity-0 group-hover:opacity-100"
          }
        `}
        aria-label={isSelected ? "Deselect file" : "Select file"}
      >
        <CheckIcon className="w-3.5 h-3.5" />
      </button>

      {/* Expand/Collapse Icon */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
        className="p-0.5 hover:bg-black-tertiary/50 rounded smooth-transition flex-shrink-0"
      >
        {isExpanded ? (
          <ChevronDownIcon className="h-3.5 w-3.5 text-tertiary" />
        ) : (
          <ChevronRightIcon className="h-3.5 w-3.5 text-tertiary" />
        )}
      </button>

      {/* File Icon */}
      <span
        className="text-base flex-shrink-0"
        role="img"
        aria-label="File type"
      >
        {getFileIcon(file.path)}
      </span>

      {/* File Path */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-primary truncate">
            {formatFilePath(file.path, 50)}
          </span>
          {file.oldPath && (
            <span className="text-xs text-tertiary">
              ← {formatFilePath(file.oldPath, 30)}
            </span>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <span
        className={`
          px-2 py-0.5 rounded-md text-xs font-bold flex-shrink-0
          ${FILE_STATUS_COLORS[file.status]} ${FILE_STATUS_BG_COLORS[file.status]}
        `}
      >
        {FILE_STATUS_ICONS[file.status]}
      </span>

      {/* Stage/Unstage Button */}
      <button
        onClick={handleToggleStaging}
        disabled={isProcessing}
        className={`
          p-1.5 rounded-lg smooth-transition flex-shrink-0
          opacity-0 group-hover:opacity-100
          ${
            file.staged
              ? "glass-button hover:bg-red-500/20 text-red-400"
              : "glass-button hover:bg-green-500/20 text-green-400"
          }
          ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
        `}
        aria-label={file.staged ? "Unstage file" : "Stage file"}
        title={file.staged ? "Unstage" : "Stage"}
      >
        {file.staged ? (
          <MinusIcon className="w-4 h-4" />
        ) : (
          <PlusIcon className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

export function FileList({
  files,
  workingDirectory,
  expandedFiles,
  onFileExpand,
  onRefresh,
  selectedFiles,
  onFileSelect,
  onSelectAll,
  onDeselectAll,
}: FileListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["staged", "changes", "untracked"]),
  );

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const groupedFiles = groupFilesByStatus(files);

  const handleStageAll = async (filePaths: string[]) => {
    const result = await stageFiles(workingDirectory, filePaths);
    return result.success;
  };

  const handleUnstageAll = async (filePaths: string[]) => {
    const result = await unstageFiles(workingDirectory, filePaths);
    return result.success;
  };

  return (
    <div className="h-full flex flex-col">
      {/* File Count Summary */}
      {files.length > 0 && (
        <div className="px-3 py-2 text-xs text-tertiary flex items-center justify-between border-b border-accent/10">
          <span>{files.length} changed files</span>
          {selectedFiles.size > 0 && (
            <button
              onClick={onDeselectAll}
              className="text-accent hover:text-accent-hover smooth-transition"
            >
              Clear selection ({selectedFiles.size})
            </button>
          )}
        </div>
      )}

      {/* File Groups */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Conflicts (if any) */}
        {groupedFiles.conflicted.length > 0 && (
          <FileGroup
            title="Merge Conflicts"
            files={groupedFiles.conflicted}
            isExpanded={expandedGroups.has("conflicted")}
            onToggle={() => toggleGroup("conflicted")}
            workingDirectory={workingDirectory}
            expandedFiles={expandedFiles}
            onFileExpand={onFileExpand}
            onRefresh={onRefresh}
            selectedFiles={selectedFiles}
            onFileSelect={onFileSelect}
            onSelectAll={() =>
              onSelectAll(groupedFiles.conflicted.map((f) => f.path))
            }
            count={groupedFiles.conflicted.length}
          />
        )}

        {/* Staged Changes */}
        {groupedFiles.staged.length > 0 && (
          <FileGroup
            title="Staged Changes"
            files={groupedFiles.staged}
            isExpanded={expandedGroups.has("staged")}
            onToggle={() => toggleGroup("staged")}
            onUnstageAll={() =>
              handleUnstageAll(groupedFiles.staged.map((f) => f.path))
            }
            workingDirectory={workingDirectory}
            expandedFiles={expandedFiles}
            onFileExpand={onFileExpand}
            onRefresh={onRefresh}
            selectedFiles={selectedFiles}
            onFileSelect={onFileSelect}
            onSelectAll={() =>
              onSelectAll(groupedFiles.staged.map((f) => f.path))
            }
            count={groupedFiles.staged.length}
          />
        )}

        {/* Unstaged Changes */}
        {groupedFiles.unstaged.length > 0 && (
          <FileGroup
            title="Changes"
            files={groupedFiles.unstaged}
            isExpanded={expandedGroups.has("changes")}
            onToggle={() => toggleGroup("changes")}
            onStageAll={() =>
              handleStageAll(groupedFiles.unstaged.map((f) => f.path))
            }
            workingDirectory={workingDirectory}
            expandedFiles={expandedFiles}
            onFileExpand={onFileExpand}
            onRefresh={onRefresh}
            selectedFiles={selectedFiles}
            onFileSelect={onFileSelect}
            onSelectAll={() =>
              onSelectAll(groupedFiles.unstaged.map((f) => f.path))
            }
            count={groupedFiles.unstaged.length}
          />
        )}

        {/* Untracked Files */}
        {groupedFiles.untracked.length > 0 && (
          <FileGroup
            title="Untracked Files"
            files={groupedFiles.untracked}
            isExpanded={expandedGroups.has("untracked")}
            onToggle={() => toggleGroup("untracked")}
            onStageAll={() =>
              handleStageAll(groupedFiles.untracked.map((f) => f.path))
            }
            workingDirectory={workingDirectory}
            expandedFiles={expandedFiles}
            onFileExpand={onFileExpand}
            onRefresh={onRefresh}
            selectedFiles={selectedFiles}
            onFileSelect={onFileSelect}
            onSelectAll={() =>
              onSelectAll(groupedFiles.untracked.map((f) => f.path))
            }
            count={groupedFiles.untracked.length}
          />
        )}

        {/* Empty State */}
        {files.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-tertiary py-8">
            <FolderOpenIcon className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">No changes in your working tree</p>
            <p className="text-xs mt-1">Your branch is up to date</p>
          </div>
        )}
      </div>
    </div>
  );
}
