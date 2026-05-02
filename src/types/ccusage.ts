// ccusage JSON response types (actual format from ccusage CLI)

export type CostCurrency = "USD" | "CNY";

export interface CostBreakdown {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
}

export interface CostTotal {
  currency: CostCurrency;
  amount: number;
}

export interface ModelBreakdown {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  cost: number;
  costCurrency?: CostCurrency;
  costBreakdown?: CostBreakdown;
}

export interface CcusageSession {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalTokens: number;
  totalCost: number;
  totalCostCurrency?: CostCurrency;
  costTotals?: CostTotal[];
  lastActivity?: string;
  modelsUsed?: string[];
  modelBreakdowns?: ModelBreakdown[];
  projectPath?: string;
}

export interface CcusageResponse {
  sessions: CcusageSession[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalCost: number;
    totalTokens: number;
  };
}
