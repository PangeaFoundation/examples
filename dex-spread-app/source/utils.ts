// utils.ts
import { PoolState } from "./types.js";
import { APT_DECIMALS, USDC_DECIMALS } from "./constants.js";

/**
 * Calculate API latency - time between blockchain event and app receipt
 */
export function calculateApiLatency(timestampMicros: number, receivedAt: number): number {
  const eventTimestampMillis = Math.floor(timestampMicros / 1000);
  return receivedAt - eventTimestampMillis;
}

/**
 * Calculate processing time - time to process the event
 */
export function calculateProcessingTime(processingStartTime: number, processingEndTime: number): number {
  return processingEndTime - processingStartTime;
}

/**
 * Calculate total latency - end-to-end latency
 */
export function calculateTotalLatency(timestampMicros: number, processingEndTime: number): number {
  const eventTimestampMillis = Math.floor(timestampMicros / 1000);
  return processingEndTime - eventTimestampMillis;
}

/**
 * Legacy function for backward compatibility
 */
export function calculateLatency(timestampMicros: number, receivedAt?: number): number {
  const eventTimestampMillis = Math.floor(timestampMicros / 1000);

  // If receivedAt is provided, use it to calculate Pangea API latency
  // Otherwise, fall back to using current time (blockchain latency)
  const currentTimestampMillis = receivedAt || Date.now();
  return currentTimestampMillis - eventTimestampMillis;
}

export function bytesToString(bytes: number[]): string {
  return String.fromCharCode(...bytes);
}

export function calculateCurrentPrice(state: PoolState): number {
  if (state.aptBalance === 0 || state.usdcBalance === 0) {
    return 0;
  }

  const aptBalanceAdjusted = state.aptBalance / Math.pow(10, APT_DECIMALS);
  const usdcBalanceAdjusted = state.usdcBalance / Math.pow(10, USDC_DECIMALS);
  const price = usdcBalanceAdjusted / aptBalanceAdjusted;

  return price;
}

export function calculatePriceAfterSwap(usdcAmount: number, state: PoolState): number {
  if (state.aptBalance === 0 || state.usdcBalance === 0) {
    return 0;
  }

  const usdcAmountRaw = usdcAmount * Math.pow(10, USDC_DECIMALS);
  const x = state.usdcBalance;
  const y = state.aptBalance;
  const aptReceived = y - (x * y) / (x + usdcAmountRaw);

  const newUsdcBalance = x + usdcAmountRaw;
  const newAptBalance = y - aptReceived;

  const newAptBalanceAdjusted = newAptBalance / Math.pow(10, APT_DECIMALS);
  const newUsdcBalanceAdjusted = newUsdcBalance / Math.pow(10, USDC_DECIMALS);
  return newUsdcBalanceAdjusted / newAptBalanceAdjusted;
}

export function calculatePriceImpact(
  usdcAmount: number,
  state: PoolState,
): { price: number; impact: number } {
  const currentPrice = calculateCurrentPrice(state);

  if (currentPrice === 0) {
    return { price: 0, impact: 0 };
  }

  const priceAfterSwap = calculatePriceAfterSwap(usdcAmount, state);
  const priceImpact = ((priceAfterSwap - currentPrice) / currentPrice) * 100;
  return {
    price: priceAfterSwap,
    impact: priceImpact,
  };
}

export function calculatePriceSpread(
  thalaswapState: PoolState,
  cellanaState: PoolState,
): number {
  if (thalaswapState.currentPrice === 0 || cellanaState.currentPrice === 0) {
    return 0;
  }

  // Calculate the spread as (Cellana price - ThalaSwap price) to preserve direction
  const spreadDifference = cellanaState.currentPrice - thalaswapState.currentPrice;
  const spreadPercentage =
    (spreadDifference / Math.min(thalaswapState.currentPrice, cellanaState.currentPrice)) * 100;

  return spreadPercentage;
}

export function calculateDOMComparison(
  amounts: number[],
  thalaswapState: PoolState,
  cellanaState: PoolState,
): {
  amount: number;
  thalaPrice: number;
  thalaImpact: number;
  cellanaPrice: number;
  cellanaImpact: number;
  spread: number;
}[] {
  return amounts.map((amount) => {
    const thalaResult = calculatePriceImpact(amount, thalaswapState);
    const cellanaResult = calculatePriceImpact(amount, cellanaState);

    let spread = 0;
    let spreadPercentage = 0;

    if (thalaResult.price > 0 && cellanaResult.price > 0) {
      // Calculate the spread as (Cellana price - ThalaSwap price) to preserve direction
      spread = cellanaResult.price - thalaResult.price;
      spreadPercentage = (spread / Math.min(thalaResult.price, cellanaResult.price)) * 100;
    }

    return {
      amount,
      thalaPrice: thalaResult.price,
      thalaImpact: thalaResult.impact,
      cellanaPrice: cellanaResult.price,
      cellanaImpact: cellanaResult.impact,
      spread: spreadPercentage,
    };
  });
}

// UI Helpers
export const formatHash = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-4)}`;
export const colourForSpread = (s: number) => (s >= 0 ? "green" : "red");
// Note: This function is not used in SpreadPanel.tsx, which has its own spreadBar function
// But we're updating it for consistency in case it's used elsewhere
export const barForSpread = (s: number) => {
  const barLength = Math.min(20, Math.round(Math.abs(s) * 2000));
  return "█".repeat(barLength);
};

export const sparkline = (history: number[]) => {
  // Use different characters for up/down
  return history.map((v) => (v >= 0 ? "▲" : "▼")).join("");
};

/**
 * Helper function to compare two arrays for equality
 * Used for direct byte comparison of token identifiers
 */
export function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
