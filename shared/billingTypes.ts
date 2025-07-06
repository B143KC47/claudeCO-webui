export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  requestCount: number;
}

export interface TimeWindow {
  start: string;
  end: string;
  usage: ModelUsage[];
  totalCost: number;
  totalTokens: number;
}

export interface DailyUsage {
  date: string;
  windows: TimeWindow[];
  models: ModelUsage[];
  totalCost: number;
  totalTokens: number;
  requestCount: number;
}

export interface MonthlyUsage {
  month: string;
  days: DailyUsage[];
  models: ModelUsage[];
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  dailyAverage: number;
}

export interface SessionUsage {
  sessionId: string;
  startTime: string;
  endTime: string;
  duration: number;
  messages: number;
  models: ModelUsage[];
  totalCost: number;
  totalTokens: number;
  projectPath?: string;
}

export interface UsageReport {
  daily: DailyUsage[];
  monthly: MonthlyUsage[];
  sessions: SessionUsage[];
  currentSession?: SessionUsage;
  totalCost: number;
  totalTokens: number;
  lastUpdated: string;
}

export type ViewMode = "daily" | "monthly" | "session" | "window";

export interface BillingFilters {
  startDate?: string;
  endDate?: string;
  model?: string;
  projectPath?: string;
  viewMode: ViewMode;
}

export interface ModelPricing {
  inputPrice: number;  // per million tokens
  outputPrice: number; // per million tokens
  cacheCreationPrice: number; // per million tokens
  cacheReadPrice: number; // per million tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-3-5-sonnet-20241022": {
    inputPrice: 3.00,
    outputPrice: 15.00,
    cacheCreationPrice: 3.75,
    cacheReadPrice: 0.30,
  },
  "claude-3-5-haiku-20241022": {
    inputPrice: 1.00,
    outputPrice: 5.00,
    cacheCreationPrice: 1.25,
    cacheReadPrice: 0.10,
  },
  "claude-3-opus-20240229": {
    inputPrice: 15.00,
    outputPrice: 75.00,
    cacheCreationPrice: 18.75,
    cacheReadPrice: 1.50,
  },
  "claude-3-sonnet-20240229": {
    inputPrice: 3.00,
    outputPrice: 15.00,
    cacheCreationPrice: 3.75,
    cacheReadPrice: 0.30,
  },
  "claude-3-haiku-20240307": {
    inputPrice: 0.25,
    outputPrice: 1.25,
    cacheCreationPrice: 0.30,
    cacheReadPrice: 0.03,
  },
};