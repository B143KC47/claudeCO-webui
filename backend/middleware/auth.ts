import { Context, Next } from "hono";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

// Reuse the same database connection
const db = new DB("./auth.db");

// JWT secret should match the one in auth.ts - in production use environment variable
const JWT_SECRET_STRING = Deno.env.get("JWT_SECRET") || "your-secret-key-change-in-production";
const JWT_SECRET = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_SECRET_STRING),
  { name: "HMAC", hash: "SHA-256" },
  true,
  ["sign", "verify"]
);

export async function authMiddleware(c: Context, next: Next) {
  // Skip auth for certain endpoints
  const path = c.req.path;
  const publicPaths = [
    "/api/auth/register",
    "/api/auth/verify",
    "/api/auth/authorize",
    "/api/auth/devices", // Allow viewing devices without auth for now
    "/api/network-info", // Allow getting network info without auth
  ];
  
  if (publicPaths.some(p => path.startsWith(p))) {
    return next();
  }

  // Check for bearer token
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Check if request is from localhost (web UI)
    const host = c.req.header("host");
    const origin = c.req.header("origin");
    if (host?.includes("localhost") || host?.includes("127.0.0.1") || 
        origin?.includes("localhost") || origin?.includes("127.0.0.1")) {
      return next();
    }
    
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.substring(7);
  
  try {
    // Verify JWT
    const payload = await verify(token, JWT_SECRET);
    
    // Check if token exists in database and is still valid
    const result = db.query(
      "SELECT * FROM devices WHERE auth_token = ? AND status = 'approved' AND (expires_at IS NULL OR expires_at > datetime('now'))",
      [token]
    );

    if (result.length === 0) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    // Update last active time
    db.query("UPDATE devices SET last_active_at = CURRENT_TIMESTAMP WHERE auth_token = ?", [token]);
    
    // Add device info to context
    c.set("deviceId", payload.deviceId);
    c.set("authenticated", true);
    
    return next();
  } catch (error) {
    return c.json({ error: "Invalid token" }, 401);
  }
}

// Rate limiting middleware for auth endpoints
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimitMiddleware(maxRequests: number = 5, windowMs: number = 60000) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const now = Date.now();
    
    const record = rateLimitMap.get(ip);
    
    if (!record || record.resetTime < now) {
      // Create new record or reset existing one
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    } else if (record.count >= maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      c.header("Retry-After", retryAfter.toString());
      return c.json({ error: "Too many requests" }, 429);
    } else {
      // Increment count
      record.count++;
    }
    
    return next();
  };
}

// Separate rate limiter for read-only operations
export function readRateLimitMiddleware(maxRequests: number = 20, windowMs: number = 60000) {
  const readRateLimitMap = new Map<string, { count: number; resetTime: number }>();
  
  return async (c: Context, next: Next) => {
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const now = Date.now();
    const key = `read-${ip}`;
    
    const record = readRateLimitMap.get(key);
    
    if (!record || record.resetTime < now) {
      // Create new record or reset existing one
      readRateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    } else if (record.count >= maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      c.header("Retry-After", retryAfter.toString());
      return c.json({ error: "Too many requests" }, 429);
    } else {
      // Increment count
      record.count++;
    }
    
    return next();
  };
}