/**
 * Security headers middleware
 * Following Linus's principle: "Security should be obvious and direct"
 * Adds essential HTTP security headers to all responses
 */

import { Context, Next } from "hono";

/**
 * Apply security headers to all responses
 * These headers protect against common web vulnerabilities
 */
export async function securityHeaders(c: Context, next: Next) {
  // Process the request first
  await next();

  // Add security headers to the response
  // Only add if not already set to allow override in specific endpoints

  // Prevent clickjacking attacks
  if (!c.res.headers.get("X-Frame-Options")) {
    c.header("X-Frame-Options", "DENY");
  }

  // Prevent MIME type sniffing
  if (!c.res.headers.get("X-Content-Type-Options")) {
    c.header("X-Content-Type-Options", "nosniff");
  }

  // Enable XSS protection in older browsers
  if (!c.res.headers.get("X-XSS-Protection")) {
    c.header("X-XSS-Protection", "1; mode=block");
  }

  // Control referrer information
  if (!c.res.headers.get("Referrer-Policy")) {
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  }

  // Prevent browser features abuse
  if (!c.res.headers.get("Permissions-Policy")) {
    c.header(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()",
    );
  }

  // Content Security Policy - Allow same-origin and WebSocket connections
  if (!c.res.headers.get("Content-Security-Policy")) {
    // In development, allow local network connections for mobile devices
    const isDevelopment = Deno.env.get("DENO_ENV") !== "production";
    const connectSrc = isDevelopment
      ? "'self' ws: wss: http://localhost:* http://127.0.0.1:* http://192.168.*:* http://10.*:*"
      : "'self' ws: wss:";

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for React dev
      "style-src 'self' 'unsafe-inline'", // Required for inline styles
      "img-src 'self' data: blob:", // Allow data URIs and blob URLs for images
      `connect-src ${connectSrc}`, // Allow WebSocket and LAN connections
      "font-src 'self' data:", // Allow font loading
      "object-src 'none'", // Disable plugins
      "base-uri 'self'", // Restrict base tag
      "form-action 'self'", // Restrict form submissions
      "frame-ancestors 'none'", // Same as X-Frame-Options DENY
      "upgrade-insecure-requests", // Upgrade HTTP to HTTPS where possible
    ].join("; ");

    c.header("Content-Security-Policy", csp);
  }

  // HSTS - Only in production with HTTPS
  const isProduction = Deno.env.get("DENO_ENV") === "production";
  const isHTTPS = c.req.header("x-forwarded-proto") === "https" ||
    c.req.url.startsWith("https://");

  if (
    isProduction && isHTTPS && !c.res.headers.get("Strict-Transport-Security")
  ) {
    // 1 year HSTS with subdomains and preload
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
}

/**
 * CORS configuration for API endpoints
 * More restrictive than default CORS for security
 */
export function corsHeaders(
  allowedOrigins: string[] = ["http://localhost:3000"],
) {
  return async (c: Context, next: Next) => {
    const origin = c.req.header("origin");

    // Check if origin is allowed
    if (origin) {
      // Allow localhost variations for development
      const isLocalhost = origin.match(
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/,
      );

      if (isLocalhost || allowedOrigins.includes(origin)) {
        c.header("Access-Control-Allow-Origin", origin);
        c.header("Access-Control-Allow-Credentials", "true");
      }
    }

    // Handle preflight requests
    if (c.req.method === "OPTIONS") {
      c.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      c.header("Access-Control-Max-Age", "86400"); // 24 hours
      return c.body(null, 204);
    }

    await next();
  };
}

/**
 * Request ID middleware for tracking and debugging
 * Adds a unique request ID to each request
 */
export async function requestId(c: Context, next: Next) {
  // Generate or extract request ID
  const reqId = c.req.header("x-request-id") || crypto.randomUUID();

  // Store in context for logging
  c.set("requestId", reqId);

  // Add to response headers
  c.header("X-Request-Id", reqId);

  await next();
}

/**
 * Response time tracking middleware
 * Adds X-Response-Time header for performance monitoring
 */
export async function responseTime(c: Context, next: Next) {
  const start = performance.now();

  await next();

  const duration = performance.now() - start;
  c.header("X-Response-Time", `${duration.toFixed(2)}ms`);
}
