import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateKnownModelCost,
  getCostTotals,
} from "../dist/core/pricing.js";

test("prices deepseek-chat with CNY chat rates", () => {
  const cost = calculateKnownModelCost("deepseek-chat", {
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    cacheCreationTokens: 1_000_000,
    cacheReadTokens: 1_000_000,
  });

  assert.deepEqual(cost, {
    amount: 4.02,
    currency: "CNY",
    breakdown: {
      input: 1,
      output: 2,
      cacheCreation: 1,
      cacheRead: 0.02,
    },
  });
});

test("prices deepseek-reasoner with CNY reasoner rates", () => {
  const cost = calculateKnownModelCost("deepseek-reasoner", {
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    cacheCreationTokens: 1_000_000,
    cacheReadTokens: 1_000_000,
  });

  assert.deepEqual(cost, {
    amount: 12.025,
    currency: "CNY",
    breakdown: {
      input: 3,
      output: 6,
      cacheCreation: 3,
      cacheRead: 0.025,
    },
  });
});

test("falls back to reasoner rates for unknown DeepSeek aliases", () => {
  const cost = calculateKnownModelCost("provider/deepseek-custom", {
    inputTokens: 1_000_000,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  });

  assert.equal(cost?.amount, 3);
  assert.equal(cost?.currency, "CNY");
});

test("does not price non-DeepSeek models", () => {
  const cost = calculateKnownModelCost("claude-sonnet-4-5", {
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  });

  assert.equal(cost, undefined);
});

test("keeps mixed currency totals separate", () => {
  const totals = getCostTotals([
    { amount: 1.25, currency: "USD" },
    { amount: 2, currency: "CNY" },
    { amount: 0.75, currency: "USD" },
    { amount: 3, currency: "CNY" },
  ]);

  assert.deepEqual(totals, [
    { currency: "USD", amount: 2 },
    { currency: "CNY", amount: 5 },
  ]);
});
