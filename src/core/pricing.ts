import type {
  CostBreakdown,
  CostCurrency,
  CostTotal,
} from "../types/ccusage.js";

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface PricedUsage {
  amount: number;
  currency: CostCurrency;
  breakdown: CostBreakdown;
}

interface ModelPrice {
  inputCacheHit: number;
  inputCacheMiss: number;
  output: number;
}

const DEEPSEEK_PRICES_CNY_PER_MILLION = {
  chat: {
    inputCacheHit: 0.02,
    inputCacheMiss: 1,
    output: 2,
  },
  reasoner: {
    inputCacheHit: 0.025,
    inputCacheMiss: 3,
    output: 6,
  },
} as const;

export function calculateKnownModelCost(
  modelName: string,
  usage: TokenUsage,
): PricedUsage | undefined {
  const pricing = getDeepSeekPricing(modelName);

  if (!pricing) {
    return undefined;
  }

  const input = pricePerMillion(
    usage.inputTokens,
    pricing.inputCacheMiss,
  );
  const output = pricePerMillion(
    usage.outputTokens,
    pricing.output,
  );
  const cacheCreation = pricePerMillion(
    usage.cacheCreationTokens,
    pricing.inputCacheMiss,
  );
  const cacheRead = pricePerMillion(
    usage.cacheReadTokens,
    pricing.inputCacheHit,
  );

  return {
    amount: input + output + cacheCreation + cacheRead,
    currency: "CNY",
    breakdown: {
      input,
      output,
      cacheCreation,
      cacheRead,
    },
  };
}

export function getCostTotals(
  costs: Array<{ amount: number; currency: CostCurrency }>,
): CostTotal[] {
  const totals = new Map<CostCurrency, number>();

  for (const cost of costs) {
    totals.set(cost.currency, (totals.get(cost.currency) || 0) + cost.amount);
  }

  return [...totals.entries()].map(([currency, amount]) => ({
    currency,
    amount,
  }));
}

function getDeepSeekPricing(modelName: string): ModelPrice | undefined {
  const normalized = modelName.toLowerCase();

  if (!normalized.includes("deepseek")) {
    return undefined;
  }

  if (normalized.includes("chat")) {
    return DEEPSEEK_PRICES_CNY_PER_MILLION.chat;
  }

  if (normalized.includes("reasoner")) {
    return DEEPSEEK_PRICES_CNY_PER_MILLION.reasoner;
  }

  return DEEPSEEK_PRICES_CNY_PER_MILLION.reasoner;
}

function pricePerMillion(tokens: number, price: number): number {
  return (tokens / 1_000_000) * price;
}
