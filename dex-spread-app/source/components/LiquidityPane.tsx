// LiquidityPane.tsx
import React from "react";
import { Box, Text } from "ink";
import { PoolState } from "../types.js";
import { APT_DECIMALS, USDC_DECIMALS } from "../constants.js";

// Helper function to format large numbers with K, M, B suffixes
const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  } else {
    return num.toFixed(2);
  }
};

// Helper function to create a visual bar extending left from midpoint
const createLeftBar = (value: number, maxValue: number, maxLength: number): string => {
  // Calculate bar length based on percentage of max value
  const length = Math.max(1, Math.round((value / maxValue) * maxLength));

  // Create a bar with the characters reversed (right-to-left)
  return "█".repeat(length).padStart(maxLength, " ");
};

// Helper function to create a visual bar extending right from midpoint
const createRightBar = (value: number, maxValue: number, maxLength: number): string => {
  // Calculate bar length based on percentage of max value
  const length = Math.max(1, Math.round((value / maxValue) * maxLength));

  // Create a bar extending to the right
  return "█".repeat(length).padEnd(maxLength, " ");
};

export const LiquidityPane: React.FC<{
  thalaswapState: PoolState;
  cellanaState: PoolState;
}> = ({ thalaswapState, cellanaState }) => {
  // Convert raw balances to human-readable values
  const thalaAptBalance = thalaswapState.aptBalance / Math.pow(10, APT_DECIMALS);
  const thalaUsdcBalance = thalaswapState.usdcBalance / Math.pow(10, USDC_DECIMALS);
  const cellanaAptBalance = cellanaState.aptBalance / Math.pow(10, APT_DECIMALS);
  const cellanaUsdcBalance = cellanaState.usdcBalance / Math.pow(10, USDC_DECIMALS);

  // Calculate TVL (Total Value Locked) in USD
  const thalaswapTVL = thalaUsdcBalance + (thalaAptBalance * thalaUsdcBalance / thalaAptBalance);
  const cellanaTVL = cellanaUsdcBalance + (cellanaAptBalance * cellanaUsdcBalance / cellanaAptBalance);

  // Find maximum values for scaling the bars
  const maxAptBalance = Math.max(thalaAptBalance, cellanaAptBalance);
  const maxUsdcBalance = Math.max(thalaUsdcBalance, cellanaUsdcBalance);

  // Maximum bar length
  const maxBarLength = 30;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
    >
      <Text underline>Liquidity</Text>

      <Box>
        <Text>{"ThalaSwap:".padEnd(12)}</Text>
        <Box width={maxBarLength * 2 + 3}>
          <Box width={maxBarLength} justifyContent="flex-end">
            <Text color="blue">
              {createLeftBar(thalaAptBalance, maxAptBalance, maxBarLength)}
            </Text>
          </Box>
          <Text> | </Text>
          <Box width={maxBarLength}>
            <Text color="green">
              {createRightBar(thalaUsdcBalance, maxUsdcBalance, maxBarLength)}
            </Text>
          </Box>
        </Box>
        <Text> APT: {formatNumber(thalaAptBalance)} | USDC: {formatNumber(thalaUsdcBalance)} | TVL: ${formatNumber(thalaswapTVL)}</Text>
      </Box>

      <Box>
        <Text>{"Cellana:".padEnd(12)}</Text>
        <Box width={maxBarLength * 2 + 3}>
          <Box width={maxBarLength} justifyContent="flex-end">
            <Text color="blue">
              {createLeftBar(cellanaAptBalance, maxAptBalance, maxBarLength)}
            </Text>
          </Box>
          <Text> | </Text>
          <Box width={maxBarLength}>
            <Text color="green">
              {createRightBar(cellanaUsdcBalance, maxUsdcBalance, maxBarLength)}
            </Text>
          </Box>
        </Box>
        <Text> APT: {formatNumber(cellanaAptBalance)} | USDC: {formatNumber(cellanaUsdcBalance)} | TVL: ${formatNumber(cellanaTVL)}</Text>
      </Box>
    </Box>
  );
};
