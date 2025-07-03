/**
 * Backend-specific type definitions
 */

// Application configuration shared across backend handlers
export interface AppConfig {
  debugMode: boolean;
  // Future configuration options can be added here
}

// Context interface for MCP handlers
export interface Context {
  request: Request;
}
