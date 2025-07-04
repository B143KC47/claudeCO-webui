import { Context } from "hono";
import type { ProjectInfo, ProjectsResponse } from "../../shared/types.ts";
import {
  convertWindowsPathToWSL,
  getEncodedProjectName,
} from "../history/pathUtils.ts";

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
    // If uname fails, check for WSL environment variables
    return Boolean(Deno.env.get("WSL_DISTRO_NAME")) ||
      Boolean(Deno.env.get("WSLENV"));
  }

  return false;
}

/**
 * Resolve the actual path for a project, handling WSL path conversion
 */
async function resolveProjectPath(
  path: string,
  isInWSL: boolean,
): Promise<string> {
  // If not in WSL, return as-is
  if (!isInWSL) {
    return path;
  }

  // Convert Windows paths to WSL format
  const convertedPath = convertWindowsPathToWSL(path);

  // Check if the converted path exists
  try {
    await Deno.stat(convertedPath);
    console.log(
      `[Projects] Converted Windows path to WSL: ${path} -> ${convertedPath}`,
    );
    return convertedPath;
  } catch {
    // If converted path doesn't exist, try the original
    try {
      await Deno.stat(path);
      return path;
    } catch {
      // Neither exists, return the converted path for better UX in WSL
      return convertedPath;
    }
  }
}

/**
 * Handles GET /api/projects requests
 * Retrieves list of available project directories from Claude configuration
 * @param c - Hono context object
 * @returns JSON response with projects array
 */
export async function handleProjectsRequest(c: Context) {
  try {
    const homeDir = Deno.env.get("HOME");
    if (!homeDir) {
      return c.json({ error: "HOME environment variable not found" }, 500);
    }

    const claudeConfigPath = `${homeDir}/.claude.json`;
    const inWSL = await isWSL();

    try {
      const configContent = await Deno.readTextFile(claudeConfigPath);
      const config = JSON.parse(configContent);

      if (config.projects && typeof config.projects === "object") {
        const projectPaths = Object.keys(config.projects);

        // Get encoded names for each project, only include projects with history
        const projects: ProjectInfo[] = [];
        for (const path of projectPaths) {
          // Resolve the actual path (especially important for WSL)
          const resolvedPath = await resolveProjectPath(path, inWSL);

          const encodedName = await getEncodedProjectName(path);
          // Only include projects that have history directories
          if (encodedName) {
            projects.push({
              path: resolvedPath, // Use the resolved path
              encodedName,
            });
          }
        }

        const response: ProjectsResponse = { projects };
        return c.json(response);
      } else {
        const response: ProjectsResponse = { projects: [] };
        return c.json(response);
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        const response: ProjectsResponse = { projects: [] };
        return c.json(response);
      }
      throw error;
    }
  } catch (error) {
    console.error("Error reading projects:", error);
    return c.json({ error: "Failed to read projects" }, 500);
  }
}
