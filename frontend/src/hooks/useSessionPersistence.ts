import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import type { AllMessage } from "../types";
import {
  sessionStorage,
  type SessionMetadata,
} from "../services/sessionStorage";
import { generateId } from "../utils/id";

interface UseSessionPersistenceProps {
  messages: AllMessage[];
  currentSessionId: string | null;
  workingDirectory?: string;
  onSessionIdChange: (sessionId: string) => void;
}

export function useSessionPersistence({
  messages,
  currentSessionId,
  workingDirectory,
  onSessionIdChange,
}: UseSessionPersistenceProps) {
  const location = useLocation();
  const saveTimeoutRef = useRef<number | null>(null);
  const lastSavedMessagesRef = useRef<number>(0);

  // Generate session title from first user message
  const generateSessionTitle = useCallback((messages: AllMessage[]): string => {
    const firstUserMessage = messages.find(
      (m) => m.type === "chat" && m.role === "user",
    );

    if (firstUserMessage && firstUserMessage.type === "chat") {
      const content = firstUserMessage.content;
      // Extract first line or up to 50 characters
      const firstLine = content.split("\n")[0];
      return firstLine.length > 50
        ? firstLine.substring(0, 47) + "..."
        : firstLine;
    }

    return `Session ${new Date().toLocaleString()}`;
  }, []);

  // Create new session (but don't save it until there are messages)
  const createNewSession = useCallback(async (): Promise<string> => {
    const newSessionId = generateId();
    console.log("[Session] Creating new session with ID:", newSessionId);
    // Don't save to storage yet - wait until first message
    return newSessionId;
  }, []);

  // Save current session
  const saveSession = useCallback(async () => {
    if (!currentSessionId || messages.length === 0) return;

    // Don't save if no new messages
    if (messages.length === lastSavedMessagesRef.current) return;

    try {
      const existingSession = await sessionStorage.getSession(currentSessionId);

      const metadata: SessionMetadata = existingSession?.metadata || {
        sessionId: currentSessionId,
        projectPath: workingDirectory || "default",
        title: generateSessionTitle(messages),
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        messageCount: messages.length,
      };

      // Update metadata
      metadata.lastUpdated = Date.now();
      metadata.messageCount = messages.length;

      // Update title if we haven't set it properly yet
      if (!existingSession || metadata.title === "New Session") {
        metadata.title = generateSessionTitle(messages);
      }

      await sessionStorage.saveSession({
        metadata,
        messages,
      });

      lastSavedMessagesRef.current = messages.length;
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  }, [currentSessionId, messages, workingDirectory, generateSessionTitle]);

  // Debounced save
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      saveSession();
    }, 1000); // Save after 1 second of inactivity
  }, [saveSession]);

  // Auto-save when messages change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      debouncedSave();
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, currentSessionId, debouncedSave]);

  // Save immediately when session ID changes or component unmounts
  useEffect(() => {
    return () => {
      if (currentSessionId && messages.length > lastSavedMessagesRef.current) {
        // Save synchronously on unmount
        const session = {
          metadata: {
            sessionId: currentSessionId,
            projectPath: workingDirectory || "default",
            title: generateSessionTitle(messages),
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            messageCount: messages.length,
          },
          messages,
        };

        // Use sendBeacon for reliable save on page unload
        const blob = new Blob([JSON.stringify(session)], {
          type: "application/json",
        });
        navigator.sendBeacon(`/api/sessions/${currentSessionId}/save`, blob);
      }
    };
  }, [currentSessionId, messages, workingDirectory, generateSessionTitle]);

  // Load session from URL params
  const loadSession = useCallback(
    async (sessionId: string): Promise<AllMessage[]> => {
      try {
        const session = await sessionStorage.getSession(sessionId);
        if (session) {
          lastSavedMessagesRef.current = session.messages.length;
          return session.messages;
        }
      } catch (error) {
        console.error("Failed to load session:", error);
      }
      return [];
    },
    [],
  );

  // Initialize session on mount (only load existing, don't create new)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlSessionId = searchParams.get("sessionId");

    if (urlSessionId && !currentSessionId) {
      // Resume existing session
      loadSession(urlSessionId).then((loadedMessages) => {
        if (loadedMessages.length > 0) {
          onSessionIdChange(urlSessionId);
          // Parent component should handle setting messages
        }
      });
    }
    // Don't create new session automatically - wait for first message
  }, [location.search, currentSessionId, onSessionIdChange, loadSession]);

  return {
    saveSession,
    loadSession,
    createNewSession,
  };
}
