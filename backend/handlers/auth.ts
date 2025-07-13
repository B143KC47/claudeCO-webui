import { Hono } from "hono";
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { customAlphabet } from "https://deno.land/x/nanoid@v3.0.0/mod.ts";
import type {
  DeviceAuthRequest,
  DeviceAuthResponse,
  DeviceVerificationRequest,
  Device,
  DeviceListResponse,
  AuthorizeDeviceRequest,
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
    expires_at DATETIME
  )
`);

// Create nanoid function
const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 21);

// JWT secret - in production, this should be from environment variable
const JWT_SECRET_STRING = Deno.env.get("JWT_SECRET") || "your-secret-key-change-in-production";
const JWT_SECRET = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_SECRET_STRING),
  { name: "HMAC", hash: "SHA-256" },
  true,
  ["sign", "verify"]
);

// Map to store pending authorizations for real-time updates
export const pendingAuthorizations = new Map<string, (approved: boolean) => void>();

export const authHandler = new Hono()
  // Register a new device
  .post("/register", async (c) => {
    const body = await c.req.json<DeviceAuthRequest>();
    
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Create device record
    const device: Device = {
      id: body.deviceId || nanoid(),
      name: body.deviceName,
      type: body.deviceType,
      status: "pending",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      ipAddress: body.ipAddress || c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: body.userAgent || c.req.header("user-agent"),
    };

    // Insert device into database
    db.query(
      `INSERT INTO devices (id, name, type, status, verification_code, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [device.id, device.name, device.type, device.status, verificationCode, device.ipAddress, device.userAgent]
    );

    const response: DeviceAuthResponse = {
      authToken: "", // Will be set after approval
      deviceId: device.id,
      status: "pending",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes for verification
    };

    return c.json(response);
  })

  // Verify device with code
  .post("/verify", async (c) => {
    const body = await c.req.json<DeviceVerificationRequest>();
    
    // Check verification code
    const result = db.query(
      "SELECT * FROM devices WHERE id = ? AND verification_code = ? AND status = 'pending'",
      [body.deviceId, body.verificationCode]
    );

    if (result.length === 0) {
      return c.json({ error: "Invalid verification code or device ID" }, 400);
    }

    // Wait for user approval (this will be resolved by the approve/reject endpoint)
    const approved = await new Promise<boolean>((resolve) => {
      pendingAuthorizations.set(body.deviceId, resolve);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        if (pendingAuthorizations.has(body.deviceId)) {
          pendingAuthorizations.delete(body.deviceId);
          resolve(false);
        }
      }, 5 * 60 * 1000);
    });

    if (approved) {
      // Generate JWT token
      const payload = {
        deviceId: body.deviceId,
        exp: getNumericDate(30 * 24 * 60 * 60), // 30 days
      };
      
      const token = await create({ alg: "HS256", typ: "JWT" }, payload, JWT_SECRET);
      
      // Update device status and token
      db.query(
        "UPDATE devices SET status = 'approved', auth_token = ?, expires_at = datetime('now', '+30 days') WHERE id = ?",
        [token, body.deviceId]
      );

      const response: DeviceAuthResponse = {
        authToken: token,
        deviceId: body.deviceId,
        status: "approved",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      return c.json(response);
    } else {
      // Update device status to rejected
      db.query("UPDATE devices SET status = 'rejected' WHERE id = ?", [body.deviceId]);
      
      const response: DeviceAuthResponse = {
        authToken: "",
        deviceId: body.deviceId,
        status: "rejected",
        expiresAt: new Date().toISOString(),
      };

      return c.json(response);
    }
  })

  // Authorize or reject a device (called from web UI)
  .post("/authorize", async (c) => {
    const body = await c.req.json<AuthorizeDeviceRequest>();
    
    // Resolve pending authorization
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
      "SELECT id, name, type, status, created_at, last_active_at, ip_address, user_agent FROM devices ORDER BY created_at DESC"
    );

    const devices: Device[] = result.map(row => ({
      id: row[0] as string,
      name: row[1] as string,
      type: row[2] as "mobile" | "tablet" | "desktop",
      status: row[3] as "pending" | "approved" | "rejected",
      createdAt: row[4] as string,
      lastActiveAt: row[5] as string,
      ipAddress: row[6] as string | undefined,
      userAgent: row[7] as string | undefined,
    }));

    const response: DeviceListResponse = { devices };
    return c.json(response);
  })

  // Revoke device access
  .delete("/devices/:deviceId", async (c) => {
    const deviceId = c.req.param("deviceId");
    
    db.query("UPDATE devices SET status = 'rejected', auth_token = NULL WHERE id = ?", [deviceId]);
    
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
        [token]
      );

      if (result.length > 0) {
        // Update last active time
        db.query("UPDATE devices SET last_active_at = CURRENT_TIMESTAMP WHERE auth_token = ?", [token]);
        
        return c.json({ valid: true, deviceId: payload.deviceId });
      }
    } catch (error) {
      // Token verification failed
    }

    return c.json({ valid: false }, 401);
  });