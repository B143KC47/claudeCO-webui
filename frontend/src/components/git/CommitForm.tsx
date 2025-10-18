import { useState, useCallback, useRef, useEffect } from "react";
import {
  CheckIcon,
  XMarkIcon,
  SparklesIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { commitChanges } from "../../actions/git";
import type { GitFile } from "../../../shared/gitTypes";
import {
  generateCommitSuggestions,
  validateCommitMessage,
} from "../../utils/gitHelpers";

interface CommitFormProps {
  workingDirectory: string;
  stagedFiles: GitFile[];
  onCommitSuccess: () => void;
  onError?: (error: string) => void;
}

export function CommitForm({
  workingDirectory,
  stagedFiles,
  onCommitSuccess,
  onError,
}: CommitFormProps) {
  const [message, setMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [validation, setValidation] = useState<ReturnType<
    typeof validateCommitMessage
  > | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  // Validate message on change
  useEffect(() => {
    if (message.trim()) {
      const result = validateCommitMessage(message);
      setValidation(result);
    } else {
      setValidation(null);
    }
  }, [message]);

  const suggestions = generateCommitSuggestions(stagedFiles);

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() || stagedFiles.length === 0 || isCommitting) return;

    setIsCommitting(true);

    try {
      const result = await commitChanges(workingDirectory, message);
      if (result.success) {
        setMessage("");
        setValidation(null);
        onCommitSuccess();
      } else {
        onError?.(result.error);
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to commit");
    } finally {
      setIsCommitting(false);
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (validation?.isValid !== false) {
          handleCommit(e as any);
        }
      }
    },
    [validation, handleCommit],
  );

  const applySuggestion = (suggestion: string) => {
    setMessage(suggestion);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const canCommit =
    stagedFiles.length > 0 && message.trim() && validation?.isValid !== false;

  return (
    <form onSubmit={handleCommit} className="p-4 border-b border-accent/20">
      <div className="space-y-3">
        {/* Commit Message Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="commit-message"
              className="text-sm font-medium text-secondary"
            >
              Commit Message
            </label>
            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="flex items-center gap-1 text-xs glass-button px-2 py-1 rounded-md smooth-transition hover:glow-effect"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-accent" />
                <span className="text-secondary">Suggestions</span>
                <ChevronDownIcon
                  className={`w-3 h-3 text-tertiary transition-transform ${
                    showSuggestions ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="mb-2 p-2 glass-card rounded-lg space-y-1">
              <div className="text-xs text-tertiary mb-1 px-2">
                Click to use:
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-black-secondary/50 smooth-transition text-secondary hover:text-primary"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            id="commit-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Describe your changes...\n\nPress ${
              navigator.platform.includes("Mac") ? "⌘" : "Ctrl"
            }+Enter to commit`}
            className="w-full px-3 py-2 bg-black-secondary text-primary text-sm rounded-lg border border-accent/20 focus:border-accent focus:outline-none resize-none smooth-transition glass-input"
            rows={3}
            disabled={isCommitting}
            aria-invalid={validation?.isValid === false}
            aria-describedby={validation ? "commit-validation" : undefined}
          />

          {/* Validation Messages */}
          {validation && (
            <div id="commit-validation" className="mt-2 space-y-1">
              {validation.errors.map((error, index) => (
                <div
                  key={`error-${index}`}
                  className="flex items-center gap-2 text-xs text-red-400"
                >
                  <XMarkIcon className="w-3 h-3" />
                  <span>{error}</span>
                </div>
              ))}
              {validation.warnings.map((warning, index) => (
                <div
                  key={`warning-${index}`}
                  className="flex items-center gap-2 text-xs text-yellow-400"
                >
                  <ExclamationTriangleIcon className="w-3 h-3" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-tertiary">
            {stagedFiles.length === 0 ? (
              "No files staged for commit"
            ) : (
              <>
                {stagedFiles.length} file{stagedFiles.length === 1 ? "" : "s"}{" "}
                staged
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={!canCommit || isCommitting}
            className={`
              px-4 py-2 rounded-lg font-medium text-sm smooth-transition flex items-center gap-2
              ${
                canCommit && !isCommitting
                  ? "bg-gradient-primary text-primary hover:glow-effect"
                  : "bg-black-tertiary text-tertiary cursor-not-allowed opacity-50"
              }
            `}
          >
            {isCommitting ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
                <span>Committing...</span>
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                <span>Commit</span>
              </>
            )}
          </button>
        </div>

        {/* Character Count */}
        <div className="flex justify-between text-xs text-tertiary">
          <span>{message.split("\n")[0].length}/72 subject</span>
          <span>{message.length} total</span>
        </div>
      </div>
    </form>
  );
}

// Commit History Component
interface CommitHistoryProps {
  commits: Array<{
    hash: string;
    abbreviatedHash: string;
    subject: string;
    author: { name: string; date: string };
  }>;
}

export function CommitHistory({ commits }: CommitHistoryProps) {
  if (commits.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-tertiary">
        No commits yet
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-secondary mb-3">
        Recent Commits
      </h3>
      <div className="space-y-2">
        {commits.slice(0, 5).map((commit) => (
          <div
            key={commit.hash}
            className="p-3 glass-card rounded-lg hover:bg-black-secondary/30 smooth-transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">
                  {commit.subject}
                </p>
                <p className="text-xs text-tertiary mt-1">
                  <span className="font-mono">{commit.abbreviatedHash}</span>
                  {" · "}
                  <span>{commit.author.name}</span>
                  {" · "}
                  <span>
                    {new Date(commit.author.date).toLocaleDateString()}
                  </span>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
