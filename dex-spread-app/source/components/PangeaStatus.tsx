// PangeaStatus.tsx
import React from "react";
import { Box, Text } from "ink";
import { PangeaStatus as PangeaStatusType } from "../types.js";

// Helper function to format latency in milliseconds with no decimal places
const formatLatencyMs = (latencyMs: number): string => {
  return `${Math.round(latencyMs)}ms`;
};

// Helper function to convert hex version to integer
const formatVersion = (version: string | undefined): string => {
  if (!version) return "Unknown";

  // Check if it's a hex string (starts with 0x)
  if (version.startsWith("0x")) {
    try {
      return parseInt(version, 16).toString();
    } catch (e) {
      return version;
    }
  }

  return version;
};

export const PangeaStatus: React.FC<{ status: PangeaStatusType }> = ({ status }) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="magenta"
    paddingX={1}
  >
    <Text underline>Pangea Status</Text>
    <Box>
      <Text>Connection: </Text>
      <Text color={status.connected ? "green" : "red"}>
        {status.connected ? "● Connected" : "○ Disconnected"}
      </Text>
    </Box>
    <Box>
      <Text>API Latency: </Text>
      <Text color={status.apiLatencyMs < 500 ? "green" : status.apiLatencyMs < 1000 ? "yellow" : "red"}>
        {formatLatencyMs(status.apiLatencyMs)}
      </Text>
    </Box>
    <Box>
      <Text>Events Processed: </Text>
      <Text>{status.eventsProcessed.toLocaleString()}</Text>
    </Box>
    <Box>
      <Text>Current Version: </Text>
      <Text>{formatVersion(status.currentVersion)}</Text>
    </Box>
  </Box>
);
