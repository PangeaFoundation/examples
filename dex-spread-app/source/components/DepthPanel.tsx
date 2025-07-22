// DepthPanel.tsx
import React from "react";
import { Box, Text } from "ink";
import { DepthRow } from "../types.js";
import { colourForSpread } from "../utils.js";

// Helper function to format numbers with consistent width
const formatNumber = (num: number, width: number, decimals: number): string => {
  return num.toFixed(decimals).padStart(width, ' ');
};

// Helper function to format percentages with consistent width
const formatPercent = (num: number, width: number, decimals: number): string => {
  return `(${(num * 100).toFixed(decimals)}%)`.padEnd(width, ' ');
};

export const DepthPanel: React.FC<{ rows: DepthRow[] }> = ({ rows }) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="magenta"
    paddingX={1}
  >
    <Text underline>Depth of Market (Price Impact)</Text>
    <Text>
      {"Amount".padStart(10)} USDC │ {"Cellana".padEnd(21)} │ {"ThalaSwap".padEnd(21)} │ Spread
    </Text>
    {rows.map((r) => (
      <Text key={r.amount}>
        {r.amount.toLocaleString().padStart(10)} USDC │ $
        {formatNumber(r.cellPrice, 9, 6)} {formatPercent(r.cellImp, 10, 3)} │ $
        {formatNumber(r.thalaPrice, 9, 6)} {formatPercent(r.thalaImp, 10, 3)} │{" "}
        <Text color={colourForSpread(r.spread)}>{(r.spread * 100).toFixed(3)}%</Text>
      </Text>
    ))}
  </Box>
);
