/**
 * API Service Layer
 * Following Linus's principle: "Make it obvious what's happening"
 *
 * This service handles API endpoint resolution for both development and production,
 * with special handling for mobile devices that may connect directly to the backend
 */

import { API_CONFIG } from "../config/api";

/**
 * Detect if we're running on a mobile device
 */
export function isMobileDevice(): boolean {
  // Check user agent for mobile devices
  const userAgent =
    navigator.userAgent || navigator.vendor || (window as any).opera;
  const isMobile =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent.toLowerCase(),
    );

  // Also check if we're accessing from a non-localhost IP (likely mobile on same network)
  const hostname = window.location.hostname;
  const isRemoteHost = hostname !== "localhost" && hostname !== "127.0.0.1";

  return isMobile || isRemoteHost;
}

/**
 * Check if mobile device is trying to access localhost
 * Throws an error with helpful instructions if detected
 */
export function checkLocalhostAccess(): void {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  // If mobile device is trying to access localhost, show error
  if (isMobileDevice() && isLocalhost) {
    const errorMessage =
      "⚠️ Mobile devices cannot access localhost URLs.\n\n" +
      "Localhost refers to your mobile device itself, not the desktop server.\n\n" +
      "Solution:\n" +
      "1. Go to the desktop Device Management settings\n" +
      "2. Use a LAN URL (192.168.x.x) instead\n" +
      "3. Scan the QR code or copy the LAN URL to your mobile browser";

    // Show error banner
    console.error(errorMessage);

    // Create visible error banner if not already present
    if (!document.getElementById("localhost-error-banner")) {
      const banner = document.createElement("div");
      banner.id = "localhost-error-banner";
      banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #f59e0b;
        color: white;
        padding: 16px;
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      `;
      banner.innerHTML = `
        <strong>⚠️ Connection Error: Localhost Not Accessible</strong><br/>
        <small>Mobile devices cannot access localhost URLs. Please use the LAN URL (192.168.x.x) from the desktop Device Management page instead.</small>
      `;
      document.body.prepend(banner);
    }
  }
}

/**
 * Get the base API URL based on environment and device
 * Mobile devices on the same network need to connect directly to backend
 */
export function getBaseApiUrl(): string {
  // Check for localhost access issues on mobile
  checkLocalhostAccess();

  // In production, always use relative paths (served from same origin)
  if (import.meta.env.PROD) {
    return "";
  }

  // In development, check if we're on mobile or accessing remotely
  if (isMobileDevice()) {
    // Mobile devices need to connect directly to backend
    // Extract the backend host from the current URL
    const hostname = window.location.hostname;
    const backendPort = import.meta.env.VITE_API_PORT || "8080";

    // If accessing from an IP address (like 192.168.x.x), use that
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:${backendPort}`;
    }
  }

  // Default: Use Vite proxy (relative paths)
  return "";
}

/**
 * Construct full API URL with mobile detection
 */
export function getApiEndpoint(endpoint: string): string {
  const baseUrl = getBaseApiUrl();

  // If endpoint already starts with http, return as-is
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  return `${baseUrl}${normalizedEndpoint}`;
}

/**
 * Enhanced fetch with automatic URL resolution and auth token handling
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = getApiEndpoint(endpoint);

  // Add auth token if stored (for mobile devices)
  const authToken = localStorage.getItem("authToken");
  if (authToken) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${authToken}`,
    };
  }

  // Add default headers
  options.headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, options);

    // Handle authentication errors
    if (response.status === 401) {
      // Clear invalid token
      localStorage.removeItem("authToken");

      // If on mobile auth page, don't redirect
      if (!window.location.pathname.includes("/mobile-auth")) {
        // Redirect to mobile auth if needed
        if (isMobileDevice()) {
          window.location.href = "/mobile-auth";
        }
      }
    }

    return response;
  } catch (error) {
    console.error(`API fetch error for ${endpoint}:`, error);
    throw error;
  }
}

/**
 * JSON API helper with automatic URL resolution
 */
export async function apiJson<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(endpoint, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Stream API helper for SSE responses
 */
export async function apiStream(
  endpoint: string,
  options: RequestInit = {},
  onMessage: (data: any) => void,
  onError?: (error: Error) => void,
): Promise<AbortController> {
  const abortController = new AbortController();

  try {
    const response = await apiFetch(endpoint, {
      ...options,
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stream error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    // Read the stream
    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim().startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                onMessage(parsed);
              } catch (e) {
                console.error("Failed to parse SSE message:", e, data);
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name !== "AbortError" && onError) {
          onError(error);
        }
      } finally {
        reader.releaseLock();
      }
    };

    processStream();
  } catch (error: any) {
    if (onError) {
      onError(error);
    }
  }

  return abortController;
}

/**
 * Export specific API methods using the service layer
 */
export const api = {
  // Auth endpoints
  auth: {
    register: (data: any) =>
      apiJson("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    verify: (data: any) =>
      apiJson("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    verifyStatus: (deviceId: string) =>
      apiJson(`/api/auth/verify-status/${deviceId}`),
    devices: () => apiJson("/api/auth/devices"),
    authorize: (data: any) =>
      apiJson("/api/auth/authorize", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // Chat endpoints
  chat: (
    data: any,
    onMessage: (msg: any) => void,
    onError?: (err: Error) => void,
  ) =>
    apiStream(
      "/api/chat",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      onMessage,
      onError,
    ),

  // Network info
  network: {
    info: () => apiJson("/api/network/urls"),
  },

  // Projects
  projects: () => apiJson(API_CONFIG.ENDPOINTS.PROJECTS),

  // Git operations
  git: {
    status: (workingDirectory: string) =>
      apiJson("/api/git/status", {
        method: "POST",
        body: JSON.stringify({ workingDirectory }),
      }),
    // ... other git operations can be added as needed
  },

  // Terminal operations
  terminal: {
    execute: (command: string, workingDirectory: string) =>
      apiStream(
        "/api/terminal/execute",
        {
          method: "POST",
          body: JSON.stringify({ command, workingDirectory }),
        },
        () => {},
        undefined,
      ),
    info: () => apiJson("/api/terminal/info"),
  },
};

/**
 * Initialize API service (check for stored auth token on mobile)
 */
export function initializeApiService(): void {
  // Check if we have a stored auth token (mobile devices)
  const authToken = localStorage.getItem("authToken");

  if (authToken && isMobileDevice()) {
    // Validate the token is still valid
    api.auth.devices().catch(() => {
      // Token invalid, clear it
      localStorage.removeItem("authToken");

      // Redirect to mobile auth if not already there
      if (!window.location.pathname.includes("/mobile-auth")) {
        window.location.href = "/mobile-auth";
      }
    });
  }
}

// Auto-initialize on import
if (typeof window !== "undefined") {
  initializeApiService();
}
