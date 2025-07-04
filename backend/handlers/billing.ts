import { Context } from "hono";

interface UsageData {
  sessionCost: number;
  tokensUsed: number;
  requestsCount: number;
  sessionDuration: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  linesAdded: number;
  linesRemoved: number;
}

interface BillingInfo {
  dailyAverage: number;
  monthlyEstimate: number;
  currentPeriodSpend: number;
  accountInfo?: {
    email?: string;
    organization?: string;
    role?: string;
  };
}

interface BillingResponse {
  usage: UsageData;
  billing: BillingInfo;
  lastUpdated: string;
}

/**
 * Handles GET /api/billing requests
 * Retrieves billing and usage data from Claude Code configuration
 * @param c - Hono context object
 * @returns JSON response with billing and usage data
 */
export async function handleBillingRequest(c: Context) {
  try {
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
    if (!homeDir) {
      return c.json({ error: "HOME environment variable not found" }, 500);
    }

    // Try multiple possible config locations
    const configPaths = [
      `${homeDir}/.claude.json`,
      `${homeDir}/.config/claude/claude.json`,
      `${homeDir}/AppData/Roaming/Claude/claude.json`,
      `${homeDir}/Library/Application Support/Claude/claude.json`,
    ];

    let claudeConfigPath: string | null = null;
    let configContent: string | null = null;

    for (const path of configPaths) {
      try {
        configContent = await Deno.readTextFile(path);
        claudeConfigPath = path;
        break;
      } catch {
        // Continue to next path
      }
    }

    if (!configContent) {
      // Return default values if no config found
      return c.json({
        usage: {
          sessionCost: 0,
          tokensUsed: 0,
          requestsCount: 0,
          sessionDuration: "0min",
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          linesAdded: 0,
          linesRemoved: 0,
        },
        billing: {
          dailyAverage: 0,
          monthlyEstimate: 0,
          currentPeriodSpend: 0,
        },
        lastUpdated: new Date().toISOString(),
      });
    }

    try {
      const config = JSON.parse(configContent!);

      // Find the most recently used project instead of using current working directory
      // Note: We don't use Deno.cwd() because it returns the server process directory,
      // not the user's actual project directory
      let currentProject = "";
      let mostRecentTime = 0;

      // Find the project with the most recent lastUpdated timestamp
      for (
        const [projectPath, projectConfig] of Object.entries(
          config.projects || {},
        )
      ) {
        if (projectConfig && typeof projectConfig === "object") {
          const lastUpdated = (projectConfig as any).lastUpdated;
          if (lastUpdated) {
            const timestamp = new Date(lastUpdated).getTime();
            if (timestamp > mostRecentTime) {
              mostRecentTime = timestamp;
              currentProject = projectPath;
            }
          }
        }
      }

      // Get project-specific data if available
      const projectData = currentProject
        ? config.projects[currentProject]
        : null;

      // Extract usage data from the configuration
      const lastCost = projectData?.lastCost || 0;
      const lastInputTokens = projectData?.lastTotalInputTokens || 0;
      const lastOutputTokens = projectData?.lastTotalOutputTokens || 0;
      const lastCacheCreationTokens =
        projectData?.lastTotalCacheCreationInputTokens || 0;
      const lastCacheReadTokens = projectData?.lastTotalCacheReadInputTokens ||
        0;
      const lastLinesAdded = projectData?.lastLinesAdded || 0;
      const lastLinesRemoved = projectData?.lastLinesRemoved || 0;
      const lastDuration = projectData?.lastDuration || 0;

      // Calculate session duration
      const sessionDurationMs = lastDuration;
      const sessionDurationFormatted = formatDuration(sessionDurationMs);

      // Calculate total tokens used
      const totalTokens = lastInputTokens + lastOutputTokens +
        lastCacheCreationTokens + lastCacheReadTokens;

      // Estimate requests count (rough estimate based on tokens)
      const estimatedRequests = Math.max(1, Math.ceil(totalTokens / 4000));

      const usageData: UsageData = {
        sessionCost: lastCost,
        tokensUsed: totalTokens,
        requestsCount: estimatedRequests,
        sessionDuration: sessionDurationFormatted,
        inputTokens: lastInputTokens,
        outputTokens: lastOutputTokens,
        cacheCreationTokens: lastCacheCreationTokens,
        cacheReadTokens: lastCacheReadTokens,
        linesAdded: lastLinesAdded,
        linesRemoved: lastLinesRemoved,
      };

      // Calculate billing estimates based on actual usage
      // Get all project costs for daily average calculation
      let totalDailyCost = 0;
      let projectCount = 0;

      if (config.projects) {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;

        for (const projectData of Object.values(config.projects)) {
          if (projectData && typeof projectData === "object") {
            const projectCost = (projectData as any).lastCost || 0;
            const lastUpdated = (projectData as any).lastUpdated;

            if (
              lastUpdated && (now - new Date(lastUpdated).getTime()) < dayMs
            ) {
              totalDailyCost += projectCost;
              projectCount++;
            }
          }
        }
      }

      // Calculate daily average from actual usage or use minimum estimate
      const dailyAverage = projectCount > 0
        ? totalDailyCost
        : (lastCost > 0 ? lastCost * 10 : 0);
      const monthlyEstimate = dailyAverage * 30;
      const currentPeriodSpend = lastCost || 0;

      // Extract account information
      const accountInfo = config.oauthAccount
        ? {
          email: config.oauthAccount.emailAddress,
          organization: config.oauthAccount.organizationName,
          role: config.oauthAccount.organizationRole,
        }
        : undefined;

      const billingInfo: BillingInfo = {
        dailyAverage,
        monthlyEstimate,
        currentPeriodSpend,
        accountInfo,
      };

      const response: BillingResponse = {
        usage: usageData,
        billing: billingInfo,
        lastUpdated: new Date().toISOString(),
      };

      return c.json(response);
    } catch (error) {
      console.error("Error parsing config:", error);
      return c.json({
        usage: {
          sessionCost: 0,
          tokensUsed: 0,
          requestsCount: 0,
          sessionDuration: "0min",
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          linesAdded: 0,
          linesRemoved: 0,
        },
        billing: {
          dailyAverage: 0,
          monthlyEstimate: 0,
          currentPeriodSpend: 0,
        },
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error reading billing data:", error);
    return c.json({ error: "Failed to read billing data" }, 500);
  }
}

/**
 * Format duration in milliseconds to human readable format
 */
function formatDuration(durationMs: number): string {
  if (!durationMs || durationMs === 0) return "0min";

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}min ${remainingSeconds}s`
      : `${minutes}min`;
  } else {
    return `${seconds}s`;
  }
}
