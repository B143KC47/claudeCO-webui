import { Context } from "hono";
import {
  convertWindowsPathToWSL,
  convertWSLPathToWindows,
} from "../history/pathUtils.ts";

interface TerminalRequest {
  command: string;
  workingDirectory?: string;
  requestId: string;
  shell?: string;
}

interface TerminalStreamResponse {
  type: "stdout" | "stderr" | "error" | "exit" | "start";
  data?: string;
  exitCode?: number;
  error?: string;
}

interface SystemInfo {
  username: string;
  hostname: string;
  platform: string;
  homeDirectory: string;
  currentWorkingDirectory: string;
  isWSL: boolean;
}

/**
 * Get system information including username, hostname, platform, etc.
 */
async function getSystemInfo(): Promise<SystemInfo> {
  const platform = Deno.build.os;
  let username = "user";
  let hostname = "claude";
  let homeDirectory = "~";
  let currentWorkingDirectory = "~";
  let isWSL = false;

  try {
    // Check if running on WSL first
    if (platform === "linux") {
      try {
        const wslCheck = await new Deno.Command("uname", {
          args: ["-r"],
          stdout: "piped",
          stderr: "piped",
        }).output();

        if (wslCheck.success) {
          const kernelInfo = new TextDecoder().decode(wslCheck.stdout)
            .toLowerCase();
          isWSL = kernelInfo.includes("microsoft") ||
            kernelInfo.includes("wsl");
        }
      } catch {
        // If uname fails, check for WSL environment variables
        isWSL = Boolean(Deno.env.get("WSL_DISTRO_NAME")) ||
          Boolean(Deno.env.get("WSLENV"));
      }
    }

    // Get username with multiple fallbacks
    // Priority order: environment variables, whoami command
    username = Deno.env.get("USER") ||
      Deno.env.get("USERNAME") ||
      Deno.env.get("LOGNAME") ||
      "user";

    // Try whoami as fallback if env vars don't work
    try {
      const userResult = await new Deno.Command("whoami", {
        stdout: "piped",
        stderr: "piped",
      }).output();

      if (userResult.success) {
        const whoamiUser = new TextDecoder().decode(userResult.stdout).trim();
        if (whoamiUser && whoamiUser !== "root" && whoamiUser.length > 0) {
          username = whoamiUser;
        }
      }
    } catch {
      // Keep the environment variable username
    }

    // Get hostname with multiple fallbacks
    hostname = Deno.env.get("HOSTNAME") ||
      Deno.env.get("COMPUTERNAME") ||
      "claude";

    // Try hostname command as fallback
    try {
      const hostnameResult = await new Deno.Command("hostname", {
        stdout: "piped",
        stderr: "piped",
      }).output();

      if (hostnameResult.success) {
        const hostnameValue = new TextDecoder().decode(hostnameResult.stdout)
          .trim();
        if (hostnameValue && hostnameValue.length > 0) {
          hostname = hostnameValue;
        }
      }
    } catch {
      // Keep the environment variable hostname
    }

    // Special handling for WSL environments
    if (isWSL) {
      // In WSL, prioritize Linux environment user info, not Windows
      // Only get Windows hostname if Linux hostname is not available
      const wslHostname = Deno.env.get("COMPUTERNAME");

      // For WSL, we want to keep the Linux username, not get Windows username
      // The username should already be correctly set from environment variables or whoami command above

      // Only update hostname if we don't have a good one from Linux environment
      if (!hostname || hostname === "claude") {
        if (wslHostname) {
          hostname = wslHostname;
        } else {
          // Try to get Windows hostname via PowerShell as fallback only for hostname
          try {
            const psHostResult = await new Deno.Command("powershell.exe", {
              args: ["-Command", "$env:COMPUTERNAME"],
              stdout: "piped",
              stderr: "piped",
            }).output();

            if (psHostResult.success) {
              const psHostname = new TextDecoder().decode(psHostResult.stdout)
                .trim();
              if (psHostname && psHostname.length > 0) {
                hostname = psHostname;
              }
            }
          } catch {
            // PowerShell not available or failed, keep Linux hostname
          }
        }
      }
    }

    // Get current working directory - Deno.cwd() is the most reliable source
    try {
      currentWorkingDirectory = Deno.cwd();
    } catch (e) {
      console.error("Failed to get Deno.cwd(), falling back.", e);
      // Fallback to home directory if cwd is not accessible
      try {
        currentWorkingDirectory = Deno.env.get("HOME") ||
          Deno.env.get("USERPROFILE") || "~";
      } catch {
        currentWorkingDirectory = "~";
      }
    }

    // Get home directory, prioritizing USERPROFILE in WSL for Windows home
    try {
      if (isWSL && Deno.env.get("USERPROFILE")) {
        homeDirectory = Deno.env.get("USERPROFILE")!;
      } else {
        homeDirectory = Deno.env.get("HOME") ||
          Deno.env.get("USERPROFILE") || "~";
      }
    } catch {
      homeDirectory = "~";
    }

    // Convert paths to WSL format if in WSL
    if (isWSL) {
      const originalCwd = currentWorkingDirectory;
      const originalHome = homeDirectory;

      currentWorkingDirectory = convertWindowsPathToWSL(
        currentWorkingDirectory,
      );
      homeDirectory = convertWindowsPathToWSL(homeDirectory);

      // Log conversions if paths changed
      if (originalCwd !== currentWorkingDirectory) {
        console.log("[Terminal Info] Converted current working directory:");
        console.log("  Original:", originalCwd);
        console.log("  WSL Path:", currentWorkingDirectory);
      }

      if (originalHome !== homeDirectory) {
        console.log("[Terminal Info] Converted home directory:");
        console.log("  Original:", originalHome);
        console.log("  WSL Path:", homeDirectory);
      }
    }
  } catch (error) {
    console.error("Error getting system info:", error);
  }

  return {
    username,
    hostname,
    platform,
    homeDirectory,
    currentWorkingDirectory,
    isWSL,
  };
}

/**
 * Translate Windows/macOS paths to WSL paths
 */
function translateToWSLPath(path: string): string {
  // Use the centralized path conversion function
  const convertedPath = convertWindowsPathToWSL(path);

  // Handle special cases for home directory shortcuts
  if (path === "~" || path === "~/") {
    return Deno.env.get("HOME") || "/home/" + (Deno.env.get("USER") || "user");
  }

  // If it starts with ~/, expand it
  if (path.startsWith("~/")) {
    const home = Deno.env.get("HOME") ||
      "/home/" + (Deno.env.get("USER") || "user");
    return home + path.substring(1);
  }

  // Handle macOS-style paths (/Users/...)
  if (path.startsWith("/Users/")) {
    // Convert /Users/username to /home/username for WSL
    const userPart = path.substring(7); // Remove "/Users/"
    const parts = userPart.split("/");
    if (parts.length > 0) {
      return `/home/${parts.join("/")}`;
    }
  }

  return convertedPath;
}

/**
 * Validate and normalize working directory
 */
async function validateWorkingDirectory(
  workingDirectory: string,
  isWSL: boolean,
): Promise<string> {
  try {
    let normalizedPath = workingDirectory;

    // Translate path if on WSL
    if (isWSL) {
      normalizedPath = translateToWSLPath(workingDirectory);
    }

    // Try to stat the directory to see if it exists
    try {
      const stat = await Deno.stat(normalizedPath);
      if (stat.isDirectory) {
        return normalizedPath;
      }
    } catch {
      // Directory doesn't exist, try alternatives
    }

    // If the original directory doesn't exist, try some fallbacks
    const fallbacks = [
      Deno.env.get("HOME") || "/home/" + (Deno.env.get("USER") || "user"),
      "/tmp",
      "/",
    ];

    for (const fallback of fallbacks) {
      try {
        const stat = await Deno.stat(fallback);
        if (stat.isDirectory) {
          return fallback;
        }
      } catch {
        continue;
      }
    }

    // Last resort - return the translated path anyway
    return normalizedPath;
  } catch (error) {
    console.error("Error validating working directory:", error);
    // Return home directory as fallback
    return Deno.env.get("HOME") || "/home/" + (Deno.env.get("USER") || "user");
  }
}

/**
 * Handles GET /api/terminal/info requests
 * Returns system information for the terminal
 */
export async function handleTerminalInfo(c: Context) {
  try {
    const systemInfo = await getSystemInfo();
    return c.json(systemInfo);
  } catch (error) {
    console.error("Error getting terminal info:", error);
    return c.json(
      {
        error: "Failed to get terminal info",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

/**
 * Handles POST /api/terminal/execute requests
 * Executes shell commands with streaming output
 * @param c - Hono context object with config variables
 * @param requestAbortControllers - Map of request IDs to AbortControllers
 * @returns Response with streaming NDJSON
 */
export async function handleTerminalExecute(
  c: Context,
  requestAbortControllers: Map<string, AbortController>,
) {
  const terminalRequest: TerminalRequest = await c.req.json();
  const { debugMode } = c.var.config;

  if (debugMode) {
    console.debug(
      "[DEBUG] Received terminal request:",
      JSON.stringify(terminalRequest, null, 2),
    );
  }

  const { command, workingDirectory, requestId, shell = "bash" } =
    terminalRequest;

  if (!command || !requestId) {
    return c.json({ error: "Command and requestId are required" }, 400);
  }

  const stream = new ReadableStream({
    async start(controller) {
      let abortController: AbortController;

      try {
        // Create and store AbortController for this request
        abortController = new AbortController();
        requestAbortControllers.set(requestId, abortController);

        // Get system info to determine WSL status
        const systemInfo = await getSystemInfo();

        // Send start signal
        const startResponse: TerminalStreamResponse = { type: "start" };
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify(startResponse) + "\n"),
        );

        // Determine the shell command to use
        let shellCmd: string[];
        if (shell === "bash") {
          // Use bash for WSL compatibility
          shellCmd = ["bash", "-c", command];
        } else if (shell === "sh") {
          shellCmd = ["sh", "-c", command];
        } else if (shell === "cmd") {
          // Windows cmd
          shellCmd = ["cmd", "/c", command];
        } else if (shell === "powershell") {
          // Windows PowerShell
          shellCmd = ["powershell", "-c", command];
        } else {
          // Default to bash
          shellCmd = ["bash", "-c", command];
        }

        // Validate and normalize working directory
        let normalizedWorkingDirectory: string | undefined;
        if (workingDirectory) {
          console.log(
            "[Terminal Execute] Original working directory:",
            workingDirectory,
          );
          normalizedWorkingDirectory = await validateWorkingDirectory(
            workingDirectory,
            systemInfo.isWSL,
          );
          if (normalizedWorkingDirectory !== workingDirectory) {
            console.log(
              "[Terminal Execute] Normalized working directory:",
              normalizedWorkingDirectory,
            );
          }
        }

        if (debugMode) {
          console.debug(`[DEBUG] Executing command: ${shellCmd.join(" ")}`);
          console.debug(
            `[DEBUG] Original working directory: ${
              workingDirectory || "current"
            }`,
          );
          console.debug(
            `[DEBUG] Normalized working directory: ${
              normalizedWorkingDirectory || "current"
            }`,
          );
          console.debug(`[DEBUG] Is WSL: ${systemInfo.isWSL}`);
        }

        // Set up command options
        const commandOptions: any = {
          args: shellCmd.slice(1),
          stdout: "piped",
          stderr: "piped",
          signal: abortController.signal,
        };

        // Set working directory if provided and validated
        if (normalizedWorkingDirectory) {
          commandOptions.cwd = normalizedWorkingDirectory;
        }

        // Execute the command
        const process = new Deno.Command(shellCmd[0], commandOptions);
        const child = process.spawn();

        // Handle stdout stream
        if (child.stdout) {
          const stdoutReader = child.stdout.getReader();
          const decoder = new TextDecoder();

          // Read stdout in chunks
          const readStdout = async () => {
            try {
              while (true) {
                const { done, value } = await stdoutReader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const response: TerminalStreamResponse = {
                  type: "stdout",
                  data: text,
                };

                controller.enqueue(
                  new TextEncoder().encode(JSON.stringify(response) + "\n"),
                );

                if (debugMode) {
                  console.debug(`[DEBUG] stdout: ${text.trim()}`);
                }
              }
            } catch (error) {
              if (!abortController.signal.aborted) {
                console.error("Error reading stdout:", error);
              }
            }
          };
          readStdout();
        }

        // Handle stderr stream
        if (child.stderr) {
          const stderrReader = child.stderr.getReader();
          const decoder = new TextDecoder();

          // Read stderr in chunks
          const readStderr = async () => {
            try {
              while (true) {
                const { done, value } = await stderrReader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const response: TerminalStreamResponse = {
                  type: "stderr",
                  data: text,
                };

                controller.enqueue(
                  new TextEncoder().encode(JSON.stringify(response) + "\n"),
                );

                if (debugMode) {
                  console.debug(`[DEBUG] stderr: ${text.trim()}`);
                }
              }
            } catch (error) {
              if (!abortController.signal.aborted) {
                console.error("Error reading stderr:", error);
              }
            }
          };
          readStderr();
        }

        // Wait for command to complete
        const status = await child.status;

        if (debugMode) {
          console.debug(
            `[DEBUG] Command completed with exit code: ${status.code}`,
          );
        }

        // Send exit signal
        const exitResponse: TerminalStreamResponse = {
          type: "exit",
          exitCode: status.code,
        };
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify(exitResponse) + "\n"),
        );
      } catch (error) {
        console.error("Error executing terminal command:", error);

        const errorResponse: TerminalStreamResponse = {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify(errorResponse) + "\n"),
        );
      } finally {
        // Clean up AbortController from map
        if (requestAbortControllers.has(requestId)) {
          requestAbortControllers.delete(requestId);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Handles POST /api/terminal/abort/:requestId requests
 * Aborts an ongoing terminal command by request ID
 * @param c - Hono context object with config variables
 * @param requestAbortControllers - Map of request IDs to AbortControllers
 * @returns JSON response indicating success or failure
 */
export function handleTerminalAbort(
  c: Context,
  requestAbortControllers: Map<string, AbortController>,
) {
  const { debugMode } = c.var.config;
  const requestId = c.req.param("requestId");

  if (!requestId) {
    return c.json({ error: "Request ID is required" }, 400);
  }

  if (debugMode) {
    console.debug(`[DEBUG] Terminal abort attempt for request: ${requestId}`);
    console.debug(
      `[DEBUG] Active terminal requests: ${
        Array.from(requestAbortControllers.keys())
      }`,
    );
  }

  const abortController = requestAbortControllers.get(requestId);
  if (abortController) {
    abortController.abort();
    requestAbortControllers.delete(requestId);

    if (debugMode) {
      console.debug(`[DEBUG] Aborted terminal request: ${requestId}`);
    }

    return c.json({ success: true, message: "Terminal command aborted" });
  } else {
    return c.json(
      { error: "Terminal request not found or already completed" },
      404,
    );
  }
}

/**
 * Handles GET /api/terminal/shells requests
 * Returns available shell options for the current platform
 */
export function handleTerminalShells(c: Context) {
  const platform = Deno.build.os;

  let shells: string[];

  switch (platform) {
    case "windows":
      shells = ["cmd", "powershell", "bash"]; // bash if WSL is available
      break;
    case "linux":
    case "darwin": // macOS
      shells = ["bash", "sh", "zsh", "fish"];
      break;
    default:
      shells = ["bash", "sh"];
  }

  return c.json({
    shells,
    platform,
    default: platform === "windows" ? "cmd" : "bash",
  });
}

/**
 * Handles POST /api/terminal/validate-path requests
 * Validates if a given path exists and is accessible
 */
export async function handlePathValidation(c: Context) {
  try {
    const { path } = await c.req.json();

    if (!path || typeof path !== "string") {
      return c.json(
        {
          isValid: false,
          message: "Path is required",
        },
        400,
      );
    }

    // Validate path format
    if (path.length > 500) {
      return c.json({
        isValid: false,
        message: "Path is too long",
      });
    }

    if (path.trim() === "") {
      return c.json({
        isValid: false,
        message: "Path cannot be empty",
      });
    }

    // Get system info to check if we're in WSL
    const systemInfo = await getSystemInfo();
    let validationPath = path.trim();

    // If we're in a WSL-aware context, we prefer to work with WSL paths.
    if (systemInfo.isWSL) {
      validationPath = convertWindowsPathToWSL(path.trim());
    }

    // If the host is Windows and we're validating a WSL path,
    // shell out to WSL to perform the check, as Deno.stat on Windows
    // can't see WSL-only directories.
    if (Deno.build.os === "windows" && validationPath.startsWith("/mnt/")) {
      try {
        console.log(
          `[Path Validation] On Windows, using WSL to validate path: ${validationPath}`,
        );
        const wslCheck = await new Deno.Command("wsl.exe", {
          args: ["test", "-d", validationPath],
          stdout: "piped",
          stderr: "piped",
        }).output();

        if (wslCheck.code === 0) {
          // Success! The directory exists in WSL.
          return c.json({
            isValid: true,
            message: "Directory exists and is accessible within WSL.",
            normalizedPath: validationPath,
          });
        } else {
          // Directory not found according to WSL.
          const errorOutput = new TextDecoder().decode(wslCheck.stderr);
          return c.json({
            isValid: false,
            message:
              `WSL validation failed: Directory not found at '${validationPath}'. Details: ${errorOutput}`,
          });
        }
      } catch (wslError) {
        // This could happen if wsl.exe is not in PATH
        console.error(
          "Error shelling out to WSL for path validation:",
          wslError,
        );
        return c.json({
          isValid: false,
          message:
            `Failed to execute WSL for validation. Make sure 'wsl.exe' is in your system's PATH. Error: ${
              wslError instanceof Error ? wslError.message : String(wslError)
            }`,
        });
      }
    }

    // Fallback/standard validation for non-WSL paths or non-Windows hosts
    try {
      const pathToStat = Deno.build.os === "windows"
        ? convertWSLPathToWindows(validationPath)
        : validationPath;

      const stat = await Deno.stat(pathToStat);

      if (stat.isDirectory) {
        return c.json({
          isValid: true,
          message: "Directory exists and is accessible",
          normalizedPath: validationPath,
        });
      } else {
        return c.json({
          isValid: false,
          message: "Path exists but is not a directory",
        });
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return c.json({
          isValid: false,
          message: `Directory not found at path: ${validationPath}`,
        });
      } else if (error instanceof Deno.errors.PermissionDenied) {
        return c.json({
          isValid: false,
          message: "Permission denied - cannot access this directory",
        });
      } else {
        return c.json({
          isValid: false,
          message: "Cannot access directory - invalid path or permission issue",
        });
      }
    }
  } catch (error) {
    console.error("Error validating path:", error);
    return c.json({
      isValid: false,
      message: "Failed to validate path",
    }, 500);
  }
}
