import { useState, useEffect } from "react";
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ViewColumnsIcon,
  WindowIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { getApiUrl } from "../../config/api";
import {
  ViewMode,
  UsageReport,
  DailyUsage,
  MonthlyUsage,
  SessionUsage,
  ModelUsage,
  BillingFilters,
} from "../../../shared/billingTypes";

export function BillTab() {
  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  useEffect(() => {
    loadUsageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedDate]);

  const loadUsageData = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: BillingFilters = {
        viewMode,
        startDate: getStartDate(),
        endDate: getEndDate(),
      };

      const response = await fetch(getApiUrl("/api/usage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error && errorData.details) {
          throw new Error(`${errorData.error}\n${errorData.details}`);
        }
        throw new Error(`Failed to load usage data: ${response.statusText}`);
      }

      const data = await response.json();
      setUsageReport(data);
    } catch (err) {
      console.error("Error loading usage data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load usage data",
      );
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = () => {
    const date = new Date(selectedDate);
    switch (viewMode) {
      case "daily":
        return selectedDate;
      case "monthly":
        date.setDate(1);
        return date.toISOString().split("T")[0];
      case "session":
        date.setDate(date.getDate() - 7); // Last 7 days
        return date.toISOString().split("T")[0];
      case "window":
        date.setDate(date.getDate() - 1); // Last 24 hours
        return date.toISOString().split("T")[0];
      default:
        return selectedDate;
    }
  };

  const getEndDate = () => {
    const date = new Date(selectedDate);
    switch (viewMode) {
      case "monthly":
        date.setMonth(date.getMonth() + 1);
        date.setDate(0); // Last day of month
        return date.toISOString().split("T")[0];
      default:
        return selectedDate;
    }
  };

  const handleRefresh = () => {
    loadUsageData();
  };

  const handleExport = () => {
    if (!usageReport) return;

    const dataStr = JSON.stringify(usageReport, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileName = `claude-usage-${viewMode}-${selectedDate}.json`;
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileName);
    linkElement.click();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const viewModes = [
    { id: "daily" as ViewMode, name: "Daily", icon: CalendarDaysIcon },
    { id: "monthly" as ViewMode, name: "Monthly", icon: CalendarIcon },
    { id: "session" as ViewMode, name: "Sessions", icon: ViewColumnsIcon },
    { id: "window" as ViewMode, name: "5h Windows", icon: WindowIcon },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="ml-3 text-gray-300">Loading usage data...</span>
      </div>
    );
  }

  if (error) {
    const errorLines = error.split("\n");
    const isNoLogsError = error.includes("No Claude conversation logs found");

    return (
      <div className="space-y-6">
        <div className="glass-card p-6 border border-red-500/20">
          <div className="flex items-center space-x-3 mb-4">
            <CurrencyDollarIcon className="h-6 w-6 text-red-500" />
            <h3 className="text-lg font-semibold text-primary">
              {isNoLogsError
                ? "Claude Logs Not Found"
                : "Error Loading Usage Data"}
            </h3>
          </div>
          <div className="space-y-2 mb-4">
            {errorLines.map((line, index) => (
              <p key={index} className="text-red-400">
                {line}
              </p>
            ))}
          </div>

          {isNoLogsError && (
            <div className="border border-gray-700/30 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-primary mb-2">
                How to Enable Usage Tracking
              </h4>
              <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                <li>
                  Install Claude CLI:{" "}
                  <code className="bg-gray-700 px-1 rounded">
                    pip install claude-cli
                  </code>
                </li>
                <li>Use Claude CLI for your conversations</li>
                <li>
                  Logs will be automatically created in your home directory
                </li>
                <li>Come back here to view your usage analytics</li>
              </ol>
              <p className="text-sm text-gray-500 mt-3">
                Note: Usage data is only available after using Claude CLI. Web
                UI usage is not tracked.
              </p>
            </div>
          )}

          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!usageReport) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-400">No usage data available</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary mb-2">
            Usage & Billing
          </h2>
          <p className="text-sm sm:text-base text-gray-400">
            Track your Claude usage and costs across different time periods
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap gap-2">
          {viewModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  viewMode === mode.id
                    ? "bg-orange-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {mode.name}
              </button>
            );
          })}
        </div>

        {/* Date Selector */}
        <div className="mt-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Overview Stats */}
      <div className="glass-card p-6">
        <div className="flex items-center space-x-3 mb-4">
          <ChartBarIcon className="h-6 w-6 text-orange-500" />
          <h3 className="text-lg font-semibold text-primary">Usage Overview</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border border-gray-700/30 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Total Cost</p>
            <p className="text-xl font-bold text-orange-400">
              {formatCurrency(usageReport.totalCost)}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Total Tokens</p>
            <p className="text-xl font-bold text-primary">
              {formatNumber(usageReport.totalTokens)}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Sessions</p>
            <p className="text-xl font-bold text-primary">
              {usageReport.sessions.length}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Last Updated</p>
            <p className="text-lg font-bold text-primary">
              {new Date(usageReport.lastUpdated).toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      {/* View Mode Content */}
      {viewMode === "daily" && <DailyView usage={usageReport.daily} />}
      {viewMode === "monthly" && <MonthlyView usage={usageReport.monthly} />}
      {viewMode === "session" && (
        <SessionView sessions={usageReport.sessions} />
      )}
      {viewMode === "window" && <WindowView usage={usageReport.daily} />}

      {/* Model Usage Breakdown */}
      <ModelBreakdown usage={usageReport} />

      {/* Actions */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">
          Billing Management
        </h3>

        <div className="space-y-4">
          <div className="border border-gray-700/30 rounded-lg p-4">
            <h4 className="font-medium text-primary mb-2">Anthropic Console</h4>
            <p className="text-sm text-gray-400 mb-3">
              View detailed usage reports, set spending limits, and manage your
              subscription
            </p>
            <a
              href="https://console.anthropic.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
            >
              Open Console
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          </div>

          <div className="border border-gray-700/30 rounded-lg p-4">
            <h4 className="font-medium text-primary mb-2">Usage Tips</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Use caching to reduce token costs significantly</li>
              <li>• Monitor daily usage to stay within budget</li>
              <li>• Review session costs to optimize your workflow</li>
              <li>• Export data for detailed analysis and reporting</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Daily View Component
function DailyView({ usage }: { usage: DailyUsage[] }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  if (!usage || usage.length === 0) {
    return (
      <div className="glass-card p-6">
        <p className="text-center text-gray-400">
          No daily usage data available
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-primary mb-4">Daily Usage</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-4">Date</th>
              <th className="text-right py-2 px-4">Cost</th>
              <th className="text-right py-2 px-4">Tokens</th>
              <th className="text-right py-2 px-4">Requests</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((day) => (
              <tr key={day.date} className="border-b border-gray-700/30">
                <td className="py-2 px-4">{day.date}</td>
                <td className="text-right py-2 px-4 text-orange-400">
                  {formatCurrency(day.totalCost)}
                </td>
                <td className="text-right py-2 px-4">
                  {formatNumber(day.totalTokens)}
                </td>
                <td className="text-right py-2 px-4">{day.requestCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Monthly View Component
function MonthlyView({ usage }: { usage: MonthlyUsage[] }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  if (!usage || usage.length === 0) {
    return (
      <div className="glass-card p-6">
        <p className="text-center text-gray-400">
          No monthly usage data available
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-primary mb-4">Monthly Usage</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-4">Month</th>
              <th className="text-right py-2 px-4">Cost</th>
              <th className="text-right py-2 px-4">Daily Avg</th>
              <th className="text-right py-2 px-4">Tokens</th>
              <th className="text-right py-2 px-4">Requests</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((month) => (
              <tr key={month.month} className="border-b border-gray-700/30">
                <td className="py-2 px-4">{month.month}</td>
                <td className="text-right py-2 px-4 text-orange-400">
                  {formatCurrency(month.totalCost)}
                </td>
                <td className="text-right py-2 px-4 text-yellow-400">
                  {formatCurrency(month.dailyAverage)}
                </td>
                <td className="text-right py-2 px-4">
                  {formatNumber(month.totalTokens)}
                </td>
                <td className="text-right py-2 px-4">{month.requestCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Session View Component
function SessionView({ sessions }: { sessions: SessionUsage[] }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  if (!sessions || sessions.length === 0) {
    return (
      <div className="glass-card p-6">
        <p className="text-center text-gray-400">No session data available</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-primary mb-4">Session Usage</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-4">Session</th>
              <th className="text-left py-2 px-4">Time</th>
              <th className="text-right py-2 px-4">Duration</th>
              <th className="text-right py-2 px-4">Cost</th>
              <th className="text-right py-2 px-4">Tokens</th>
              <th className="text-right py-2 px-4">Messages</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr
                key={session.sessionId}
                className="border-b border-gray-700/30"
              >
                <td className="py-2 px-4 font-mono text-xs">
                  {session.sessionId.substring(0, 8)}...
                </td>
                <td className="py-2 px-4">
                  {new Date(session.startTime).toLocaleString()}
                </td>
                <td className="text-right py-2 px-4">
                  {formatDuration(session.duration)}
                </td>
                <td className="text-right py-2 px-4 text-orange-400">
                  {formatCurrency(session.totalCost)}
                </td>
                <td className="text-right py-2 px-4">
                  {formatNumber(session.totalTokens)}
                </td>
                <td className="text-right py-2 px-4">{session.messages}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Window View Component (5-hour billing windows)
function WindowView({ usage }: { usage: DailyUsage[] }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  if (!usage || usage.length === 0) {
    return (
      <div className="glass-card p-6">
        <p className="text-center text-gray-400">No window data available</p>
      </div>
    );
  }

  const allWindows = usage.flatMap((day) =>
    day.windows.map((window) => ({ ...window, date: day.date })),
  );

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-primary mb-4">
        5-Hour Billing Windows
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-4">Date</th>
              <th className="text-left py-2 px-4">Window</th>
              <th className="text-right py-2 px-4">Cost</th>
              <th className="text-right py-2 px-4">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {allWindows.map((window, idx) => (
              <tr key={idx} className="border-b border-gray-700/30">
                <td className="py-2 px-4">{window.date}</td>
                <td className="py-2 px-4">
                  {new Date(window.start).toLocaleTimeString()} -{" "}
                  {new Date(window.end).toLocaleTimeString()}
                </td>
                <td className="text-right py-2 px-4 text-orange-400">
                  {formatCurrency(window.totalCost)}
                </td>
                <td className="text-right py-2 px-4">
                  {formatNumber(window.totalTokens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Model Breakdown Component
function ModelBreakdown({ usage }: { usage: UsageReport }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  // Aggregate model usage across all data
  const modelMap = new Map<string, ModelUsage>();

  const aggregateModels = (models: ModelUsage[]) => {
    models.forEach((model) => {
      const existing = modelMap.get(model.model);
      if (existing) {
        existing.inputTokens += model.inputTokens;
        existing.outputTokens += model.outputTokens;
        existing.cacheCreationTokens += model.cacheCreationTokens;
        existing.cacheReadTokens += model.cacheReadTokens;
        existing.cost += model.cost;
        existing.requestCount += model.requestCount;
      } else {
        modelMap.set(model.model, { ...model });
      }
    });
  };

  usage.daily.forEach((day) => aggregateModels(day.models));
  usage.sessions.forEach((session) => aggregateModels(session.models));

  const models = Array.from(modelMap.values()).sort((a, b) => b.cost - a.cost);

  if (models.length === 0) {
    return null;
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-primary mb-4">
        Model Usage Breakdown
      </h3>
      <div className="space-y-4">
        {models.map((model) => (
          <div
            key={model.model}
            className="border border-gray-700/30 rounded-lg p-4"
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-primary">{model.model}</h4>
              <span className="text-orange-400 font-bold">
                {formatCurrency(model.cost)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>
                <span className="text-gray-400">Input:</span>{" "}
                <span className="text-gray-200">
                  {formatNumber(model.inputTokens)}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Output:</span>{" "}
                <span className="text-gray-200">
                  {formatNumber(model.outputTokens)}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Cache:</span>{" "}
                <span className="text-gray-200">
                  {formatNumber(
                    model.cacheCreationTokens + model.cacheReadTokens,
                  )}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Requests:</span>{" "}
                <span className="text-gray-200">{model.requestCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
