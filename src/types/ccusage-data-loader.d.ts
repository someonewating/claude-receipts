declare module "ccusage/data-loader" {
  export function loadSessionUsageById(sessionId: string): Promise<unknown>;
  export function loadSessionData(): Promise<unknown>;
}

declare module "ccusage/logger" {
  export const logger: {
    level: number;
  };
}
