// SpreadPanel.tsx
import React from "react";
import { Box, Text } from "ink";
import { colourForSpread } from "../utils.js";

// Improved bar visualization for spread with exact center alignment
const spreadBar = (spread: number): string => {
  const maxBarLength = 51; // Use odd number to ensure exact center
  const middlePoint = Math.floor(maxBarLength / 2);
  const barChar = "█";
  const emptyChar = " ";
  const centerChar = "│"; // Vertical bar for center marker

  // Make the visualization more sensitive
  const scaleFactor = 20000; // Increase this to make the bar more sensitive to small changes
  const barLength = Math.min(Math.floor(Math.abs(spread) * scaleFactor), middlePoint);

  let bar = Array(maxBarLength).fill(emptyChar);

  if (spread > 0) {
    // Positive spread - bar goes right from middle
    for (let i = 0; i < barLength; i++) {
      bar[middlePoint + i + 1] = barChar;
    }
  } else if (spread < 0) {
    // Negative spread - bar goes left from middle
    for (let i = 0; i < barLength; i++) {
      bar[middlePoint - i - 1] = barChar;
    }
  }

  // Add a center marker
  bar[middlePoint] = centerChar;

  return bar.join("");
};

export const SpreadPanel: React.FC<{ history: number[] }> = ({ history }) => {
  const last = history[history.length - 1] ?? 0;
  const colour = colourForSpread(last);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colour}
      paddingX={1}
    >
      <Text underline>Cellana−ThalaSwap Mid-Price Spread</Text>
      <Text color={colour}>{(last * 100).toFixed(5)}%</Text>
      <Text color={colour}>{spreadBar(last)}</Text>
    </Box>
  );
};
