import { Hono } from "hono";
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import {
  create,
  getNumericDate,
  verify,
} from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { customAlphabet } from "https://deno.land/x/nanoid@v3.0.0/mod.ts";
import {
  generateSessionToken,
  generateVerificationCode,
  getJWTSecret,
  importJWTSecret,
} from "../utils/crypto.ts";
import { broadcastAuthEvent } from "./websocket.ts";
import type {
  AuthorizeDeviceRequest,
  Device,
  DeviceAuthRequest,
  DeviceAuthResponse,
  DeviceListResponse,
  DeviceVerificationRequest,
  QRSession,
  QRSessionResponse,
} from "../../shared/types.ts";

// Initialize SQLite database
const db = new DB("./auth.db");

// Create devices table if it doesn't exist
db.execute(`
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    auth_token TEXT,
    verification_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME,
    approval_status TEXT DEFAULT 'pending'
  )
`);

// Add approval_status column if it doesn't exist (migration)
try {
  db.execute(
    `ALTER TABLE devices ADD COLUMN approval_status TEXT DEFAULT 'pending'`,
  );
} catch {
  // Column already exists
}

// Create nanoid function
const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  21,
);

// Initialize secure JWT secret
const JWT_SECRET_STRING = await getJWTSecret();
const JWT_SECRET = await importJWTSecret(JWT_SECRET_STRING);

// Map to store pending authorizations for real-time updates
export const pendingAuthorizations = new Map<
  string,
  (approved: boolean) => void
>();

// Map to store QR sessions for secure dynamic QR codes
const qrSessions = new Map<string, QRSession>();

// Clean up expired QR sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of qrSessions) {
    if (new Date(session.expiresAt).getTime() < now) {
      qrSessions.delete(token);
    }
  }
}, 60000);

export const authHandler = new Hono()
  // Create QR session for secure dynamic QR codes
  .post("/create-session", async (c) => {
    const sessionToken = generateSessionToken();
    const verificationCode = generateVerificationCode(8); // 8 alphanumeric chars

    const session: QRSession = {
      sessionToken,
      verificationCode,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      used: false,
    };

    qrSessions.set(sessionToken, session);

    const response: QRSessionResponse = {
      sessionToken,
      verificationCode,
      expiresAt: session.expiresAt,
    };

    return c.json(response);
  })
  // Register a new device
  .post("/register", async (c) => {
    const body = await c.req.json<DeviceAuthRequest>();

    // Validate session token if provided
    let verificationCode: string;
    if (body.sessionToken) {
      const session = qrSessions.get(body.sessionToken);

      if (!session) {
        return c.json({ error: "Invalid or expired session token" }, 400);
      }

      if (session.used) {
        return c.json({ error: "Session token already used" }, 400);
      }

      if (new Date(session.expiresAt) < new Date()) {
        qrSessions.delete(body.sessionToken);
        return c.json({ error: "Session token expired" }, 400);
      }

      // Mark session as used and store device ID
      session.used = true;
      verificationCode = session.verificationCode;
    } else {
      // Generate verification code for direct registration (no QR)
      verificationCode = generateVerificationCode(8); // 8 alphanumeric chars
    }

    // Create device record
    const device: Device = {
      id: body.deviceId || nanoid(),
      name: body.deviceName,
      type: body.deviceType,
      status: "pending",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      ipAddress: body.ipAddress || c.req.header("x-forwarded-for") ||
        c.req.header("x-real-ip"),
      userAgent: body.userAgent || c.req.header("user-agent"),
    };

    // Insert device into database
    db.query(
      `INSERT INTO devices (id, name, type, status, verification_code, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        device.id,
        device.name,
        device.type,
        device.status,
        verificationCode,
        device.ipAddress,
        device.userAgent,
      ],
    );

    const response: DeviceAuthResponse = {
      authToken: "", // Will be set after approval
      deviceId: device.id,
      status: "pending",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes for verification
      verificationCode, // Include for mobile display
      sessionToken: body.sessionToken, // Include for tracking
    };

    return c.json(response);
  })
  // Verify device with code (non-blocking)
  .post("/verify", async (c) => {
    const body = await c.req.json<DeviceVerificationRequest>();

    // Check verification code
    const result = db.query(
      "SELECT * FROM devices WHERE id = ? AND verification_code = ? AND status = 'pending'",
      [body.deviceId, body.verificationCode],
    );

    if (result.length === 0) {
      return c.json({ error: "Invalid verification code or device ID" }, 400);
    }

    // Update approval_status to 'waiting' to indicate verification started
    db.query(
      "UPDATE devices SET approval_status = 'waiting' WHERE id = ?",
      [body.deviceId],
    );

    // Return immediate response - mobile will poll /verify-status for approval
    const response: DeviceAuthResponse = {
      authToken: "",
      deviceId: body.deviceId,
      status: "pending",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes timeout
    };

    return c.json(response);
  })
  // Check verification status (for mobile polling)
  .get("/verify-status/:deviceId", async (c) => {
    const deviceId = c.req.param("deviceId");

    // Check device status
    const result = db.query(
      "SELECT status, approval_status, auth_token, expires_at FROM devices WHERE id = ?",
      [deviceId],
    );

    if (result.length === 0) {
      return c.json({ error: "Device not found" }, 404);
    }

    const status = result[0][0] as string;
    const approvalStatus = result[0][1] as string;
    const authToken = result[0][2] as string | null;
    const expiresAt = result[0][3] as string | null;

    // If approved, generate JWT token if not already generated
    if (status === "approved" && !authToken) {
      const payload = {
        deviceId,
        exp: getNumericDate(30 * 24 * 60 * 60), // 30 days
      };

      const token = await create(
        { alg: "HS256", typ: "JWT" },
        payload,
        JWT_SECRET,
      );

      // Update device with token
      db.query(
        "UPDATE devices SET auth_token = ?, expires_at = datetime('now', '+30 days') WHERE id = ?",
        [token, deviceId],
      );

      const response: DeviceAuthResponse = {
        authToken: token,
        deviceId,
        status: "approved",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString(),
      };

      return c.json(response);
    }

    // Return current status
    const response: DeviceAuthResponse = {
      authToken: authToken || "",
      deviceId,
      status: status as "pending" | "approved" | "rejected",
      expiresAt: expiresAt || new Date().toISOString(),
    };

    return c.json(response);
  })
  // Authorize or reject a device (called from web UI)
  .post("/authorize", async (c) => {
    const body = await c.req.json<AuthorizeDeviceRequest>();

    // Update device status in database
    if (body.action === "approve") {
      // Generate JWT token for approved device
      const payload = {
        deviceId: body.deviceId,
        exp: getNumericDate(30 * 24 * 60 * 60), // 30 days
      };

      const token = await create(
        { alg: "HS256", typ: "JWT" },
        payload,
        JWT_SECRET,
      );

      db.query(
        "UPDATE devices SET status = 'approved', approval_status = 'approved', auth_token = ?, expires_at = datetime('now', '+30 days') WHERE id = ?",
        [token, body.deviceId],
      );

      // Broadcast approval with token via WebSocket
      broadcastAuthEvent(body.deviceId, {
        type: "approved",
        deviceId: body.deviceId,
        authToken: token,
      });
    } else {
      db.query(
        "UPDATE devices SET status = 'rejected', approval_status = 'rejected' WHERE id = ?",
        [body.deviceId],
      );

      // Broadcast rejection via WebSocket
      broadcastAuthEvent(body.deviceId, {
        type: "rejected",
        deviceId: body.deviceId,
      });
    }

    // Also resolve in-memory authorization for backward compatibility
    const resolver = pendingAuthorizations.get(body.deviceId);
    if (resolver) {
      resolver(body.action === "approve");
      pendingAuthorizations.delete(body.deviceId);
    }

    return c.json({ success: true });
  })
  // Get list of devices
  .get("/devices", async (c) => {
    const result = db.query(
      "SELECT id, name, type, status, created_at, last_active_at, ip_address, user_agent, verification_code FROM devices ORDER BY created_at DESC",
    );

    const devices = result.map((row) => ({
      id: row[0] as string,
      name: row[1] as string,
      type: row[2] as "mobile" | "tablet" | "desktop",
      status: row[3] as "pending" | "approved" | "rejected",
      createdAt: row[4] as string,
      lastActiveAt: row[5] as string,
      ipAddress: row[6] as string | undefined,
      userAgent: row[7] as string | undefined,
      verificationCode: row[8] as string | undefined,
    }));

    const response = { devices };
    return c.json(response);
  })
  // Revoke device access
  .delete("/devices/:deviceId", async (c) => {
    const deviceId = c.req.param("deviceId");

    db.query(
      "UPDATE devices SET status = 'rejected', auth_token = NULL WHERE id = ?",
      [deviceId],
    );

    return c.json({ success: true });
  })
  // Validate token (middleware helper)
  .post("/validate", async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ valid: false }, 401);
    }

    const token = authHeader.substring(7);

    try {
      const payload = await verify(token, JWT_SECRET);

      // Check if token exists in database and is still valid
      const result = db.query(
        "SELECT * FROM devices WHERE auth_token = ? AND status = 'approved' AND (expires_at IS NULL OR expires_at > datetime('now'))",
        [token],
      );

      if (result.length > 0) {
        // Update last active time
        db.query(
          "UPDATE devices SET last_active_at = CURRENT_TIMESTAMP WHERE auth_token = ?",
          [token],
        );

        return c.json({ valid: true, deviceId: payload.deviceId });
      }
    } catch (error) {
      // Token verification failed
    }

    return c.json({ valid: false }, 401);
  });
