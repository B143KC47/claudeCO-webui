// API configuration - uses relative paths with Vite proxy in development
export const API_CONFIG = {
  ENDPOINTS: {
    CHAT: "/api/chat",
    ABORT: "/api/abort",
    PROJECTS: "/api/projects",
    HISTORIES: "/api/projects",
    CONVERSATIONS: "/api/projects",
    GIT_STATUS: "/api/git/status",
    COMMANDS_DISCOVER: "/api/commands/discover",
  },
} as const;

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return endpoint;
};

// Helper function to get abort URL
export const getAbortUrl = (requestId: string) => {
  return `${API_CONFIG.ENDPOINTS.ABORT}/${requestId}`;
};

// Helper function to get chat URL
export const getChatUrl = () => {
  return API_CONFIG.ENDPOINTS.CHAT;
};

// Helper function to get projects URL
export const getProjectsUrl = () => {
  return API_CONFIG.ENDPOINTS.PROJECTS;
};

// Helper function to get histories URL
export const getHistoriesUrl = (projectPath: string) => {
  const encodedPath = encodeURIComponent(projectPath);
  return `${API_CONFIG.ENDPOINTS.HISTORIES}/${encodedPath}/histories`;
};

// Helper function to get conversation URL
export const getConversationUrl = (projectPath: string, sessionId: string) => {
  const encodedPath = encodeURIComponent(projectPath);
  return `${API_CONFIG.ENDPOINTS.CONVERSATIONS}/${encodedPath}/histories/${sessionId}`;
};

// Helper function to get git status URL
export const getGitStatusUrl = () => {
  return API_CONFIG.ENDPOINTS.GIT_STATUS;
};

// Helper function to get commands discover URL
export const getCommandsDiscoverUrl = () => {
  return API_CONFIG.ENDPOINTS.COMMANDS_DISCOVER;
};
