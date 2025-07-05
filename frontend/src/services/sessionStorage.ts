import type { AllMessage } from "../types";

const DB_NAME = "ClaudeWebUIDB";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const SESSION_INDEX = "sessionId";
const PROJECT_INDEX = "projectPath";
const TIMESTAMP_INDEX = "lastUpdated";

export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  title: string;
  createdAt: number;
  lastUpdated: number;
  messageCount: number;
  firstMessage?: string;
  lastMessage?: string;
  tags?: string[];
}

export interface StoredSession {
  metadata: SessionMetadata;
  messages: AllMessage[];
}

class SessionStorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create sessions store if it doesn't exist
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const store = db.createObjectStore(SESSIONS_STORE, {
            keyPath: "metadata.sessionId"
          });
          
          // Create indexes for efficient querying
          store.createIndex(SESSION_INDEX, "metadata.sessionId", { unique: true });
          store.createIndex(PROJECT_INDEX, "metadata.projectPath", { unique: false });
          store.createIndex(TIMESTAMP_INDEX, "metadata.lastUpdated", { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error("Failed to initialize database");
    }
    return this.db;
  }

  async saveSession(session: StoredSession): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE], "readwrite");
      const store = transaction.objectStore(SESSIONS_STORE);
      
      // Update metadata
      session.metadata.lastUpdated = Date.now();
      session.metadata.messageCount = session.messages.length;
      
      // Extract first and last message content
      const chatMessages = session.messages.filter(m => m.type === "chat");
      if (chatMessages.length > 0) {
        session.metadata.firstMessage = chatMessages[0].content.slice(0, 100);
        session.metadata.lastMessage = chatMessages[chatMessages.length - 1].content.slice(0, 100);
      }
      
      const request = store.put(session);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE], "readonly");
      const store = transaction.objectStore(SESSIONS_STORE);
      const request = store.get(sessionId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getSessionsByProject(projectPath: string): Promise<SessionMetadata[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE], "readonly");
      const store = transaction.objectStore(SESSIONS_STORE);
      const index = store.index(PROJECT_INDEX);
      const request = index.getAllKeys(projectPath);
      
      request.onsuccess = async () => {
        const sessionIds = request.result;
        const metadata: SessionMetadata[] = [];
        
        for (const sessionId of sessionIds) {
          const session = await this.getSession(sessionId as string);
          if (session) {
            metadata.push(session.metadata);
          }
        }
        
        // Sort by last updated, newest first
        metadata.sort((a, b) => b.lastUpdated - a.lastUpdated);
        resolve(metadata);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSessions(): Promise<SessionMetadata[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE], "readonly");
      const store = transaction.objectStore(SESSIONS_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const sessions: StoredSession[] = request.result;
        const metadata = sessions.map(s => s.metadata);
        
        // Sort by last updated, newest first
        metadata.sort((a, b) => b.lastUpdated - a.lastUpdated);
        resolve(metadata);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSIONS_STORE], "readwrite");
      const store = transaction.objectStore(SESSIONS_STORE);
      const request = store.delete(sessionId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async searchSessions(query: string, projectPath?: string): Promise<SessionMetadata[]> {
    let sessions = projectPath 
      ? await this.getSessionsByProject(projectPath)
      : await this.getAllSessions();
    
    const lowerQuery = query.toLowerCase();
    
    return sessions.filter(session => 
      session.title.toLowerCase().includes(lowerQuery) ||
      session.firstMessage?.toLowerCase().includes(lowerQuery) ||
      session.lastMessage?.toLowerCase().includes(lowerQuery) ||
      session.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    
    session.metadata.title = title;
    await this.saveSession(session);
  }

  async updateSessionTags(sessionId: string, tags: string[]): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    
    session.metadata.tags = tags;
    await this.saveSession(session);
  }

  async exportSession(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    
    return JSON.stringify(session, null, 2);
  }

  async importSession(jsonData: string): Promise<string> {
    const session: StoredSession = JSON.parse(jsonData);
    
    // Generate new session ID to avoid conflicts
    const newSessionId = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    session.metadata.sessionId = newSessionId;
    session.metadata.title = `[Imported] ${session.metadata.title}`;
    
    await this.saveSession(session);
    return newSessionId;
  }

  async clearOldSessions(daysToKeep: number = 30): Promise<number> {
    const sessions = await this.getAllSessions();
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    for (const session of sessions) {
      if (session.lastUpdated < cutoffTime) {
        await this.deleteSession(session.sessionId);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }
}

// Export singleton instance
export const sessionStorage = new SessionStorageService();