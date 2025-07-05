import { Context } from "hono";
import {
  convertWindowsPathToWSL,
  convertWSLPathToWindows,
} from "../history/pathUtils.ts";

interface FileItem {
  name: string;
  type: "file" | "folder";
  path: string;
  size?: number;
  lastModified?: string;
  permissions?: string;
}

interface ListFilesRequest {
  path: string;
}

interface ListFilesResponse {
  files: FileItem[];
  currentPath: string;
  parentPath?: string;
}

/**
 * Check if running in WSL environment
 */
async function isWSL(): Promise<boolean> {
  const platform = Deno.build.os;
  if (platform !== "linux") return false;

  try {
    const wslCheck = await new Deno.Command("uname", {
      args: ["-r"],
      stdout: "piped",
      stderr: "piped",
    }).output();

    if (wslCheck.success) {
      const kernelInfo = new TextDecoder().decode(wslCheck.stdout)
        .toLowerCase();
      return kernelInfo.includes("microsoft") || kernelInfo.includes("wsl");
    }
  } catch {
    return Boolean(Deno.env.get("WSL_DISTRO_NAME")) ||
      Boolean(Deno.env.get("WSLENV"));
  }

  return false;
}

/**
 * Check if we're on Windows and can use WSL commands
 */
async function canUseWSL(): Promise<boolean> {
  const platform = Deno.build.os;
  if (platform !== "windows") return false;

  try {
    // Test if WSL is available by running a simple command
    const wslTest = await new Deno.Command("wsl.exe", {
      args: ["echo", "test"],
      stdout: "piped",
      stderr: "piped",
    }).output();

    return wslTest.code === 0;
  } catch {
    return false;
  }
}

/**
 * Check if a path looks like a WSL path
 */
function isWSLPath(path: string): boolean {
  // WSL paths start with /mnt/ or are standard Unix paths when running inside WSL
  return path.startsWith("/mnt/") ||
    (path.startsWith("/") && !path.startsWith("//"));
}

/**
 * Normalize and validate the path for file operations
 */
async function normalizePath(inputPath: string): Promise<string> {
  let normalizedPath = inputPath.trim();

  console.log(`[Files] Normalizing path: ${inputPath}`);

  // Handle special cases
  if (normalizedPath === "~" || normalizedPath === "") {
    normalizedPath = Deno.env.get("HOME") || "/";
    console.log(`[Files] Expanded home path to: ${normalizedPath}`);
  } else if (normalizedPath.startsWith("~/")) {
    const home = Deno.env.get("HOME") || "/";
    normalizedPath = home + normalizedPath.substring(1);
    console.log(`[Files] Expanded relative home path to: ${normalizedPath}`);
  }

  // Check if we're running inside WSL or if we're on Windows with WSL available
  const inWSL = await isWSL();
  const hasWSL = await canUseWSL();

  console.log(
    `[Files] Environment: inWSL=${inWSL}, hasWSL=${hasWSL}, platform=${Deno.build.os}`,
  );

  // If running inside WSL, convert Windows paths to WSL format
  if (inWSL) {
    normalizedPath = convertWindowsPathToWSL(normalizedPath);
    console.log(`[Files] Converted to WSL path: ${normalizedPath}`);
  }

  // For Windows with WSL, handle WSL paths differently
  if (Deno.build.os === "windows" && hasWSL && isWSLPath(normalizedPath)) {
    // Keep WSL paths as-is for Windows+WSL scenario
    console.log(`[Files] Keeping WSL path for Windows+WSL: ${normalizedPath}`);
    return normalizedPath;
  }

  // Convert to absolute path for local file system operations
  try {
    if (!isWSLPath(normalizedPath) || inWSL) {
      const realPath = await Deno.realPath(normalizedPath);
      console.log(`[Files] Real path resolved to: ${realPath}`);
      normalizedPath = realPath;
    }
  } catch (error) {
    // If realPath fails, use the path as-is
    // This might happen for WSL paths on Windows host
    console.warn(
      `[Files] Failed to resolve real path for ${normalizedPath}:`,
      error,
    );
  }

  console.log(`[Files] Final normalized path: ${normalizedPath}`);
  return normalizedPath;
}

/**
 * Get file/directory information safely
 */
async function getFileInfo(
  fullPath: string,
  name: string,
  relativePath: string,
): Promise<FileItem | null> {
  try {
    const stat = await Deno.stat(fullPath);

    const item: FileItem = {
      name,
      type: stat.isDirectory ? "folder" : "file",
      path: relativePath,
      lastModified: stat.mtime?.toISOString(),
    };

    // Add size for files
    if (stat.isFile) {
      item.size = stat.size;
    }

    // Add basic permissions info
    const mode = stat.mode;
    if (mode !== null) {
      item.permissions = (mode & 0o777).toString(8);
    }

    return item;
  } catch (error) {
    console.warn(`Failed to get info for ${fullPath}:`, error);
    return null;
  }
}

/**
 * List files in a directory with WSL support
 */
async function listDirectory(dirPath: string): Promise<FileItem[]> {
  const files: FileItem[] = [];

  console.log(`[Files] Listing directory: ${dirPath}`);

  try {
    // Check if we can use WSL for this path
    const hasWSL = await canUseWSL();
    const shouldUseWSL = Deno.build.os === "windows" && hasWSL &&
      isWSLPath(dirPath);

    if (shouldUseWSL) {
      console.log(`[Files] Using WSL to list directory: ${dirPath}`);

      try {
        const wslCmd = await new Deno.Command("wsl.exe", {
          args: ["ls", "-la", "--time-style=iso", dirPath],
          stdout: "piped",
          stderr: "piped",
        }).output();

        if (wslCmd.code === 0) {
          const output = new TextDecoder().decode(wslCmd.stdout);
          const lines = output.split("\n").filter((line) => line.trim());

          console.log(`[Files] WSL ls output has ${lines.length} lines`);

          for (const line of lines) {
            // Skip total line and current/parent directory entries
            if (line.startsWith("total") || line.match(/\s+\.+\s*$/)) {
              continue;
            }

            // Parse ls -la output
            const parts = line.split(/\s+/);
            if (parts.length >= 9) {
              const permissions = parts[0];
              const size = parseInt(parts[4]) || 0;
              const date = parts[5] + " " + parts[6];
              const name = parts.slice(8).join(" ");

              // Skip . and .. entries
              if (name === "." || name === "..") {
                continue;
              }

              const isDirectory = permissions.startsWith("d");
              const item: FileItem = {
                name,
                type: isDirectory ? "folder" : "file",
                path: `${dirPath}/${name}`,
                size: isDirectory ? undefined : size,
                lastModified: new Date(date).toISOString(),
                permissions: permissions.slice(1),
              };

              files.push(item);
            }
          }

          console.log(`[Files] WSL listing found ${files.length} items`);

          return files.sort((a, b) => {
            // Folders first, then alphabetical
            if (a.type !== b.type) {
              return a.type === "folder" ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });
        } else {
          const errorOutput = new TextDecoder().decode(wslCmd.stderr);
          console.error(
            `[Files] WSL ls command failed with code ${wslCmd.code}:`,
            errorOutput,
          );
          throw new Error(`WSL directory listing failed: ${errorOutput}`);
        }
      } catch (wslError) {
        console.warn("[Files] Failed to use WSL for listing:", wslError);
        throw wslError; // Don't fall back for WSL paths, as they're not accessible via Deno
      }
    }

    // Standard Deno directory listing for non-WSL paths
    console.log(`[Files] Using Deno to list directory: ${dirPath}`);

    const pathToRead = Deno.build.os === "windows" && isWSLPath(dirPath)
      ? convertWSLPathToWindows(dirPath)
      : dirPath;

    console.log(`[Files] Reading path: ${pathToRead}`);

    for await (const entry of Deno.readDir(pathToRead)) {
      // Skip hidden files starting with . (except current dir)
      if (
        entry.name.startsWith(".") && entry.name !== "." && entry.name !== ".."
      ) {
        continue;
      }

      const fullPath = `${pathToRead}/${entry.name}`;
      const relativePath = `${dirPath}/${entry.name}`;

      const fileInfo = await getFileInfo(fullPath, entry.name, relativePath);
      if (fileInfo) {
        files.push(fileInfo);
      }
    }

    console.log(`[Files] Deno listing found ${files.length} items`);

    return files.sort((a, b) => {
      // Folders first, then alphabetical
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error(`[Files] Failed to list directory ${dirPath}:`, error);
    throw new Error(`Cannot access directory: ${dirPath}`);
  }
}

/**
 * Handles POST /api/files/list requests
 * Lists files and directories in the specified path
 */
export async function handleFilesList(c: Context) {
  try {
    const { debugMode } = c.var.config;
    const request: ListFilesRequest = await c.req.json();

    if (!request.path) {
      return c.json({ error: "Path is required" }, 400);
    }

    if (debugMode) {
      console.debug(`[DEBUG] Listing files for path: ${request.path}`);
    }

    // Normalize and validate the path
    const normalizedPath = await normalizePath(request.path);

    if (debugMode) {
      console.debug(`[DEBUG] Normalized path: ${normalizedPath}`);
    }

    // Check if the path exists and is a directory
    try {
      const hasWSL = await canUseWSL();
      const shouldUseWSL = Deno.build.os === "windows" && hasWSL &&
        isWSLPath(normalizedPath);

      if (shouldUseWSL) {
        console.log(`[Files] Using WSL to validate path: ${normalizedPath}`);

        const wslCheck = await new Deno.Command("wsl.exe", {
          args: ["test", "-d", normalizedPath],
          stdout: "piped",
          stderr: "piped",
        }).output();

        if (wslCheck.code !== 0) {
          const errorOutput = new TextDecoder().decode(wslCheck.stderr);
          console.error(
            `[Files] WSL path validation failed for ${normalizedPath}:`,
            errorOutput,
          );
          return c.json({
            error: `Directory not found: ${request.path}`,
            details:
              `Path ${normalizedPath} does not exist or is not accessible via WSL`,
          }, 404);
        }

        console.log(
          `[Files] WSL path validation successful for: ${normalizedPath}`,
        );
      } else {
        // Use Deno for non-WSL paths
        const pathToCheck =
          Deno.build.os === "windows" && isWSLPath(normalizedPath)
            ? convertWSLPathToWindows(normalizedPath)
            : normalizedPath;

        console.log(`[Files] Using Deno to validate path: ${pathToCheck}`);

        const stat = await Deno.stat(pathToCheck);
        if (!stat.isDirectory) {
          return c.json({
            error: `Path is not a directory: ${request.path}`,
          }, 400);
        }

        console.log(
          `[Files] Deno path validation successful for: ${pathToCheck}`,
        );
      }
    } catch (error) {
      console.error(
        `[Files] Path validation failed for ${normalizedPath}:`,
        error,
      );
      return c.json({
        error: `Cannot access path: ${request.path}`,
        details: error instanceof Error ? error.message : String(error),
      }, 404);
    }

    // List files in the directory
    const files = await listDirectory(normalizedPath);

    // Calculate parent path
    const parentPath = normalizedPath === "/"
      ? undefined
      : normalizedPath.split("/").slice(0, -1).join("/") || "/";

    const response: ListFilesResponse = {
      files,
      currentPath: normalizedPath,
      parentPath,
    };

    if (debugMode) {
      console.debug(`[DEBUG] Found ${files.length} files in ${normalizedPath}`);
    }

    return c.json(response);
  } catch (error) {
    console.error("Error listing files:", error);
    return c.json({
      error: "Failed to list files",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}
