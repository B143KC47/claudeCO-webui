import { Context } from "hono";
import {
  BillingFilters,
  DailyUsage,
  MODEL_PRICING,
  ModelUsage,
  MonthlyUsage,
  SessionUsage,
  TimeWindow,
  UsageReport,
} from "../../shared/billingTypes.ts";

/**
 * Get the paths where Claude logs might be stored
 */
function getLogPaths(): string[] {
  const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
  if (!homeDir) return [];

  return [
    `${homeDir}/.claude/logs`,
    `${homeDir}/.config/claude/logs`,
    `${homeDir}/AppData/Roaming/Claude/logs`,
    `${homeDir}/Library/Application Support/Claude/logs`,
  ];
}

interface ConversationLog {
  id: string;
  timestamp: string;
  type: "system" | "assistant" | "result";
  model?: string;
  message?: {
    content?: Array<{ type: string; text?: string }>;
  };
  request?: {
    model?: string;
  };
  totalInputTokens?: number;
  totalOutputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  cost?: number;
  sessionId?: string;
}

/**
 * Handles POST /api/usage requests
 * Analyzes Claude conversation logs to provide detailed usage reports
 * @param c - Hono context object
 * @returns JSON response with usage report data
 */
export async function handleUsageRequest(c: Context) {
  try {
    const filters = await c.req.json<BillingFilters>();
    const report = await generateUsageReport(filters);

    // Check if we found any logs
    if (report.totalTokens === 0 && report.sessions.length === 0) {
      return c.json({
        error: "No Claude conversation logs found",
        details:
          "Usage tracking requires Claude CLI to be installed and used. Logs are typically stored in ~/.claude/logs or similar locations.",
        logPaths: getLogPaths(),
      }, 404);
    }

    return c.json(report);
  } catch (error) {
    console.error("Error generating usage report:", error);
    return c.json({
      error: "Failed to generate usage report",
      details: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
}

async function generateUsageReport(
  filters: BillingFilters,
): Promise<UsageReport> {
  const logs = await readConversationLogs(filters);

  const sessions = groupBySessions(logs);
  const daily = groupByDays(logs, filters);
  const monthly = groupByMonths(daily);

  const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
  const totalTokens = logs.reduce(
    (sum, log) =>
      sum + (log.totalInputTokens || 0) + (log.totalOutputTokens || 0) +
      (log.cacheCreationInputTokens || 0) + (log.cacheReadInputTokens || 0),
    0,
  );

  return {
    daily,
    monthly,
    sessions,
    currentSession: sessions[0],
    totalCost,
    totalTokens,
    lastUpdated: new Date().toISOString(),
  };
}

async function readConversationLogs(
  filters: BillingFilters,
): Promise<ConversationLog[]> {
  const logs: ConversationLog[] = [];
  const logPaths = getLogPaths();
  let foundAnyLogDir = false;

  for (const logPath of logPaths) {
    try {
      const dirStat = await Deno.stat(logPath);
      if (dirStat.isDirectory) {
        foundAnyLogDir = true;
        console.log(`Checking log directory: ${logPath}`);

        const files = [];
        for await (const entry of Deno.readDir(logPath)) {
          if (entry.isFile && entry.name.endsWith(".jsonl")) {
            files.push(`${logPath}/${entry.name}`);
          }
        }

        console.log(`Found ${files.length} log files in ${logPath}`);

        // Process files based on date filters
        for (const file of files) {
          const fileDate = extractDateFromFilename(file);
          if (isWithinDateRange(fileDate, filters)) {
            const fileLogs = await readJSONLFile(file);
            logs.push(...fileLogs);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or isn't accessible
      if (error instanceof Deno.errors.NotFound) {
        console.log(`Log directory not found: ${logPath}`);
      }
    }
  }

  if (!foundAnyLogDir) {
    console.warn("No Claude log directories found. Checked paths:", logPaths);
  }

  console.log(`Total logs read: ${logs.length}`);
  return logs;
}

function extractDateFromFilename(filename: string): string {
  // Extract date from filename pattern like "2024-12-15.jsonl"
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : new Date().toISOString().split("T")[0];
}

function isWithinDateRange(
  date: string,
  filters: BillingFilters,
): boolean {
  if (!filters.startDate && !filters.endDate) return true;

  const dateObj = new Date(date);
  if (filters.startDate && dateObj < new Date(filters.startDate)) return false;
  if (filters.endDate && dateObj > new Date(filters.endDate)) return false;

  return true;
}

async function readJSONLFile(filepath: string): Promise<ConversationLog[]> {
  const logs: ConversationLog[] = [];

  try {
    const content = await Deno.readTextFile(filepath);
    const lines = content.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const log = JSON.parse(line);

        // Calculate cost if not present
        if (!log.cost && log.model) {
          log.cost = calculateCost(log);
        }

        logs.push(log);
      } catch (err) {
        console.error("Error parsing log line:", err);
      }
    }
  } catch (error) {
    console.error("Error reading JSONL file:", error);
  }

  return logs;
}

function calculateCost(log: ConversationLog): number {
  const pricing = MODEL_PRICING[log.model || ""];
  if (!pricing) return 0;

  const inputTokens = (log.totalInputTokens || 0) / 1_000_000;
  const outputTokens = (log.totalOutputTokens || 0) / 1_000_000;
  const cacheCreationTokens = (log.cacheCreationInputTokens || 0) / 1_000_000;
  const cacheReadTokens = (log.cacheReadInputTokens || 0) / 1_000_000;

  return (
    inputTokens * pricing.inputPrice +
    outputTokens * pricing.outputPrice +
    cacheCreationTokens * pricing.cacheCreationPrice +
    cacheReadTokens * pricing.cacheReadPrice
  );
}

function groupBySessions(logs: ConversationLog[]): SessionUsage[] {
  const sessionMap = new Map<string, ConversationLog[]>();

  // Group logs by session
  for (const log of logs) {
    const sessionId = log.sessionId || "unknown";
    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, []);
    }
    sessionMap.get(sessionId)!.push(log);
  }

  // Convert to SessionUsage objects
  const sessions: SessionUsage[] = [];

  for (const [sessionId, sessionLogs] of sessionMap) {
    const modelUsage = aggregateModelUsage(sessionLogs);
    const startTime = sessionLogs[0]?.timestamp || new Date().toISOString();
    const endTime = sessionLogs[sessionLogs.length - 1]?.timestamp || startTime;
    const duration = new Date(endTime).getTime() -
      new Date(startTime).getTime();

    sessions.push({
      sessionId,
      startTime,
      endTime,
      duration,
      messages: sessionLogs.length,
      models: modelUsage,
      totalCost: sessionLogs.reduce((sum, log) => sum + (log.cost || 0), 0),
      totalTokens: sessionLogs.reduce(
        (sum, log) =>
          sum + (log.totalInputTokens || 0) + (log.totalOutputTokens || 0) +
          (log.cacheCreationInputTokens || 0) + (log.cacheReadInputTokens || 0),
        0,
      ),
    });
  }

  // Sort by start time descending
  return sessions.sort((a, b) =>
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
}

function groupByDays(
  logs: ConversationLog[],
  filters: BillingFilters,
): DailyUsage[] {
  const dayMap = new Map<string, ConversationLog[]>();

  // Group logs by day
  for (const log of logs) {
    const date = log.timestamp.split("T")[0];
    if (!dayMap.has(date)) {
      dayMap.set(date, []);
    }
    dayMap.get(date)!.push(log);
  }

  // Convert to DailyUsage objects
  const daily: DailyUsage[] = [];

  for (const [date, dayLogs] of dayMap) {
    const windows = filters.viewMode === "window"
      ? groupByWindows(dayLogs)
      : [];

    const modelUsage = aggregateModelUsage(dayLogs);

    daily.push({
      date,
      windows,
      models: modelUsage,
      totalCost: dayLogs.reduce((sum, log) => sum + (log.cost || 0), 0),
      totalTokens: dayLogs.reduce(
        (sum, log) =>
          sum + (log.totalInputTokens || 0) + (log.totalOutputTokens || 0) +
          (log.cacheCreationInputTokens || 0) + (log.cacheReadInputTokens || 0),
        0,
      ),
      requestCount: dayLogs.length,
    });
  }

  // Sort by date descending
  return daily.sort((a, b) => b.date.localeCompare(a.date));
}

function groupByWindows(logs: ConversationLog[]): TimeWindow[] {
  const windows: TimeWindow[] = [];
  const windowSize = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

  // Sort logs by timestamp
  const sortedLogs = [...logs].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (sortedLogs.length === 0) return windows;

  let windowStart = new Date(sortedLogs[0].timestamp);
  windowStart.setHours(Math.floor(windowStart.getHours() / 5) * 5, 0, 0, 0);

  let currentWindow: ConversationLog[] = [];
  let windowEnd = new Date(windowStart.getTime() + windowSize);

  for (const log of sortedLogs) {
    const logTime = new Date(log.timestamp);

    if (logTime >= windowEnd) {
      // Save current window
      if (currentWindow.length > 0) {
        windows.push(createTimeWindow(windowStart, windowEnd, currentWindow));
      }

      // Start new window
      windowStart = new Date(windowEnd);
      windowEnd = new Date(windowStart.getTime() + windowSize);
      currentWindow = [];
    }

    currentWindow.push(log);
  }

  // Save last window
  if (currentWindow.length > 0) {
    windows.push(createTimeWindow(windowStart, windowEnd, currentWindow));
  }

  return windows;
}

function createTimeWindow(
  start: Date,
  end: Date,
  logs: ConversationLog[],
): TimeWindow {
  const modelUsage = aggregateModelUsage(logs);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    usage: modelUsage,
    totalCost: logs.reduce((sum, log) => sum + (log.cost || 0), 0),
    totalTokens: logs.reduce(
      (sum, log) =>
        sum + (log.totalInputTokens || 0) + (log.totalOutputTokens || 0) +
        (log.cacheCreationInputTokens || 0) + (log.cacheReadInputTokens || 0),
      0,
    ),
  };
}

function groupByMonths(daily: DailyUsage[]): MonthlyUsage[] {
  const monthMap = new Map<string, DailyUsage[]>();

  // Group days by month
  for (const day of daily) {
    const month = day.date.substring(0, 7); // YYYY-MM
    if (!monthMap.has(month)) {
      monthMap.set(month, []);
    }
    monthMap.get(month)!.push(day);
  }

  // Convert to MonthlyUsage objects
  const monthly: MonthlyUsage[] = [];

  for (const [month, days] of monthMap) {
    const allModels: ModelUsage[] = [];
    let totalCost = 0;
    let totalTokens = 0;
    let requestCount = 0;

    for (const day of days) {
      allModels.push(...day.models);
      totalCost += day.totalCost;
      totalTokens += day.totalTokens;
      requestCount += day.requestCount;
    }

    const aggregatedModels = aggregateModelUsageList(allModels);
    const dailyAverage = totalCost / days.length;

    monthly.push({
      month,
      days,
      models: aggregatedModels,
      totalCost,
      totalTokens,
      requestCount,
      dailyAverage,
    });
  }

  // Sort by month descending
  return monthly.sort((a, b) => b.month.localeCompare(a.month));
}

function aggregateModelUsage(logs: ConversationLog[]): ModelUsage[] {
  const modelMap = new Map<string, ModelUsage>();

  for (const log of logs) {
    const model = log.model || log.request?.model || "unknown";

    if (!modelMap.has(model)) {
      modelMap.set(model, {
        model,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        cost: 0,
        requestCount: 0,
      });
    }

    const usage = modelMap.get(model)!;
    usage.inputTokens += log.totalInputTokens || 0;
    usage.outputTokens += log.totalOutputTokens || 0;
    usage.cacheCreationTokens += log.cacheCreationInputTokens || 0;
    usage.cacheReadTokens += log.cacheReadInputTokens || 0;
    usage.cost += log.cost || 0;
    usage.requestCount += 1;
  }

  return Array.from(modelMap.values());
}

function aggregateModelUsageList(models: ModelUsage[]): ModelUsage[] {
  const modelMap = new Map<string, ModelUsage>();

  for (const model of models) {
    if (!modelMap.has(model.model)) {
      modelMap.set(model.model, {
        model: model.model,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        cost: 0,
        requestCount: 0,
      });
    }

    const usage = modelMap.get(model.model)!;
    usage.inputTokens += model.inputTokens;
    usage.outputTokens += model.outputTokens;
    usage.cacheCreationTokens += model.cacheCreationTokens;
    usage.cacheReadTokens += model.cacheReadTokens;
    usage.cost += model.cost;
    usage.requestCount += model.requestCount;
  }

  return Array.from(modelMap.values());
}
