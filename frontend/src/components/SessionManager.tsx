import { useState, useEffect, useCallback } from "react";
import {
  ClockIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  TagIcon,
  XMarkIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import type { SessionMetadata } from "../services/sessionStorage";
import { sessionStorage } from "../services/sessionStorage";
import { BUTTON_STYLES } from "../utils/constants";
import { formatDistanceToNow } from "../utils/time";

interface SessionManagerProps {
  currentSessionId: string | null;
  workingDirectory?: string;
  onSessionSelect: (sessionId: string) => void;
  onSessionCreate: () => void;
  onClose: () => void;
}

export function SessionManager({
  currentSessionId,
  workingDirectory,
  onSessionSelect,
  onSessionCreate,
  onClose,
}: SessionManagerProps) {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionMetadata[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedSessions = workingDirectory
        ? await sessionStorage.getSessionsByProject(workingDirectory)
        : await sessionStorage.getAllSessions();
      setSessions(loadedSessions);
      setFilteredSessions(loadedSessions);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [workingDirectory]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Filter sessions based on search and tags
  useEffect(() => {
    let filtered = sessions;

    if (searchQuery) {
      filtered = filtered.filter(
        (session) =>
          session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          session.firstMessage
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          session.lastMessage
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((session) =>
        selectedTags.every((tag) => session.tags?.includes(tag)),
      );
    }

    setFilteredSessions(filtered);
  }, [sessions, searchQuery, selectedTags]);

  // Get all unique tags
  const allTags = Array.from(
    new Set(sessions.flatMap((s) => s.tags || [])),
  ).sort();

  const handleDelete = async (sessionId: string) => {
    if (confirm("Are you sure you want to delete this session?")) {
      try {
        await sessionStorage.deleteSession(sessionId);
        await loadSessions();
      } catch (error) {
        console.error("Failed to delete session:", error);
      }
    }
  };

  const handleExport = async (sessionId: string) => {
    try {
      const data = await sessionStorage.exportSession(sessionId);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `claude-session-${sessionId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export session:", error);
    }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const newSessionId = await sessionStorage.importSession(text);
      await loadSessions();
      onSessionSelect(newSessionId);
    } catch (error) {
      console.error("Failed to import session:", error);
      alert("Failed to import session. Please check the file format.");
    }
  };

  const handleTitleUpdate = async (sessionId: string, newTitle: string) => {
    try {
      await sessionStorage.updateSessionTitle(sessionId, newTitle);
      await loadSessions();
      setEditingSessionId(null);
    } catch (error) {
      console.error("Failed to update title:", error);
    }
  };

  const formatSessionDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return formatDistanceToNow(date);
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-4xl max-h-[80vh] flex flex-col glow-effect">
        {/* Header */}
        <div className="p-6 border-b border-accent/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gradient">Sessions</h2>
            <button onClick={onClose} className={BUTTON_STYLES.ICON_SMALL}>
              <XMarkIcon className="w-6 h-6 text-tertiary hover:text-primary smooth-transition" />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-tertiary" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 glass-input text-primary placeholder-tertiary focus:border-accent/50"
              />
            </div>
            <button onClick={onSessionCreate} className={BUTTON_STYLES.PRIMARY}>
              <PlusIcon className="w-5 h-5 mr-2" />
              New Session
            </button>
          </div>

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setSelectedTags((prev) =>
                      prev.includes(tag)
                        ? prev.filter((t) => t !== tag)
                        : [...prev, tag],
                    )
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium smooth-transition ${
                    selectedTags.includes(tag)
                      ? "bg-gradient-primary text-primary glow-effect"
                      : "glass-button text-secondary hover:text-primary"
                  }`}
                >
                  <TagIcon className="w-3 h-3 inline mr-1" />
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-tertiary">
                {searchQuery || selectedTags.length > 0
                  ? "No sessions match your filters"
                  : "No sessions yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSessions.map((session) => (
                <div
                  key={session.sessionId}
                  className={
                    session.sessionId === currentSessionId
                      ? BUTTON_STYLES.SESSION_ITEM_ACTIVE
                      : BUTTON_STYLES.SESSION_ITEM_INACTIVE
                  }
                  onClick={() => onSessionSelect(session.sessionId)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {editingSessionId === session.sessionId ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() =>
                            handleTitleUpdate(session.sessionId, editingTitle)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleTitleUpdate(
                                session.sessionId,
                                editingTitle,
                              );
                            } else if (e.key === "Escape") {
                              setEditingSessionId(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 glass-input text-primary"
                          autoFocus
                        />
                      ) : (
                        <h3
                          className="font-medium text-primary truncate cursor-text hover:text-accent smooth-transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(session.sessionId);
                            setEditingTitle(session.title);
                          }}
                        >
                          {session.title}
                        </h3>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-xs text-tertiary">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" />
                          {formatSessionDate(session.lastUpdated)}
                        </span>
                        <span>{session.messageCount} messages</span>
                      </div>
                      {session.firstMessage && (
                        <p className="mt-2 text-sm text-secondary line-clamp-2">
                          {session.firstMessage}
                        </p>
                      )}
                      {session.tags && session.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {session.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-black-quaternary rounded-full text-xs text-secondary"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(session.sessionId);
                        }}
                        className={BUTTON_STYLES.ICON_SMALL}
                        title="Export session"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4 text-tertiary hover:text-primary smooth-transition" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(session.sessionId);
                        }}
                        className={BUTTON_STYLES.ICON_SMALL_DANGER}
                        title="Delete session"
                      >
                        <TrashIcon className="w-4 h-4 text-red-400 hover:text-red-300 smooth-transition" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-accent/20 flex justify-between items-center">
          <button
            onClick={() => setShowImportDialog(true)}
            className={BUTTON_STYLES.SECONDARY}
          >
            <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
            Import Session
          </button>
          <div className="text-xs text-tertiary">
            {sessions.length} total sessions
          </div>
        </div>
      </div>

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 max-w-md w-full glow-effect">
            <h3 className="text-lg font-semibold text-primary mb-4">
              Import Session
            </h3>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImport(file);
                  setShowImportDialog(false);
                }
              }}
              className="w-full text-secondary mb-4 glass-input py-2 px-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImportDialog(false)}
                className={BUTTON_STYLES.SECONDARY}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
