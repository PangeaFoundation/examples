// SwapPanel.tsx
import React from "react";
import { Box, Text } from "ink";
import { Swap } from "../types.js";
import { formatHash } from "../utils.js";

// No latency helpers needed anymore as we've moved this to the status pane

export const SwapPanel: React.FC<{ swap: Swap }> = ({ swap }) => {
  // Ensure BUY and SELL take up the same space by using a fixed-width approach
  const sideText = swap.side === "BUY" ? "BUY " : "SELL"; // Add space to BUY to match SELL length

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={3}
      paddingY={1}
      width={85} // Increased width to match App.tsx layout
    >
      <Text>
        <Text bold>{swap.dex}</Text>{" "}
        <Text color={swap.side === "BUY" ? "green" : "red"}>{sideText}</Text>{" "}
        {swap.amount.toFixed(6)} APT @ ${swap.price.toFixed(6)}
      </Text>
      <Text>
        {swap.usdc.toFixed(2)} USDC
      </Text>
      <Text dimColor>{formatHash(swap.hash)}</Text>
    </Box>
  );
};
