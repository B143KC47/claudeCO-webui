export interface StreamResponse {
  type: "claude_json" | "error" | "done" | "aborted";
  data?: unknown; // SDKMessage object for claude_json type
  error?: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  requestId: string;
  allowedTools?: string[];
  workingDirectory?: string;
  thinking?: {
    type: "enabled";
    budget_tokens: number;
  };
}

export interface AbortRequest {
  requestId: string;
}

export interface ProjectInfo {
  path: string;
  encodedName: string;
}

export interface ProjectsResponse {
  projects: ProjectInfo[];
}

// Conversation history types
export interface ConversationSummary {
  sessionId: string;
  startTime: string;
  lastTime: string;
  messageCount: number;
  lastMessagePreview: string;
}

export interface HistoryListResponse {
  conversations: ConversationSummary[];
}

// Conversation history types
// Note: messages are typed as unknown[] to avoid frontend/backend dependency issues
// Frontend should cast to TimestampedSDKMessage[] (defined in frontend/src/types.ts)
export interface ConversationHistory {
  sessionId: string;
  messages: unknown[]; // TimestampedSDKMessage[] in practice, but avoiding frontend type dependency
  metadata: {
    startTime: string;
    endTime: string;
    messageCount: number;
  };
}

// Device authentication types
export interface DeviceAuthRequest {
  deviceId: string;
  deviceName: string;
  deviceType: "mobile" | "tablet" | "desktop";
  userAgent?: string;
  ipAddress?: string;
}

export interface DeviceAuthResponse {
  authToken: string;
  deviceId: string;
  status: "pending" | "approved" | "rejected";
  expiresAt: string;
}

export interface DeviceVerificationRequest {
  deviceId: string;
  verificationCode: string;
}

export interface Device {
  id: string;
  name: string;
  type: "mobile" | "tablet" | "desktop";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  lastActiveAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DeviceListResponse {
  devices: Device[];
}

export interface AuthorizeDeviceRequest {
  deviceId: string;
  action: "approve" | "reject";
}

