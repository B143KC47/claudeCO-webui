import { useState, useEffect } from "react";
import {
  CurrencyDollarIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { getApiUrl } from "../../config/api";

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

export function BillTab() {
  const [billingData, setBillingData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(getApiUrl("/api/billing"));
      if (!response.ok) {
        throw new Error(`Failed to load billing data: ${response.statusText}`);
      }

      const data = await response.json();
      setBillingData(data);
    } catch (err) {
      console.error("Error loading billing data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load billing data",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadBillingData();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="ml-3 text-gray-300">Loading billing data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-6 border border-red-500/20">
          <div className="flex items-center space-x-3 mb-4">
            <CurrencyDollarIcon className="h-6 w-6 text-red-500" />
            <h3 className="text-lg font-semibold text-primary">
              Error Loading Billing Data
            </h3>
          </div>
          <p className="text-red-400 mb-4">{error}</p>
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

  if (!billingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-400">No billing data available</span>
      </div>
    );
  }

  const { usage, billing } = billingData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary mb-2">
            Usage & Billing
          </h2>
          <p className="text-sm sm:text-base text-gray-400">
            Monitor your Claude Code usage and costs
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors w-full sm:w-auto"
        >
          Refresh
        </button>
      </div>

      {/* Current Session Stats */}
      <div className="glass-card p-6">
        <div className="flex items-center space-x-3 mb-4">
          <ClockIcon className="h-6 w-6 text-orange-500" />
          <h3 className="text-lg font-semibold text-primary">
            Current Session
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">
              Session Cost
            </p>
            <p className="text-lg sm:text-xl font-bold text-orange-400">
              {formatCurrency(usage.sessionCost)}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">Duration</p>
            <p className="text-lg sm:text-xl font-bold text-primary">
              {usage.sessionDuration}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">
              Total Tokens
            </p>
            <p className="text-lg sm:text-xl font-bold text-primary">
              {formatNumber(usage.tokensUsed)}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">Requests</p>
            <p className="text-lg sm:text-xl font-bold text-primary">
              {usage.requestsCount}
            </p>
          </div>
        </div>
      </div>

      {/* Token Usage Breakdown */}
      <div className="glass-card p-6">
        <div className="flex items-center space-x-3 mb-4">
          <ChartBarIcon className="h-6 w-6 text-orange-500" />
          <h3 className="text-lg font-semibold text-primary">
            Token Usage Breakdown
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">
              Input Tokens
            </p>
            <p className="text-base sm:text-lg font-bold text-orange-400">
              {formatNumber(usage.inputTokens)}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">
              Output Tokens
            </p>
            <p className="text-base sm:text-lg font-bold text-green-400">
              {formatNumber(usage.outputTokens)}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">
              Cache Creation
            </p>
            <p className="text-base sm:text-lg font-bold text-purple-400">
              {formatNumber(usage.cacheCreationTokens)}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">Cache Read</p>
            <p className="text-base sm:text-lg font-bold text-yellow-400">
              {formatNumber(usage.cacheReadTokens)}
            </p>
          </div>
        </div>
      </div>

      {/* Code Changes */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">
          Code Changes
        </h3>

        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">Lines Added</p>
            <p className="text-base sm:text-lg font-bold text-green-400">
              +{formatNumber(usage.linesAdded)}
            </p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">
              Lines Removed
            </p>
            <p className="text-base sm:text-lg font-bold text-red-400">
              -{formatNumber(usage.linesRemoved)}
            </p>
          </div>
        </div>
      </div>

      {/* Billing Overview */}
      <div className="glass-card p-6">
        <div className="flex items-center space-x-3 mb-4">
          <CurrencyDollarIcon className="h-6 w-6 text-orange-500" />
          <h3 className="text-lg font-semibold text-primary">
            Billing Overview
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-6">
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">
              Daily Average
            </p>
            <p className="text-lg sm:text-xl font-bold text-orange-400">
              {formatCurrency(billing.dailyAverage)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Based on usage</p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">
              Monthly Estimate
            </p>
            <p className="text-lg sm:text-xl font-bold text-orange-400">
              {formatCurrency(billing.monthlyEstimate)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Based on daily average</p>
          </div>
          <div className="border border-gray-700/30 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-1">
              Current Session
            </p>
            <p className="text-lg sm:text-xl font-bold text-primary">
              {formatCurrency(billing.currentPeriodSpend)}
            </p>
            <p className="text-xs text-gray-500 mt-1">This session</p>
          </div>
        </div>

        {/* Account Info */}
        {billing.accountInfo && (
          <div className="border border-gray-700/30 rounded-lg p-4">
            <h4 className="font-medium text-primary mb-3">
              Account Information
            </h4>
            <div className="space-y-2 text-sm">
              {billing.accountInfo.email && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Email:</span>
                  <span className="text-gray-200">
                    {billing.accountInfo.email}
                  </span>
                </div>
              )}
              {billing.accountInfo.organization && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Organization:</span>
                  <span className="text-gray-200">
                    {billing.accountInfo.organization}
                  </span>
                </div>
              )}
              {billing.accountInfo.role && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Role:</span>
                  <span className="text-gray-200">
                    {billing.accountInfo.role}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
              <li>
                • Use Claude Code's caching features to reduce token costs
              </li>
              <li>
                • Consider setting up spending alerts in the Anthropic Console
              </li>
              <li>• Monitor your daily usage to stay within budget</li>
              <li>
                • Use /cost command in Claude conversations for real-time cost
                tracking
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-center text-xs text-gray-500">
        Last updated: {new Date(billingData.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
}
