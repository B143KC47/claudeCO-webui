import { Context } from "hono";

/**
 * Handles POST /api/sessions/:sessionId/save requests
 * Receives session data from sendBeacon for reliable save on page unload
 * @param c - Hono context object
 * @returns Empty response with 204 status
 */
export async function handleSessionSave(c: Context) {
  try {
    const sessionId = c.req.param("sessionId");
    const sessionData = await c.req.json();

    // Log the save attempt (in production, you might want to persist this)
    console.log(
      `[Session] Saving session ${sessionId} with ${
        sessionData.messages?.length || 0
      } messages`,
    );

    // Since the frontend uses IndexedDB for storage, this endpoint
    // primarily serves as a fallback for sendBeacon on page unload
    // In a production environment, you might want to:
    // 1. Store sessions in a database
    // 2. Implement server-side session recovery
    // 3. Add authentication/authorization

    return c.body(null, 204);
  } catch (error) {
    console.error("Error saving session:", error);
    return c.json({ error: "Failed to save session" }, 500);
  }
}

/**
 * Handles GET /api/sessions/:sessionId requests
 * Retrieves a specific session (placeholder for future server-side storage)
 * @param c - Hono context object
 * @returns JSON response with session data or 404
 */
export async function handleSessionGet(c: Context) {
  try {
    const sessionId = c.req.param("sessionId");

    // This is a placeholder for future server-side session storage
    // Currently, sessions are stored in the browser's IndexedDB
    console.log(`[Session] Request for session ${sessionId}`);

    // Return 404 to indicate client should use local storage
    return c.json({ error: "Session not found on server" }, 404);
  } catch (error) {
    console.error("Error retrieving session:", error);
    return c.json({ error: "Failed to retrieve session" }, 500);
  }
}

/**
 * Handles DELETE /api/sessions/:sessionId requests
 * Deletes a session (placeholder for future server-side storage)
 * @param c - Hono context object
 * @returns Empty response with 204 status
 */
export async function handleSessionDelete(c: Context) {
  try {
    const sessionId = c.req.param("sessionId");

    console.log(`[Session] Deleting session ${sessionId}`);

    // Placeholder for future server-side deletion
    return c.body(null, 204);
  } catch (error) {
    console.error("Error deleting session:", error);
    return c.json({ error: "Failed to delete session" }, 500);
  }
}
