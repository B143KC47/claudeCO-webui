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
    const homeDir = Deno.env.get("HOME");
    if (!homeDir) {
      return c.json({ error: "HOME environment variable not found" }, 500);
    }

    const claudeConfigPath = `${homeDir}/.claude.json`;

    try {
      // Read Claude configuration file
      const configContent = await Deno.readTextFile(claudeConfigPath);
      const config = JSON.parse(configContent);

      // Get current working directory to find the right project
      const cwd = Deno.cwd();
      let currentProject = "";
      
      // Find the current project in config
      for (const [projectPath, projectConfig] of Object.entries(config.projects || {})) {
        if (cwd.includes(projectPath) || projectPath.includes(cwd)) {
          currentProject = projectPath;
          break;
        }
      }

      // Get project-specific data if available
      const projectData = currentProject ? config.projects[currentProject] : null;
      
      // Extract usage data from the configuration
      const lastCost = projectData?.lastCost || 0;
      const lastInputTokens = projectData?.lastTotalInputTokens || 0;
      const lastOutputTokens = projectData?.lastTotalOutputTokens || 0;
      const lastCacheCreationTokens = projectData?.lastTotalCacheCreationInputTokens || 0;
      const lastCacheReadTokens = projectData?.lastTotalCacheReadInputTokens || 0;
      const lastLinesAdded = projectData?.lastLinesAdded || 0;
      const lastLinesRemoved = projectData?.lastLinesRemoved || 0;
      const lastDuration = projectData?.lastDuration || 0;

      // Calculate session duration
      const sessionDurationMs = lastDuration;
      const sessionDurationFormatted = formatDuration(sessionDurationMs);

      // Calculate total tokens used
      const totalTokens = lastInputTokens + lastOutputTokens + lastCacheCreationTokens + lastCacheReadTokens;

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
        linesRemoved: lastLinesRemoved
      };

      // Calculate billing estimates
      // Average cost per session from research: ~$6/day for developers
      const dailyAverage = 6.0; // USD
      const monthlyEstimate = dailyAverage * 30; // Roughly $180/month

      // Current period spend (estimate based on last cost)
      const currentPeriodSpend = lastCost || 0;

      // Extract account information
      const accountInfo = config.oauthAccount ? {
        email: config.oauthAccount.emailAddress,
        organization: config.oauthAccount.organizationName,
        role: config.oauthAccount.organizationRole
      } : undefined;

      const billingInfo: BillingInfo = {
        dailyAverage,
        monthlyEstimate,
        currentPeriodSpend,
        accountInfo
      };

      const response: BillingResponse = {
        usage: usageData,
        billing: billingInfo,
        lastUpdated: new Date().toISOString()
      };

      return c.json(response);

    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
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
            linesRemoved: 0
          },
          billing: {
            dailyAverage: 6.0,
            monthlyEstimate: 180.0,
            currentPeriodSpend: 0
          },
          lastUpdated: new Date().toISOString()
        });
      }
      throw error;
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
    return remainingSeconds > 0 ? `${minutes}min ${remainingSeconds}s` : `${minutes}min`;
  } else {
    return `${seconds}s`;
  }
} 