import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { sessionStorage, type SessionMetadata, type StoredSession } from "./sessionStorage";
import type { AllMessage } from "../types";

// Mock IndexedDB
const mockDB = {
  transaction: vi.fn(),
  objectStoreNames: {
    contains: vi.fn(() => false)
  }
};

const mockTransaction = {
  objectStore: vi.fn()
};

const mockStore = {
  put: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  delete: vi.fn(),
  createIndex: vi.fn(),
  index: vi.fn(),
  getAllKeys: vi.fn()
};

const mockIndex = {
  getAllKeys: vi.fn()
};

// Setup IndexedDB mocks
global.indexedDB = {
  open: vi.fn(() => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: mockDB,
    error: null
  }))
} as any;

describe("SessionStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.objectStore.mockReturnValue(mockStore);
    mockDB.transaction.mockReturnValue(mockTransaction);
    mockStore.index.mockReturnValue(mockIndex);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("saveSession", () => {
    it("should save a session with updated metadata", async () => {
      const messages: AllMessage[] = [
        {
          type: "chat",
          role: "user",
          content: "Hello, Claude!",
          timestamp: Date.now() - 1000
        },
        {
          type: "chat",
          role: "assistant",
          content: "Hello! How can I help you today?",
          timestamp: Date.now()
        }
      ];

      const session: StoredSession = {
        metadata: {
          sessionId: "test-session-123",
          projectPath: "/test/project",
          title: "Test Session",
          createdAt: Date.now() - 10000,
          lastUpdated: Date.now() - 5000,
          messageCount: 0
        },
        messages
      };

      // Mock successful put operation
      mockStore.put.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      // Execute mock open success
      const openRequest = global.indexedDB.open();
      setTimeout(() => {
        if (openRequest.onsuccess) openRequest.onsuccess(new Event("success"));
      }, 0);

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock put request
      mockStore.put.mockImplementation(() => {
        const request = { onsuccess: null, onerror: null };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess(new Event("success"));
        }, 0);
        return request;
      });

      await sessionStorage.saveSession(session);

      expect(mockStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            sessionId: "test-session-123",
            messageCount: 2,
            firstMessage: "Hello, Claude!",
            lastMessage: "Hello! How can I help you today?"
          })
        })
      );
    });
  });

  describe("getSession", () => {
    it("should retrieve a session by ID", async () => {
      const mockSession: StoredSession = {
        metadata: {
          sessionId: "test-session-123",
          projectPath: "/test/project",
          title: "Test Session",
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          messageCount: 2
        },
        messages: []
      };

      // Mock successful get operation
      mockStore.get.mockImplementation(() => {
        const request = { 
          onsuccess: null, 
          onerror: null,
          result: mockSession
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess(new Event("success"));
        }, 0);
        return request;
      });

      // Execute mock open success
      const openRequest = global.indexedDB.open();
      setTimeout(() => {
        if (openRequest.onsuccess) openRequest.onsuccess(new Event("success"));
      }, 0);

      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await sessionStorage.getSession("test-session-123");

      expect(mockStore.get).toHaveBeenCalledWith("test-session-123");
      expect(result).toEqual(mockSession);
    });

    it("should return null for non-existent session", async () => {
      mockStore.get.mockImplementation(() => {
        const request = { 
          onsuccess: null, 
          onerror: null,
          result: null
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess(new Event("success"));
        }, 0);
        return request;
      });

      const result = await sessionStorage.getSession("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("searchSessions", () => {
    it("should filter sessions by search query", async () => {
      const mockSessions: SessionMetadata[] = [
        {
          sessionId: "1",
          projectPath: "/test",
          title: "Testing Claude API",
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          messageCount: 5,
          firstMessage: "How do I test the Claude API?",
          tags: ["api", "testing"]
        },
        {
          sessionId: "2",
          projectPath: "/test",
          title: "React Component Help",
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          messageCount: 3,
          firstMessage: "Help me build a React component",
          tags: ["react", "frontend"]
        }
      ];

      // Mock getAll for search
      mockStore.getAll.mockImplementation(() => {
        const request = { 
          onsuccess: null, 
          onerror: null,
          result: mockSessions.map(m => ({ metadata: m, messages: [] }))
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess(new Event("success"));
        }, 0);
        return request;
      });

      const results = await sessionStorage.searchSessions("Claude");
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Testing Claude API");
    });

    it("should search by tags", async () => {
      const mockSessions: SessionMetadata[] = [
        {
          sessionId: "1",
          projectPath: "/test",
          title: "Session 1",
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          messageCount: 5,
          tags: ["javascript", "testing"]
        },
        {
          sessionId: "2",
          projectPath: "/test",
          title: "Session 2",
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          messageCount: 3,
          tags: ["python", "api"]
        }
      ];

      mockStore.getAll.mockImplementation(() => {
        const request = { 
          onsuccess: null, 
          onerror: null,
          result: mockSessions.map(m => ({ metadata: m, messages: [] }))
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess(new Event("success"));
        }, 0);
        return request;
      });

      const results = await sessionStorage.searchSessions("javascript");
      
      expect(results).toHaveLength(1);
      expect(results[0].sessionId).toBe("1");
    });
  });

  describe("exportSession", () => {
    it("should export session as JSON string", async () => {
      const mockSession: StoredSession = {
        metadata: {
          sessionId: "export-test",
          projectPath: "/test",
          title: "Export Test",
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          messageCount: 1
        },
        messages: [{
          type: "chat",
          role: "user",
          content: "Test message",
          timestamp: Date.now()
        }]
      };

      mockStore.get.mockImplementation(() => {
        const request = { 
          onsuccess: null, 
          onerror: null,
          result: mockSession
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess(new Event("success"));
        }, 0);
        return request;
      });

      const exported = await sessionStorage.exportSession("export-test");
      const parsed = JSON.parse(exported);

      expect(parsed.metadata.sessionId).toBe("export-test");
      expect(parsed.messages).toHaveLength(1);
    });
  });

  describe("importSession", () => {
    it("should import session with new ID", async () => {
      const sessionToImport = {
        metadata: {
          sessionId: "original-id",
          projectPath: "/test",
          title: "Original Session",
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          messageCount: 1
        },
        messages: []
      };

      mockStore.put.mockImplementation(() => {
        const request = { onsuccess: null, onerror: null };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess(new Event("success"));
        }, 0);
        return request;
      });

      const newId = await sessionStorage.importSession(JSON.stringify(sessionToImport));

      expect(newId).toContain("imported_");
      expect(mockStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            title: "[Imported] Original Session"
          })
        })
      );
    });
  });

  describe("clearOldSessions", () => {
    it("should delete sessions older than specified days", async () => {
      const now = Date.now();
      const oldSession = {
        metadata: {
          sessionId: "old-session",
          projectPath: "/test",
          title: "Old Session",
          createdAt: now - (35 * 24 * 60 * 60 * 1000), // 35 days ago
          lastUpdated: now - (35 * 24 * 60 * 60 * 1000),
          messageCount: 1
        },
        messages: []
      };

      const recentSession = {
        metadata: {
          sessionId: "recent-session",
          projectPath: "/test",
          title: "Recent Session",
          createdAt: now - (5 * 24 * 60 * 60 * 1000), // 5 days ago
          lastUpdated: now - (5 * 24 * 60 * 60 * 1000),
          messageCount: 1
        },
        messages: []
      };

      mockStore.getAll.mockImplementation(() => {
        const request = { 
          onsuccess: null, 
          onerror: null,
          result: [oldSession, recentSession]
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess(new Event("success"));
        }, 0);
        return request;
      });

      mockStore.delete.mockImplementation(() => {
        const request = { onsuccess: null, onerror: null };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess(new Event("success"));
        }, 0);
        return request;
      });

      const deletedCount = await sessionStorage.clearOldSessions(30);

      expect(deletedCount).toBe(1);
      expect(mockStore.delete).toHaveBeenCalledWith("old-session");
      expect(mockStore.delete).not.toHaveBeenCalledWith("recent-session");
    });
  });
});