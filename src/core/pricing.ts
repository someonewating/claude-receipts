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

const DEEPSEEK_PRICES_CNY_PER_MILLION = {
  inputCacheHit: 0.025,
  inputCacheMiss: 3,
  output: 6,
} as const;

export function calculateKnownModelCost(
  modelName: string,
  usage: TokenUsage,
): PricedUsage | undefined {
  if (!isDeepSeekModel(modelName)) {
    return undefined;
  }

  const input = pricePerMillion(
    usage.inputTokens,
    DEEPSEEK_PRICES_CNY_PER_MILLION.inputCacheMiss,
  );
  const output = pricePerMillion(
    usage.outputTokens,
    DEEPSEEK_PRICES_CNY_PER_MILLION.output,
  );
  const cacheCreation = pricePerMillion(
    usage.cacheCreationTokens,
    DEEPSEEK_PRICES_CNY_PER_MILLION.inputCacheMiss,
  );
  const cacheRead = pricePerMillion(
    usage.cacheReadTokens,
    DEEPSEEK_PRICES_CNY_PER_MILLION.inputCacheHit,
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

function isDeepSeekModel(modelName: string): boolean {
  return modelName.toLowerCase().includes("deepseek");
}

function pricePerMillion(tokens: number, price: number): number {
  return (tokens / 1_000_000) * price;
}
