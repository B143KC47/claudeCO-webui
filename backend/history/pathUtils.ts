/**
 * Path utilities for conversation history functionality
 * Handles conversion between project paths and Claude history directory names
 */

/**
 * Get the encoded directory name for a project path by checking what actually exists
 * Example: "/Users/sugyan/tmp/" → "-Users-sugyan-tmp"
 */
export async function getEncodedProjectName(
  projectPath: string,
): Promise<string | null> {
  const homeDir = Deno.env.get("HOME");
  if (!homeDir) {
    return null;
  }

  const projectsDir = `${homeDir}/.claude/projects`;

  try {
    // Read all directories in .claude/projects
    const entries = [];
    for await (const entry of Deno.readDir(projectsDir)) {
      if (entry.isDirectory) {
        entries.push(entry.name);
      }
    }

    // Convert project path to expected encoded format for comparison
    const normalizedPath = projectPath.replace(/\/$/, "");
    // Claude converts both '/' and '.' to '-'
    const expectedEncoded = normalizedPath.replace(/[/.]/g, "-");

    // Find exact match - if not found, return null
    if (entries.includes(expectedEncoded)) {
      return expectedEncoded;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validate that an encoded project name is safe
 */
export function validateEncodedProjectName(encodedName: string): boolean {
  // Should not be empty
  if (!encodedName) {
    return false;
  }

  // Should not contain dangerous characters for directory names
  // deno-lint-ignore no-control-regex
  const dangerousChars = /[<>:"|?*\x00-\x1f\/\\]/;
  if (dangerousChars.test(encodedName)) {
    return false;
  }

  return true;
}

/**
 * Convert Windows path to WSL path format
 * Examples:
 * - C:\Users\username\Desktop -> /mnt/c/Users/username/Desktop
 * - D:\Projects\myapp -> /mnt/d/Projects/myapp
 * - \\wsl$\Ubuntu\home\user -> /home/user
 * - /mnt/c/Users/username -> /mnt/c/Users/username (unchanged)
 */
export function convertWindowsPathToWSL(path: string): string {
  // If already a WSL/Unix path, return as-is
  if (path.startsWith("/")) {
    return path;
  }

  // Handle WSL network path (\\wsl$\distro\...)
  if (path.startsWith("\\\\wsl$\\") || path.startsWith("\\\\wsl.localhost\\")) {
    // Extract the path after the distro name
    const parts = path.split("\\").filter((p) => p);
    if (parts.length > 2) {
      // Skip "wsl$" or "wsl.localhost" and distro name
      const unixPath = "/" + parts.slice(2).join("/");
      return unixPath;
    }
  }

  // Handle Windows drive paths (C:\, D:\, etc.)
  const driveMatch = path.match(/^([A-Za-z]):[\\\/]/);
  if (driveMatch) {
    const driveLetter = driveMatch[1].toLowerCase();
    // Replace backslashes with forward slashes and remove the drive colon
    const remainingPath = path.substring(3).replace(/\\/g, "/");
    return `/mnt/${driveLetter}/${remainingPath}`;
  }

  // Handle UNC paths (\\server\share\...)
  if (path.startsWith("\\\\")) {
    // For now, just replace backslashes
    return path.replace(/\\/g, "/");
  }

  // Fallback: just replace backslashes with forward slashes
  return path.replace(/\\/g, "/");
}

/**
 * Convert WSL path to Windows path format
 * Examples:
 * - /mnt/c/Users/username -> C:\Users\username
 */
export function convertWSLPathToWindows(path: string): string {
  const mntMatch = path.match(/^\/mnt\/([a-z])\/(.*)/i);
  if (mntMatch) {
    const driveLetter = mntMatch[1].toUpperCase();
    const restOfPath = mntMatch[2].replace(/\//g, "\\");
    return `${driveLetter}:\\${restOfPath}`;
  }

  // If it's not a /mnt/ path, it's not a WSL path that can be directly
  // converted to a drive letter path on Windows, so return it as-is.
  return path;
}
