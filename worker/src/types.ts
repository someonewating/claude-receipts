// Shared types for the Cloudflare Worker

export type CostCurrency = "USD" | "CNY";

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
}

export interface ShareableReceiptData {
  sessionSlug: string;
  location: string;
  sessionDate: string; // ISO 8601
  timezone?: string;
  totalCost: number;
  totalCostCurrency?: CostCurrency;
  costTotals?: CostTotal[];
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  modelBreakdowns: ModelBreakdown[];
  userMessageCount: number;
  assistantMessageCount: number;
  totalMessages: number;
}

export interface Env {
  RECEIPTS: R2Bucket;
  RATE_LIMITS: KVNamespace;
}
