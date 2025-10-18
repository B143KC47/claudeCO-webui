/**
 * Cryptographic utilities for secure key management
 * Following Linus's principle: "Don't hide what you're doing"
 * This module generates and manages JWT secrets securely
 */

import { existsSync } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const JWT_SECRET_FILE = ".jwt-secret";
const JWT_SECRET_LENGTH = 64; // 512 bits for HMAC-SHA256

/**
 * Generate a cryptographically secure random string
 * Uses Web Crypto API for true randomness
 */
function generateSecureSecret(length: number = JWT_SECRET_LENGTH): string {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);

  // Convert to base64url for safe storage
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Get or create JWT secret
 * - First check environment variable
 * - Then check secret file
 * - Finally generate new secret if neither exists
 */
export async function getJWTSecret(): Promise<string> {
  // 1. Check environment variable (production deployment)
  const envSecret = Deno.env.get("JWT_SECRET");
  if (envSecret && envSecret !== "your-secret-key-change-in-production") {
    console.log("✓ Using JWT secret from environment variable");
    return envSecret;
  }

  // 2. Check if secret file exists (persistent between restarts)
  const secretPath = join(Deno.cwd(), JWT_SECRET_FILE);

  try {
    if (existsSync(secretPath)) {
      const fileSecret = await Deno.readTextFile(secretPath);
      const trimmedSecret = fileSecret.trim();

      // Validate the secret
      if (trimmedSecret && trimmedSecret.length >= 32) {
        console.log("✓ Loaded JWT secret from file");
        return trimmedSecret;
      }
    }
  } catch (error) {
    console.warn("Could not read JWT secret file:", error);
  }

  // 3. Generate new secret
  console.log("⚠ No JWT secret found, generating new one...");
  const newSecret = generateSecureSecret();

  // Save to file for persistence
  try {
    await Deno.writeTextFile(secretPath, newSecret);
    await Deno.chmod(secretPath, 0o600); // Read/write for owner only
    console.log("✓ Generated and saved new JWT secret");
  } catch (error) {
    console.error("WARNING: Could not save JWT secret to file:", error);
    console.error("Secret will be regenerated on restart!");
  }

  return newSecret;
}

/**
 * Generate secure verification code
 * Uses alphanumeric characters for better entropy
 */
export function generateVerificationCode(length: number = 8): string {
  // Use alphanumeric characters (62 possibilities per character)
  // This gives us 62^8 = 218 trillion possibilities for 8 chars
  const charset =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);

  let code = "";
  for (const byte of buffer) {
    code += charset[byte % charset.length];
  }

  return code;
}

/**
 * Import JWT secret for use with Web Crypto API
 */
export async function importJWTSecret(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
}

/**
 * Generate session token (UUID v4)
 * Uses crypto.randomUUID for guaranteed uniqueness
 */
export function generateSessionToken(): string {
  return crypto.randomUUID();
}

/**
 * Hash a password using PBKDF2 (for future use)
 * Not used currently but good to have for enhanced security
 */
export async function hashPassword(
  password: string,
  salt?: Uint8Array,
): Promise<{ hash: string; salt: string }> {
  const passwordBuffer = new TextEncoder().encode(password);

  // Generate or use provided salt
  const saltBuffer = salt || crypto.getRandomValues(new Uint8Array(16));

  // Import password as key
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    256,
  );

  // Convert to base64
  const hashArray = new Uint8Array(derivedBits);
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  const saltBase64 = btoa(String.fromCharCode(...saltBuffer));

  return {
    hash: hashBase64,
    salt: saltBase64,
  };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
