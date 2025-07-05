import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import { useSessionPersistence } from "./useSessionPersistence";
import { sessionStorage } from "../services/sessionStorage";
import type { AllMessage } from "../types";

// Mock sessionStorage service
vi.mock("../services/sessionStorage", () => ({
  sessionStorage: {
    saveSession: vi.fn(),
    getSession: vi.fn(),
    createNewSession: vi.fn(),
  },
}));

// Mock useLocation with configurable return value
let mockLocationSearch = "?sessionId=test-session-123";
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({
      search: mockLocationSearch,
    }),
  };
});

// Mock navigator.sendBeacon
global.navigator.sendBeacon = vi.fn();

describe("useSessionPersistence", () => {
  const mockMessages: AllMessage[] = [
    {
      type: "chat",
      role: "user",
      content: "Hello, Claude!",
      timestamp: Date.now(),
    },
    {
      type: "chat",
      role: "assistant",
      content: "Hello! How can I help you?",
      timestamp: Date.now(),
    },
  ];

  const mockOnSessionIdChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset mock location search to default
    mockLocationSearch = "?sessionId=test-session-123";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );

  it("should save session after debounce period", async () => {
    const { result } = renderHook(
      () =>
        useSessionPersistence({
          messages: mockMessages,
          currentSessionId: "test-session-123",
          workingDirectory: "/test/project",
          onSessionIdChange: mockOnSessionIdChange,
        }),
      { wrapper },
    );

    // Wait for debounce
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(sessionStorage.saveSession).toHaveBeenCalledWith({
        metadata: expect.objectContaining({
          sessionId: "test-session-123",
          projectPath: "/test/project",
          messageCount: 2,
        }),
        messages: mockMessages,
      });
    });
  });

  it("should load session from sessionId", async () => {
    const mockStoredSession = {
      metadata: {
        sessionId: "test-session-123",
        projectPath: "/test/project",
        title: "Test Session",
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        messageCount: 2,
      },
      messages: mockMessages,
    };

    vi.mocked(sessionStorage.getSession).mockResolvedValue(mockStoredSession);

    const { result } = renderHook(
      () =>
        useSessionPersistence({
          messages: [],
          currentSessionId: null,
          workingDirectory: "/test/project",
          onSessionIdChange: mockOnSessionIdChange,
        }),
      { wrapper },
    );

    const loadedMessages = await result.current.loadSession("test-session-123");

    expect(loadedMessages).toEqual(mockMessages);
    expect(sessionStorage.getSession).toHaveBeenCalledWith("test-session-123");
  });

  it("should create new session if none exists", async () => {
    const newSessionId = "new-session-456";

    // Mock empty location search
    mockLocationSearch = "";

    vi.mocked(sessionStorage.saveSession).mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useSessionPersistence({
          messages: [],
          currentSessionId: null,
          workingDirectory: "/test/project",
          onSessionIdChange: mockOnSessionIdChange,
        }),
      { wrapper },
    );

    const createdId = await result.current.createNewSession();

    expect(sessionStorage.saveSession).toHaveBeenCalledWith({
      metadata: expect.objectContaining({
        projectPath: "/test/project",
        title: "New Session",
        messageCount: 0,
      }),
      messages: [],
    });
  });

  it("should generate title from first user message", async () => {
    const messagesWithContent: AllMessage[] = [
      {
        type: "system",
        subtype: "init",
        timestamp: Date.now(),
      } as any,
      {
        type: "chat",
        role: "user",
        content: "How do I implement a binary search tree in Python?",
        timestamp: Date.now(),
      },
    ];

    const { result } = renderHook(
      () =>
        useSessionPersistence({
          messages: messagesWithContent,
          currentSessionId: "test-session-123",
          workingDirectory: "/test/project",
          onSessionIdChange: mockOnSessionIdChange,
        }),
      { wrapper },
    );

    // Wait for debounce
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(sessionStorage.saveSession).toHaveBeenCalledWith({
        metadata: expect.objectContaining({
          title: "How do I implement a binary search tree in Python?",
        }),
        messages: messagesWithContent,
      });
    });
  });

  it("should truncate long titles", async () => {
    const longMessage =
      "This is a very long message that exceeds fifty characters and should be truncated with ellipsis at the end";
    const messagesWithLongContent: AllMessage[] = [
      {
        type: "chat",
        role: "user",
        content: longMessage,
        timestamp: Date.now(),
      },
    ];

    const { result } = renderHook(
      () =>
        useSessionPersistence({
          messages: messagesWithLongContent,
          currentSessionId: "test-session-123",
          workingDirectory: "/test/project",
          onSessionIdChange: mockOnSessionIdChange,
        }),
      { wrapper },
    );

    // Wait for debounce
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(sessionStorage.saveSession).toHaveBeenCalledWith({
        metadata: expect.objectContaining({
          title: "This is a very long message that exceeds fifty...",
        }),
        messages: messagesWithLongContent,
      });
    });
  });

  it("should use sendBeacon on unmount", () => {
    const { unmount } = renderHook(
      () =>
        useSessionPersistence({
          messages: mockMessages,
          currentSessionId: "test-session-123",
          workingDirectory: "/test/project",
          onSessionIdChange: mockOnSessionIdChange,
        }),
      { wrapper },
    );

    unmount();

    expect(global.navigator.sendBeacon).toHaveBeenCalledWith(
      "/api/sessions/test-session-123/save",
      expect.any(Blob),
    );
  });

  it("should not save if no new messages", async () => {
    const { rerender } = renderHook((props) => useSessionPersistence(props), {
      wrapper,
      initialProps: {
        messages: mockMessages,
        currentSessionId: "test-session-123",
        workingDirectory: "/test/project",
        onSessionIdChange: mockOnSessionIdChange,
      },
    });

    // First save
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(sessionStorage.saveSession).toHaveBeenCalledTimes(1);
    });

    // Rerender with same messages
    rerender({
      messages: mockMessages,
      currentSessionId: "test-session-123",
      workingDirectory: "/test/project",
      onSessionIdChange: mockOnSessionIdChange,
    });

    // Wait again
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should not save again
    expect(sessionStorage.saveSession).toHaveBeenCalledTimes(1);
  });
});
