import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/deno";
import { parseCliArgs } from "./args.ts";
import {
  type ConfigContext,
  createConfigMiddleware,
} from "./middleware/config.ts";
import { handleProjectsRequest } from "./handlers/projects.ts";
import { handleHistoriesRequest } from "./handlers/histories.ts";
import { handleConversationRequest } from "./handlers/conversations.ts";
import { handleChatRequest } from "./handlers/chat.ts";
import { handleAbortRequest } from "./handlers/abort.ts";
import { handleMCP } from "./handlers/mcp.ts";
import { handleBillingRequest } from "./handlers/billing.ts";
import { handleUsageRequest } from "./handlers/usage.ts";
import {
  handleGitBranches,
  handleGitCheckout,
  handleGitCommit,
  handleGitDiff,
  handleGitLog,
  handleGitPull,
  handleGitPush,
  handleGitStage,
  handleGitStatus,
  handleGitUnstage,
} from "./handlers/git.ts";
import {
  handlePathValidation,
  handleTerminalAbort,
  handleTerminalExecute,
  handleTerminalInfo,
  handleTerminalShells,
} from "./handlers/terminal.ts";
import { handleFilesList } from "./handlers/files.ts";
import {
  handleSessionDelete,
  handleSessionGet,
  handleSessionSave,
} from "./handlers/sessions.ts";
import { authHandler } from "./handlers/auth.ts";
import { networkHandler } from "./handlers/network.ts";
import { authMiddleware, rateLimitMiddleware, readRateLimitMiddleware } from "./middleware/auth.ts";

const args = await parseCliArgs();

const PORT = args.port;
const HOST = args.host;

// Debug mode enabled via CLI flag or environment variable
const DEBUG_MODE = args.debug;

const app = new Hono<ConfigContext>();

// Store AbortControllers for each request (shared with chat handler)
const requestAbortControllers = new Map<string, AbortController>();

// CORS middleware
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Configuration middleware - makes app settings available to all handlers
app.use("*", createConfigMiddleware({ debugMode: DEBUG_MODE, port: PORT }));

// Apply auth middleware to all routes except auth and network endpoints
app.use("/api/*", authMiddleware);

// Auth API routes (public, with rate limiting)
// Apply different rate limits for read vs write operations
app.get("/api/auth/devices", readRateLimitMiddleware(20, 60000)); // 20 requests per minute for reading devices
app.use("/api/auth/*", rateLimitMiddleware(10, 60000)); // 10 requests per minute for other auth operations
app.route("/api/auth", authHandler);

// Network info routes (public)
app.route("/api/network", networkHandler);

// API routes (protected by auth middleware)
app.get("/api/projects", (c) => handleProjectsRequest(c));

app.get(
  "/api/projects/:encodedProjectName/histories",
  (c) => handleHistoriesRequest(c),
);

app.get(
  "/api/projects/:encodedProjectName/histories/:sessionId",
  (c) => handleConversationRequest(c),
);

app.post(
  "/api/abort/:requestId",
  (c) => handleAbortRequest(c, requestAbortControllers),
);

app.post(
  "/api/chat",
  (c) => handleChatRequest(c, requestAbortControllers),
);

// Settings API routes
app.get("/api/mcp", async (c) => {
  const ctx = { request: c.req.raw };
  const response = await handleMCP(ctx);
  return response;
});

app.get("/api/mcp/categories", async (c) => {
  const ctx = { request: c.req.raw };
  const response = await handleMCP(ctx);
  return response;
});

app.put("/api/mcp/config", async (c) => {
  const ctx = { request: c.req.raw };
  const response = await handleMCP(ctx);
  return response;
});

app.delete("/api/mcp/remove", async (c) => {
  const ctx = { request: c.req.raw };
  const response = await handleMCP(ctx);
  return response;
});

app.get("/api/billing", (c) => handleBillingRequest(c));
app.post("/api/usage", (c) => handleUsageRequest(c));

// Git API routes
app.post("/api/git/status", (c) => handleGitStatus(c));
app.post("/api/git/branches", (c) => handleGitBranches(c));
app.post("/api/git/log", (c) => handleGitLog(c));
app.post("/api/git/diff", (c) => handleGitDiff(c));
app.post("/api/git/stage", (c) => handleGitStage(c));
app.post("/api/git/unstage", (c) => handleGitUnstage(c));
app.post("/api/git/commit", (c) => handleGitCommit(c));
app.post("/api/git/push", (c) => handleGitPush(c));
app.post("/api/git/pull", (c) => handleGitPull(c));
app.post("/api/git/checkout", (c) => handleGitCheckout(c));

// Terminal API routes
app.post(
  "/api/terminal/execute",
  (c) => handleTerminalExecute(c, requestAbortControllers),
);

app.post(
  "/api/terminal/abort/:requestId",
  (c) => handleTerminalAbort(c, requestAbortControllers),
);

app.get("/api/terminal/shells", (c) => handleTerminalShells(c));

app.get("/api/terminal/info", (c) => handleTerminalInfo(c));

app.post("/api/terminal/validate-path", (c) => handlePathValidation(c));

// Files API routes
app.post("/api/files/list", (c) => handleFilesList(c));

// Session API routes
app.post("/api/sessions/:sessionId/save", (c) => handleSessionSave(c));
app.get("/api/sessions/:sessionId", (c) => handleSessionGet(c));
app.delete("/api/sessions/:sessionId", (c) => handleSessionDelete(c));

// Static file serving with SPA fallback
// Resolve dist directory path relative to this module
const distPath = new URL("./dist", import.meta.url).pathname;
// Serve static assets (CSS, JS, images, etc.)
app.use("/assets/*", serveStatic({ root: distPath }));
// Serve root level files (favicon, etc.)
app.use("/*", serveStatic({ root: distPath }));

// SPA fallback - serve index.html for all unmatched routes (except API routes)
app.get("*", async (c) => {
  const path = c.req.path;

  // Skip API routes
  if (path.startsWith("/api/")) {
    return c.text("Not found", 404);
  }

  try {
    const indexPath = new URL("./dist/index.html", import.meta.url).pathname;
    const indexFile = await Deno.readFile(indexPath);
    return c.html(new TextDecoder().decode(indexFile));
  } catch (error) {
    console.error("Error serving index.html:", error);
    return c.text("Internal server error", 500);
  }
});

// Server startup
console.log(`🚀 Server starting on ${HOST}:${PORT}`);

// Validate Claude CLI availability
try {
  const claudeCheck = await new Deno.Command("claude", {
    args: ["--version"],
    stdout: "piped",
    stderr: "piped",
  }).output();

  if (claudeCheck.success) {
    const version = new TextDecoder().decode(claudeCheck.stdout).trim();
    console.log(`✅ Claude CLI found: ${version}`);
  } else {
    console.warn("⚠️  Claude CLI check failed - some features may not work");
  }
} catch (_error) {
  console.warn("⚠️  Claude CLI not found - please install claude-code");
  console.warn(
    "   Visit: https://claude.ai/code for installation instructions",
  );
}

if (DEBUG_MODE) {
  console.log("🐛 Debug mode enabled");
}

Deno.serve({ port: PORT, hostname: HOST }, app.fetch);
