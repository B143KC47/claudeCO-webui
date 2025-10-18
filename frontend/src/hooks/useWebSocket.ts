/**
 * WebSocket Hook for Real-time Updates
 * Following Linus's principle: "Keep it simple and robust"
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { getBaseApiUrl } from "../services/api";

export interface WebSocketMessage {
  type: string;
  deviceId?: string;
  authToken?: string;
  message?: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  deviceId?: string;
  clientType?: "device" | "desktop";
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket({
  deviceId,
  clientType = "device",
  onMessage,
  onOpen,
  onClose,
  onError,
  autoReconnect = true,
  reconnectInterval = 5000,
}: UseWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const pingInterval = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");

  // Cleanup function
  const cleanup = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = null;
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  // Connect function
  const connect = useCallback(() => {
    cleanup();

    // Build WebSocket URL
    const baseUrl = getBaseApiUrl();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = baseUrl ? new URL(baseUrl).host : window.location.host;

    let wsUrl = `${protocol}//${host}/ws?type=${clientType}`;
    if (deviceId) {
      wsUrl += `&deviceId=${deviceId}`;
    }

    // Enhanced debug logging for WebSocket connection
    console.group("🔌 WebSocket Connection Attempt");
    console.log("Base API URL:", baseUrl);
    console.log("Protocol:", protocol);
    console.log("Host:", host);
    console.log("Client Type:", clientType);
    console.log("Device ID:", deviceId || "none");
    console.log("Full WebSocket URL:", wsUrl);
    console.log("Current Location:", window.location.href);
    console.groupEnd();

    setConnectionState("connecting");

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.group("✅ WebSocket Connected");
        console.log("Device ID:", deviceId || "none");
        console.log("Client Type:", clientType);
        console.log("Ready State:", ws.current?.readyState);
        console.log("URL:", wsUrl);
        console.groupEnd();

        setIsConnected(true);
        setConnectionState("connected");
        onOpen?.();

        // Start ping interval for keepalive
        pingInterval.current = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send("ping");
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.current.onmessage = (event) => {
        try {
          // Handle pong response
          if (event.data === "pong") {
            return;
          }

          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log("WebSocket message received:", message);
          onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.current.onclose = (event) => {
        console.group("🔌 WebSocket Disconnected");
        console.log("Device ID:", deviceId || "none");
        console.log("Close Code:", event.code);
        console.log("Close Reason:", event.reason || "No reason provided");
        console.log("Was Clean:", event.wasClean);
        console.log("Auto-reconnect:", autoReconnect);
        console.groupEnd();

        setIsConnected(false);
        setConnectionState("disconnected");
        onClose?.();

        // Clear ping interval
        if (pingInterval.current) {
          clearInterval(pingInterval.current);
          pingInterval.current = null;
        }

        // Auto-reconnect if enabled
        if (autoReconnect && !reconnectTimeout.current) {
          console.log(
            `🔄 Reconnecting in ${reconnectInterval / 1000} seconds...`,
          );
          reconnectTimeout.current = setTimeout(() => {
            reconnectTimeout.current = null;
            connect();
          }, reconnectInterval);
        }
      };

      ws.current.onerror = (error) => {
        console.group("❌ WebSocket Error");
        console.error("Error Event:", error);
        console.log("Device ID:", deviceId || "none");
        console.log("Client Type:", clientType);
        console.log("WebSocket URL:", wsUrl);
        console.log("Ready State:", ws.current?.readyState);
        console.log("Possible causes:");
        console.log("  - Backend server not running");
        console.log("  - Network connectivity issues");
        console.log("  - Firewall blocking WebSocket connections");
        console.log("  - Mobile device trying to access localhost");
        console.groupEnd();

        setConnectionState("error");
        onError?.(error);
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setConnectionState("error");
    }
  }, [
    deviceId,
    clientType,
    onMessage,
    onOpen,
    onClose,
    onError,
    autoReconnect,
    reconnectInterval,
    cleanup,
  ]);

  // Send message function
  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const data =
        typeof message === "string" ? message : JSON.stringify(message);
      ws.current.send(data);
      return true;
    }
    console.warn("WebSocket not connected, cannot send message");
    return false;
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    // For device type, only connect if we have a deviceId
    // For desktop type, always connect
    const shouldConnect =
      clientType === "desktop" || (clientType === "device" && deviceId);

    if (shouldConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, [connect, cleanup, clientType, deviceId]);

  return {
    isConnected,
    connectionState,
    sendMessage,
    reconnect: connect,
  };
}
