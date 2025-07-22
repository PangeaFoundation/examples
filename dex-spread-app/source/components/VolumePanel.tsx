// VolumePanel.tsx
import React from "react";
import { Box, Text } from "ink";
import { VolumeData } from "../types.js";

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(2)}K`;
  }
  return `$${amount.toFixed(2)}`;
};

// Helper function to create a visual bar for percentage
const getPercentageBar = (percentage: number): string => {
  const barLength = Math.round(percentage / 2); // 20 chars = 100%
  return "█".repeat(barLength);
};

export const VolumePanel: React.FC<{ volume: VolumeData }> = ({ volume }) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="magenta"
    paddingX={1}
  >
    <Text underline>Trading Volume</Text>
    <Box>
      <Text>Total: </Text>
      <Text bold>{formatCurrency(volume.totalVolume)}</Text>
    </Box>
    <Box>
      <Text>ThalaSwap: </Text>
      <Text color="cyan">
        {formatCurrency(volume.thalaswapVolume)} ({volume.thalaswapPercentage.toFixed(1)}%)
      </Text>
    </Box>
    <Box>
      <Text>{"  "}</Text>
      <Text color="cyan">{getPercentageBar(volume.thalaswapPercentage)}</Text>
    </Box>
    <Box>
      <Text>Cellana: </Text>
      <Text color="green">
        {formatCurrency(volume.cellanaVolume)} ({volume.cellanaPercentage.toFixed(1)}%)
      </Text>
    </Box>
    <Box>
      <Text>{"  "}</Text>
      <Text color="green">{getPercentageBar(volume.cellanaPercentage)}</Text>
    </Box>
  </Box>
);
