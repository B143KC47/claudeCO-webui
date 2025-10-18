/**
 * WebSocket Handler for Real-time Updates
 * Following Linus's principle: "Make it work first, optimize later"
 *
 * Provides real-time device authorization updates to eliminate polling
 */

import { Context } from "hono";
import { upgradeWebSocket } from "hono/deno";

// Store active WebSocket connections by device ID
const deviceConnections = new Map<string, WebSocket>();

// Store desktop connections that are listening for authorization requests
const desktopConnections = new Set<WebSocket>();

/**
 * Broadcast authorization event to relevant clients
 */
export function broadcastAuthEvent(deviceId: string, event: {
  type: "approved" | "rejected" | "pending";
  deviceId: string;
  authToken?: string;
}) {
  // Send to the specific device
  const deviceWs = deviceConnections.get(deviceId);
  if (deviceWs && deviceWs.readyState === WebSocket.OPEN) {
    deviceWs.send(JSON.stringify(event));
  }

  // Send to all desktop clients
  desktopConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "device-update",
        ...event,
      }));
    }
  });
}

/**
 * WebSocket upgrade handler
 */
export const wsHandler = upgradeWebSocket((c: Context) => {
  const deviceId = c.req.query("deviceId");
  const clientType = c.req.query("type") || "device"; // "device" or "desktop"

  return {
    onOpen: (_event, ws) => {
      console.log(`WebSocket opened: type=${clientType}, deviceId=${deviceId}`);

      if (clientType === "desktop") {
        // Desktop client - add to broadcast list
        desktopConnections.add(ws);
      } else if (deviceId) {
        // Mobile device - track by device ID
        deviceConnections.set(deviceId, ws);
      }

      // Send initial connection success message
      ws.send(JSON.stringify({
        type: "connected",
        message: "WebSocket connection established",
      }));
    },

    onMessage: (event) => {
      // Handle ping/pong for keepalive
      const data = event.data;
      if (data === "ping") {
        const ws = event.target as WebSocket;
        ws.send("pong");
      }
    },

    onClose: (_event, ws) => {
      console.log(`WebSocket closed: type=${clientType}, deviceId=${deviceId}`);

      // Remove from tracking
      if (clientType === "desktop") {
        desktopConnections.delete(ws);
      } else if (deviceId) {
        deviceConnections.delete(deviceId);
      }
    },

    onError: (event) => {
      console.error("WebSocket error:", event);
    },
  };
});
