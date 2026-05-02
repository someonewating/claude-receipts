import { loadSessionData, loadSessionUsageById } from "ccusage/data-loader";
import { logger as ccusageLogger } from "ccusage/logger";
import type {
  CostCurrency,
  CcusageSession,
  ModelBreakdown,
} from "../types/ccusage.js";
import { calculateKnownModelCost, getCostTotals } from "./pricing.js";

ccusageLogger.level = 0;

interface CcusageLoaderEntry {
  timestamp: string;
  message: {
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    model?: string;
  };
  costUSD?: number;
}

interface CcusageSessionUsage {
  totalCost: number;
  entries: CcusageLoaderEntry[];
}

export class DataFetcher {
  /**
   * Fetch accurate session data by exact session ID.
   * Uses ccusage's data loader directly, avoiding the CLI's stdin-sensitive
   * statusline behavior when spawned from hooks or other Node processes.
   */
  async fetchSessionById(sessionId: string): Promise<CcusageSession> {
    const data = (await loadSessionUsageById(
      sessionId,
    )) as CcusageSessionUsage | null;

    if (!data) {
      throw new Error(`No session data found for ${sessionId}`);
    }

    // Aggregate entries by model
    const modelMap = new Map<
      string,
      {
        inputTokens: number;
        outputTokens: number;
        cacheCreationTokens: number;
        cacheReadTokens: number;
        totalTokens: number;
        costUSD: number;
      }
    >();

    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheCreation = 0;
    let totalCacheRead = 0;

    for (const entry of data.entries) {
      const usage = entry.message.usage;
      const model = entry.message.model || "unknown";

      // Skip synthetic entries (no real model)
      if (model === "<synthetic>") continue;

      const input = usage.input_tokens || 0;
      const output = usage.output_tokens || 0;
      const cacheCreation = usage.cache_creation_input_tokens || 0;
      const cacheRead = usage.cache_read_input_tokens || 0;

      totalInput += input;
      totalOutput += output;
      totalCacheCreation += cacheCreation;
      totalCacheRead += cacheRead;

      const existing = modelMap.get(model) || {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        costUSD: 0,
      };

      existing.inputTokens += input;
      existing.outputTokens += output;
      existing.cacheCreationTokens += cacheCreation;
      existing.cacheReadTokens += cacheRead;
      existing.totalTokens += input + output + cacheCreation + cacheRead;
      existing.costUSD += entry.costUSD || 0;
      modelMap.set(model, existing);
    }

    // Use exact pricing for known non-Anthropic providers such as DeepSeek.
    // Fall back to ccusage's per-entry USD cost, or proportional session cost
    // for older ccusage output that does not include entry costs.
    const totalTokensAcrossModels = [...modelMap.values()].reduce(
      (sum, m) => sum + m.totalTokens,
      0,
    );

    const modelBreakdowns: ModelBreakdown[] = [...modelMap.entries()].map(
      ([modelName, stats]) => {
        const priced = calculateKnownModelCost(modelName, stats);
        const fallbackCost =
          stats.costUSD ||
          (totalTokensAcrossModels > 0
            ? data.totalCost * (stats.totalTokens / totalTokensAcrossModels)
            : 0);

        return {
          modelName,
          inputTokens: stats.inputTokens,
          outputTokens: stats.outputTokens,
          cacheCreationTokens: stats.cacheCreationTokens,
          cacheReadTokens: stats.cacheReadTokens,
          cost: priced?.amount ?? fallbackCost,
          costCurrency: priced?.currency ?? "USD",
          costBreakdown: priced?.breakdown,
        };
      },
    );

    const costTotals = getCostTotals(
      modelBreakdowns.map((model) => ({
        amount: model.cost,
        currency: model.costCurrency || ("USD" as CostCurrency),
      })),
    );
    const primaryTotal = costTotals[0] || {
      amount: data.totalCost,
      currency: "USD" as CostCurrency,
    };

    return {
      sessionId,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheCreationTokens: totalCacheCreation,
      cacheReadTokens: totalCacheRead,
      totalTokens:
        totalInput + totalOutput + totalCacheCreation + totalCacheRead,
      totalCost: primaryTotal.amount,
      totalCostCurrency: primaryTotal.currency,
      costTotals,
      modelsUsed: [...modelMap.keys()],
      modelBreakdowns,
    };
  }

  /**
   * Discover a session from the ccusage breakdown list, then fetch accurate
   * data via --id.
   *
   * @param sessionQuery Optional filter — matches against:
   *   1. Project path UUID (or prefix, e.g. "5ede5ccb")
   *   2. Session name (e.g. "subagents") — picks the most recent match
   *   If omitted, returns the first session with a valid project path.
   */
  async fetchSessionData(sessionQuery?: string): Promise<CcusageSession> {
    try {
      const sessions = (await loadSessionData()) as CcusageSession[];

      if (sessions.length === 0) {
        throw new Error("No session data found");
      }

      const validSessions = sessions.filter(
        (s) => s.projectPath && s.projectPath !== "Unknown Project",
      );

      if (validSessions.length === 0) {
        throw new Error(
          "No sessions with valid project paths found. Please run this command from a SessionEnd hook.",
        );
      }

      let match: CcusageSession | undefined;

      if (!sessionQuery) {
        match = validSessions[0];
      } else {
        // Try matching by project path UUID (exact or prefix)
        match = validSessions.find((s) => {
          const uuid = s.projectPath!.split("/").pop() || "";
          return uuid === sessionQuery || uuid.startsWith(sessionQuery);
        });

        // Try matching by session name (returns first/most recent match)
        if (!match) {
          match = validSessions.find((s) => s.sessionId === sessionQuery);
        }
      }

      if (!match) {
        const available = validSessions
          .slice(0, 10)
          .map((s) => {
            const uuid = s.projectPath!.split("/").pop() || "";
            const short = uuid.slice(0, 8);
            return `  ${short}  ${s.sessionId.padEnd(20)}  $${s.totalCost.toFixed(2)}`;
          })
          .join("\n");

        throw new Error(
          `No session matching "${sessionQuery}". Available sessions:\n${available}`,
        );
      }

      // Extract the full UUID from the projectPath and re-fetch via --id
      // for accurate totals (--breakdown only shows sub-session slices)
      const fullUuid = match.projectPath!.split("/").pop();
      if (fullUuid) {
        try {
          const accurate = await this.fetchSessionById(fullUuid);
          // Preserve projectPath from the discovery result
          accurate.projectPath = match.projectPath;
          return accurate;
        } catch {
          // Fall back to breakdown data if --id fails
          return match;
        }
      }

      return match;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch session data: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get the most recent session ID
   */
  async getMostRecentSessionId(): Promise<string> {
    const sessionData = await this.fetchSessionData();
    return sessionData.sessionId;
  }
}
