import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  HourlyUsage,
} from "../../../shared/billingTypes";

export function BillTab() {
  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadUsageData = useCallback(async () => {
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
  }, [viewMode, selectedDate]);

  useEffect(() => {
    loadUsageData();
  }, [loadUsageData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadUsageData();
      setLastRefresh(new Date());
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, loadUsageData]);

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
                ? "No Usage Data Available"
                : "Error Loading Usage Data"}
            </h3>
          </div>
          <div className="space-y-2 mb-4">
            {errorLines.map((line, index) => (
              <p key={index} className="text-red-400 text-sm">
                {line}
              </p>
            ))}
          </div>

          {isNoLogsError && (
            <div className="border border-gray-700/30 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-primary mb-2">
                About Usage Tracking
              </h4>
              <div className="text-sm text-gray-400 space-y-2">
                <p>
                  Claude Code automatically tracks usage metrics when you use
                  the claude command through this web interface.
                </p>
                <p>Usage data includes:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Token usage per request</li>
                  <li>Model costs and billing estimates</li>
                  <li>Session analytics and timing</li>
                  <li>Daily and monthly summaries</li>
                </ul>
                <p className="mt-3">
                  Start using Claude through the chat interface to begin
                  tracking your usage automatically.
                </p>
              </div>
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-primary mb-2">
            Usage & Billing
          </h2>
          <p className="text-sm sm:text-base text-gray-400">
            Track your Claude usage and costs
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${
              autoRefresh
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-white"
            }`}
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">
              {autoRefresh ? "Auto" : "Manual"}
            </span>
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm sm:text-base"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm sm:text-base"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="glass-card p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {viewModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all text-sm sm:text-base ${
                  viewMode === mode.id
                    ? "bg-orange-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{mode.name}</span>
                <span className="sm:hidden">{mode.name.substring(0, 3)}</span>
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
            className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-gray-700 text-gray-200 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none text-sm sm:text-base"
          />
        </div>
      </div>

      {/* Overview Stats */}
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center space-x-3 mb-4">
          <ChartBarIcon className="h-5 sm:h-6 w-5 sm:w-6 text-orange-500" />
          <h3 className="text-base sm:text-lg font-semibold text-primary">
            Usage Overview
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">Total Cost</p>
            <p className="text-lg sm:text-xl font-bold text-orange-400">
              {formatCurrency(usageReport.totalCost)}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">
              Total Tokens
            </p>
            <p className="text-lg sm:text-xl font-bold text-primary">
              {formatNumber(usageReport.totalTokens)}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">Sessions</p>
            <p className="text-lg sm:text-xl font-bold text-primary">
              {usageReport.sessions.length}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">
              Last Updated
            </p>
            <p className="text-base sm:text-lg font-bold text-primary">
              {lastRefresh.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {autoRefresh && (
              <p className="text-xs text-gray-500 mt-1">Auto-refresh</p>
            )}
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

  const today = new Date().toISOString().split("T")[0];
  const todayUsage = usage.find((day) => day.date === today);

  // Calculate running totals
  let runningTotal = 0;
  const usageWithRunningTotal = usage.map((day) => {
    runningTotal += day.totalCost;
    return { ...day, runningTotal };
  });

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
    <div className="space-y-6">
      {/* Today's Usage Highlight */}
      {todayUsage && (
        <div className="glass-card p-4 sm:p-6 border-2 border-orange-500/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-primary flex items-center gap-2">
              <CalendarDaysIcon className="h-4 sm:h-5 w-4 sm:w-5 text-orange-500" />
              Today's Usage
            </h3>
            <span className="text-xs sm:text-sm text-gray-400">{today}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-400 mb-1">Cost</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-400">
                {formatCurrency(todayUsage.totalCost)}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-400 mb-1">Tokens</p>
              <p className="text-xl sm:text-2xl font-bold text-primary">
                {formatNumber(todayUsage.totalTokens)}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-400 mb-1">Requests</p>
              <p className="text-xl sm:text-2xl font-bold text-primary">
                {todayUsage.requestCount}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-400 mb-1">Avg/Hour</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-400">
                {formatCurrency(
                  todayUsage.averageCostPerHour || todayUsage.totalCost / 24,
                )}
              </p>
            </div>
          </div>

          {/* Hourly breakdown chart */}
          {todayUsage.hourlyBreakdown && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-400 mb-3">
                Hourly Activity
              </h4>
              <HourlyChart hourlyData={todayUsage.hourlyBreakdown} />
            </div>
          )}

          {/* Model breakdown for today */}
          {todayUsage.models.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-400 mb-2">
                Models Used Today
              </h4>
              <div className="space-y-2">
                {todayUsage.models.map((model) => (
                  <div
                    key={model.model}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-gray-300">{model.model}</span>
                    <span className="text-orange-400">
                      {formatCurrency(model.cost)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Daily Usage Table */}
      <div className="glass-card p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-primary mb-4">
          Daily Usage History
        </h3>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-4">Date</th>
                <th className="text-right py-2 px-4">Daily Cost</th>
                <th className="text-right py-2 px-4">Running Total</th>
                <th className="text-right py-2 px-4">Tokens</th>
                <th className="text-right py-2 px-4">Requests</th>
                <th className="text-right py-2 px-4">Avg/Request</th>
              </tr>
            </thead>
            <tbody>
              {usageWithRunningTotal.map((day) => (
                <tr
                  key={day.date}
                  className={`border-b border-gray-700/30 ${
                    day.date === today ? "bg-orange-500/10" : ""
                  }`}
                >
                  <td className="py-2 px-4">
                    {day.date}
                    {day.date === today && (
                      <span className="ml-2 text-xs text-orange-400">
                        (Today)
                      </span>
                    )}
                  </td>
                  <td className="text-right py-2 px-4 text-orange-400 font-medium">
                    {formatCurrency(day.totalCost)}
                  </td>
                  <td className="text-right py-2 px-4 text-yellow-400">
                    {formatCurrency(day.runningTotal)}
                  </td>
                  <td className="text-right py-2 px-4">
                    {formatNumber(day.totalTokens)}
                  </td>
                  <td className="text-right py-2 px-4">{day.requestCount}</td>
                  <td className="text-right py-2 px-4 text-gray-400">
                    {formatCurrency(
                      day.requestCount > 0
                        ? day.totalCost / day.requestCount
                        : 0,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

// Hourly Chart Component
function HourlyChart({ hourlyData }: { hourlyData: HourlyUsage[] }) {
  const maxCost = Math.max(...hourlyData.map((h) => h.cost), 0.01);
  const currentHour = new Date().getHours();

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>12AM</span>
        <span>6AM</span>
        <span>12PM</span>
        <span>6PM</span>
        <span>11PM</span>
      </div>
      <div className="flex gap-0.5 items-end h-24">
        {hourlyData.map((hour) => {
          const heightPercent = (hour.cost / maxCost) * 100;
          const isCurrentHour = hour.hour === currentHour;
          const isFuture = hour.hour > currentHour;

          return (
            <div
              key={hour.hour}
              className="flex-1 relative group"
              style={{ height: "100%" }}
            >
              <div
                className={`absolute bottom-0 w-full transition-all duration-300 rounded-t ${
                  isCurrentHour
                    ? "bg-orange-500 animate-pulse"
                    : isFuture
                      ? "bg-gray-700"
                      : hour.cost > 0
                        ? "bg-orange-600 hover:bg-orange-500"
                        : "bg-gray-800"
                }`}
                style={{
                  height: `${heightPercent}%`,
                  minHeight: hour.cost > 0 ? "4px" : "1px",
                }}
              />

              {/* Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none z-10 transition-opacity">
                <div className="font-medium">{hour.hour}:00</div>
                <div>Cost: ${hour.cost.toFixed(4)}</div>
                <div>Requests: {hour.requests}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span className="text-orange-400">
          Peak: {hourlyData.find((h) => h.cost === maxCost)?.hour}:00
        </span>
        <span>
          Total: ${hourlyData.reduce((sum, h) => sum + h.cost, 0).toFixed(2)}
        </span>
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
    <div className="glass-card p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-primary mb-4">
        Model Usage Breakdown
      </h3>
      <div className="space-y-3 sm:space-y-4">
        {models.map((model) => (
          <div
            key={model.model}
            className="border border-gray-700/30 rounded-lg p-3 sm:p-4"
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
              <h4 className="font-medium text-primary text-sm sm:text-base break-all">
                {model.model}
              </h4>
              <span className="text-orange-400 font-bold text-sm sm:text-base">
                {formatCurrency(model.cost)}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs sm:text-sm">
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
