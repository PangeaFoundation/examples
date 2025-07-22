import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Use dynamic import for pangea-client to avoid CommonJS/ESM interop warnings
let Client: any;
let RequestFormats: any;

// Initialize pangea-client at the module level
(async () => {
  try {
    const pkg = await import("pangea-client");
    Client = pkg.default.Client;
    RequestFormats = pkg.default.RequestFormats;
  } catch (error) {
    console.error("Failed to import pangea-client:", error);
  }
})();
import { Swap, DepthRow, Snapshot, PangeaEvent, PoolEvent, UnifiedEvent, PoolState, PangeaStatus, VolumeData } from "./types.js";
import { SwapPanel } from "./components/SwapPanel.js";
import { SpreadPanel } from "./components/SpreadPanel.js";
import { DepthPanel } from "./components/DepthPanel.js";
import { PangeaStatus as PangeaStatusComponent } from "./components/PangeaStatus.js";
import { VolumePanel } from "./components/VolumePanel.js";
import { LiquidityPane } from "./components/LiquidityPane.js";
import {
  THALASWAP_ADDRESS,
  CELLANA_ADDRESS,
  THALA_APT_USDC_POOL_ID,
  THALA_APT_TOKEN_ID,
  THALA_USDC_TOKEN_ID,
  CELLANA_APT_USDC_POOL_ID,
  CELLANA_USDC_TOKEN_ID,
  CELLANA_APT_IDENTIFIER,
  CELLANA_USDC_TOKEN_BYTES,
  CELLANA_APT_IDENTIFIER_BYTES,
  APT_DECIMALS,
  USDC_DECIMALS
} from "./constants.js";
import {
  calculateLatency,
  calculateApiLatency,
  calculateProcessingTime,
  calculateTotalLatency,
  bytesToString,
  calculateCurrentPrice,
  calculatePriceAfterSwap,
  calculatePriceImpact,
  calculatePriceSpread,
  calculateDOMComparison,
  arraysEqual
} from "./utils.js";


// Initialize state objects
let thalaswapState: PoolState = {
  aptBalance: 0,
  usdcBalance: 0,
  recentEvents: [],
  currentPrice: 0,
};

let cellanaState: PoolState = {
  aptBalance: 0,
  usdcBalance: 0,
  recentEvents: [],
  currentPrice: 0,
};

// Track the latest swap event
let latestSwapEvent: UnifiedEvent | null = null;

// Track spread history
let spreadHistory: number[] = Array(120).fill(0);

// Track connection status and event count
let isConnected = false;
let eventsProcessed = 0;
let lastApiLatency = 0;
let lastProcessingTime = 0;
let lastTotalLatency = 0;

// Track trading volume
let thalaswapVolume = 0;
let cellanaVolume = 0;

// ---------- Event Processing Functions ----------
function processThalaSwapEvent(event: PangeaEvent): void {
  const decoded = typeof event.decoded === "string" ? JSON.parse(event.decoded) : event.decoded;

  if (decoded.pool_obj.fields.inner !== THALA_APT_USDC_POOL_ID) {
    return;
  }

  thalaswapState.aptBalance = decoded.pool_balances[0];
  thalaswapState.usdcBalance = decoded.pool_balances[1];

  const token0 = decoded.metadata[0].fields.inner;
  const token1 = decoded.metadata[1].fields.inner;

  const isAptBought =
    (decoded.idx_in === 1 && token1 === THALA_USDC_TOKEN_ID && token0 === THALA_APT_TOKEN_ID) ||
    (decoded.idx_in === 0 && token0 === THALA_USDC_TOKEN_ID && token1 === THALA_APT_TOKEN_ID);

  const aptAmount = isAptBought
    ? decoded.amount_out / Math.pow(10, APT_DECIMALS)
    : decoded.amount_in / Math.pow(10, APT_DECIMALS);

  const usdcAmount = isAptBought
    ? decoded.amount_in / Math.pow(10, USDC_DECIMALS)
    : decoded.amount_out / Math.pow(10, USDC_DECIMALS);

  const price = usdcAmount / aptAmount;

  // Update ThalaSwap volume
  thalaswapVolume += usdcAmount;

  const version = event.block_number;
  const logIndex = event.log_index || "0x0";
  const latency = calculateLatency(event.timestamp, event.receivedAt);
  const timestamp = new Date(Math.floor(event.timestamp / 1000)).toLocaleString();

  const poolEvent: PoolEvent = {
    type: "Swap",
    direction: isAptBought ? "BUY" : "SELL",
    aptAmount,
    usdcAmount,
    price,
    version,
    logIndex,
    timestamp,
    latency,
    txHash: event.transaction_hash || "unknown",
  };

  thalaswapState.recentEvents.unshift(poolEvent);
  if (thalaswapState.recentEvents.length > 10) {
    thalaswapState.recentEvents.pop();
  }

  thalaswapState.currentPrice = calculateCurrentPrice(thalaswapState);

  const unifiedEvent: UnifiedEvent = {
    ...poolEvent,
    source: "ThalaSwap",
  };

  latestSwapEvent = unifiedEvent;

  // Update spread history
  const currentSpread = calculatePriceSpread(thalaswapState, cellanaState);
  spreadHistory = [...spreadHistory.slice(1), currentSpread / 100]; // Convert to decimal for UI
}

function processCellanaSwapEvent(event: PangeaEvent): void {
  const decoded = typeof event.decoded === "string" ? JSON.parse(event.decoded) : event.decoded;

  // Check if pool field exists
  if (!decoded.pool) {
    return;
  }

  // Check if this is the APT/USDC pool we're interested in - early exit if not
  // Normalize pool IDs for comparison by removing 0x prefix and converting to lowercase
  const normalizedEventPoolId = (decoded.pool || "").toString().toLowerCase().replace(/^0x/, "");
  const normalizedExpectedPoolId = CELLANA_APT_USDC_POOL_ID.toLowerCase().replace(/^0x/, "");

  if (normalizedEventPoolId !== normalizedExpectedPoolId) {
    return;
  }

  // Convert token strings from byte arrays if needed
  let fromToken = "";
  let toToken = "";

  // Extract from_token
  if (decoded.from_token && decoded.from_token.fields && decoded.from_token.fields.bytes) {
    fromToken = bytesToString(decoded.from_token.fields.bytes);
  } else if (typeof decoded.from_token === "string") {
    fromToken = decoded.from_token;
  }

  // Extract to_token
  if (decoded.to_token && decoded.to_token.fields && decoded.to_token.fields.bytes) {
    toToken = bytesToString(decoded.to_token.fields.bytes);
  } else if (typeof decoded.to_token === "string") {
    toToken = decoded.to_token;
  }

  // Use includes() for more flexible matching, similar to the working example in cellana.ts
  const isFromUsdc = fromToken.includes(CELLANA_USDC_TOKEN_ID);
  const isToApt = toToken.includes(CELLANA_APT_IDENTIFIER);
  const isFromApt = fromToken.includes(CELLANA_APT_IDENTIFIER);
  const isToUsdc = toToken.includes(CELLANA_USDC_TOKEN_ID);

  const isAptBought = isFromUsdc && isToApt;
  const isAptSold = isFromApt && isToUsdc;

  const amount_in = decoded.amount_in;
  const amount_out = decoded.amount_out;

  let aptAmount, usdcAmount;

  if (isAptBought) {
    usdcAmount = amount_in / Math.pow(10, USDC_DECIMALS);
    aptAmount = amount_out / Math.pow(10, APT_DECIMALS);
  } else if (isAptSold) {
    aptAmount = amount_in / Math.pow(10, APT_DECIMALS);
    usdcAmount = amount_out / Math.pow(10, USDC_DECIMALS);
  } else {
    aptAmount = 0;
    usdcAmount = 0;
  }

  const price = aptAmount > 0 ? usdcAmount / aptAmount : 0;

  // Update Cellana volume
  cellanaVolume += usdcAmount;

  const version = event.block_number;
  const logIndex = event.log_index || "0x0";
  const latency = calculateLatency(event.timestamp, event.receivedAt);
  const timestamp = new Date(Math.floor(event.timestamp / 1000)).toLocaleString();

  const poolEvent: PoolEvent = {
    type: "Swap",
    direction: isAptBought ? "BUY" : isAptSold ? "SELL" : "UNKNOWN",
    aptAmount,
    usdcAmount,
    price,
    version,
    logIndex,
    timestamp,
    latency,
    txHash: event.transaction_hash || "unknown",
  };

  cellanaState.recentEvents.unshift(poolEvent);
  if (cellanaState.recentEvents.length > 10) {
    cellanaState.recentEvents.pop();
  }

  // Update current price
  cellanaState.currentPrice = calculateCurrentPrice(cellanaState);

  const unifiedEvent: UnifiedEvent = {
    ...poolEvent,
    source: "Cellana",
  };

  latestSwapEvent = unifiedEvent;

  // Update spread history
  const currentSpread = calculatePriceSpread(thalaswapState, cellanaState);
  spreadHistory = [...spreadHistory.slice(1), currentSpread / 100]; // Convert to decimal for UI
}

function processCellanaSyncEvent(event: PangeaEvent): void {
  const decoded = typeof event.decoded === "string" ? JSON.parse(event.decoded) : event.decoded;

  // Check if pool field exists - early exit if not
  if (!decoded.pool) {
    return;
  }

  // Check if this is the APT/USDC pool we're interested in - early exit if not
  // Normalize pool IDs for comparison by removing 0x prefix and converting to lowercase
  const normalizedEventPoolId = (decoded.pool || "").toString().toLowerCase().replace(/^0x/, "");
  const normalizedExpectedPoolId = CELLANA_APT_USDC_POOL_ID.toLowerCase().replace(/^0x/, "");

  if (normalizedEventPoolId !== normalizedExpectedPoolId) {
    return;
  }

  const reserves1 = decoded.reserves_1;
  const reserves2 = decoded.reserves_2;

  // As per original cellana.ts: reserves_1 is USDC and reserves_2 is APT
  cellanaState.usdcBalance =
    typeof reserves1 === "string" && reserves1.startsWith("0x")
      ? parseInt(reserves1, 16)
      : Number(reserves1);

  cellanaState.aptBalance =
    typeof reserves2 === "string" && reserves2.startsWith("0x")
      ? parseInt(reserves2, 16)
      : Number(reserves2);

  cellanaState.currentPrice = calculateCurrentPrice(cellanaState);

  // Update spread history
  const currentSpread = calculatePriceSpread(thalaswapState, cellanaState);
  spreadHistory = [...spreadHistory.slice(1), currentSpread / 100]; // Convert to decimal for UI
}

function processThalaAddLiquidityEvent(event: PangeaEvent): void {
  const decoded = typeof event.decoded === "string" ? JSON.parse(event.decoded) : event.decoded;

  if (decoded.pool_obj.fields.inner !== THALA_APT_USDC_POOL_ID) {
    return;
  }

  thalaswapState.aptBalance = decoded.pool_balances[0];
  thalaswapState.usdcBalance = decoded.pool_balances[1];
  thalaswapState.currentPrice = calculateCurrentPrice(thalaswapState);

  // Update spread history
  const currentSpread = calculatePriceSpread(thalaswapState, cellanaState);
  spreadHistory = [...spreadHistory.slice(1), currentSpread / 100]; // Convert to decimal for UI
}

function processThalaRemoveLiquidityEvent(event: PangeaEvent): void {
  const decoded = typeof event.decoded === "string" ? JSON.parse(event.decoded) : event.decoded;

  if (decoded.pool_obj.fields.inner !== THALA_APT_USDC_POOL_ID) {
    return;
  }

  thalaswapState.aptBalance = decoded.pool_balances[0];
  thalaswapState.usdcBalance = decoded.pool_balances[1];
  thalaswapState.currentPrice = calculateCurrentPrice(thalaswapState);

  // Update spread history
  const currentSpread = calculatePriceSpread(thalaswapState, cellanaState);
  spreadHistory = [...spreadHistory.slice(1), currentSpread / 100]; // Convert to decimal for UI
}

function processCellanaAddLiquidityEvent(event: PangeaEvent): void {
  const decoded = typeof event.decoded === "string" ? JSON.parse(event.decoded) : event.decoded;

  // Check if pool field exists - early exit if not
  if (!decoded.pool) {
    return;
  }

  // Check if this is the APT/USDC pool we're interested in - early exit if not
  // Normalize pool IDs for comparison
  const normalizedEventPoolId = (decoded.pool || "").toString().toLowerCase().replace(/^0x/, "");
  const normalizedExpectedPoolId = CELLANA_APT_USDC_POOL_ID.toLowerCase().replace(/^0x/, "");

  if (normalizedEventPoolId !== normalizedExpectedPoolId) {
    return;
  }

  // We rely on SyncEvent to update pool balances
  // This is just to update the spread history
  const currentSpread = calculatePriceSpread(thalaswapState, cellanaState);
  spreadHistory = [...spreadHistory.slice(1), currentSpread / 100]; // Convert to decimal for UI
}

function processCellanaRemoveLiquidityEvent(event: PangeaEvent): void {
  const decoded = typeof event.decoded === "string" ? JSON.parse(event.decoded) : event.decoded;

  // Check if pool field exists - early exit if not
  if (!decoded.pool) {
    return;
  }

  // Check if this is the APT/USDC pool we're interested in - early exit if not
  // Normalize pool IDs for comparison
  const normalizedEventPoolId = (decoded.pool || "").toString().toLowerCase().replace(/^0x/, "");
  const normalizedExpectedPoolId = CELLANA_APT_USDC_POOL_ID.toLowerCase().replace(/^0x/, "");

  if (normalizedEventPoolId !== normalizedExpectedPoolId) {
    return;
  }

  // We rely on SyncEvent to update pool balances
  // This is just to update the spread history
  const currentSpread = calculatePriceSpread(thalaswapState, cellanaState);
  spreadHistory = [...spreadHistory.slice(1), currentSpread / 100]; // Convert to decimal for UI
}

function processEvent(event: PangeaEvent): void {
  // Increment event counter
  eventsProcessed++;

  // Record processing start time
  const processingStartTime = Date.now();

  // Calculate API latency (time between blockchain event and app receipt)
  lastApiLatency = calculateApiLatency(event.timestamp, event.receivedAt || processingStartTime);

  // Simple event source identification - direct address comparison
  const isThalaSwap = event.address === THALASWAP_ADDRESS;
  const isCellana = event.address === CELLANA_ADDRESS;

  // Early exit if not from a known DEX
  if (!isThalaSwap && !isCellana) {
    return;
  }

  // Process Cellana events
  if (isCellana) {
    // Early exit if not a supported event type
    if (!["SwapEvent", "SyncEvent", "AddLiquidityEvent", "RemoveLiquidityEvent"].includes(event.event_name)) {
      return;
    }

    // Process the event based on its type
    switch (event.event_name) {
      case "SwapEvent":
        processCellanaSwapEvent(event);
        break;
      case "SyncEvent":
        processCellanaSyncEvent(event);
        break;
      case "AddLiquidityEvent":
        processCellanaAddLiquidityEvent(event);
        break;
      case "RemoveLiquidityEvent":
        processCellanaRemoveLiquidityEvent(event);
        break;
    }
  }
  // Process ThalaSwap events
  else if (isThalaSwap) {
    switch (event.event_name) {
      case "SwapEvent":
        processThalaSwapEvent(event);
        break;
      case "AddLiquidityEvent":
        processThalaAddLiquidityEvent(event);
        break;
      case "RemoveLiquidityEvent":
        processThalaRemoveLiquidityEvent(event);
        break;
    }
  }

  // Record processing end time and calculate processing time and total latency
  const processingEndTime = Date.now();
  lastProcessingTime = calculateProcessingTime(processingStartTime, processingEndTime);
  lastTotalLatency = calculateTotalLatency(event.timestamp, processingEndTime);
}

// ---------- Snapshot Creation ----------
function createSnapshot(): Snapshot | null {
  // Check if we have valid price data from either DEX
  const hasThalaData = thalaswapState.currentPrice > 0;
  const hasCellanaData = cellanaState.currentPrice > 0;

  // If we don't have any swap event yet, but we have price data, create a mock swap event
  if (!latestSwapEvent) {
    if (hasThalaData || hasCellanaData) {
      // Use data from whichever DEX has valid price data
      const source = hasThalaData ? "ThalaSwap" : "Cellana";
      const price = hasThalaData ? thalaswapState.currentPrice : cellanaState.currentPrice;

      latestSwapEvent = {
        type: "Swap",
        direction: "BUY",
        aptAmount: 0,
        usdcAmount: 0,
        price,
        version: "0x0",
        logIndex: "0x0",
        timestamp: new Date().toLocaleString(),
        latency: 0,
        txHash: "0x0000000000000000",
        source,
      };
    } else {
      return null;
    }
  }

  const swap: Swap = {
    dex: latestSwapEvent.source,
    side: latestSwapEvent.direction as "BUY" | "SELL",
    amount: latestSwapEvent.aptAmount,
    price: latestSwapEvent.price,
    usdc: latestSwapEvent.usdcAmount,
    hash: latestSwapEvent.txHash || "",
    latencyMs: latestSwapEvent.latency,
  };

  const depth = calculateDOMComparison([1000, 10000, 100000], thalaswapState, cellanaState).map((row: any) => ({
    amount: row.amount,
    thalaPrice: row.thalaPrice,
    thalaImp: row.thalaImpact / 100, // Convert to decimal for UI
    cellPrice: row.cellanaPrice,
    cellImp: row.cellanaImpact / 100, // Convert to decimal for UI
    spread: row.spread / 100, // Convert to decimal for UI
  }));

  // Create status object
  const status: PangeaStatus = {
    connected: isConnected,
    apiLatencyMs: lastApiLatency,
    processingTimeMs: lastProcessingTime,
    totalLatencyMs: lastTotalLatency,
    eventsProcessed: eventsProcessed,
    currentVersion: latestSwapEvent.version,
  };

  // Create volume data
  const totalVolume = thalaswapVolume + cellanaVolume;
  const thalaswapPercentage = totalVolume > 0 ? (thalaswapVolume / totalVolume) * 100 : 50;
  const cellanaPercentage = totalVolume > 0 ? (cellanaVolume / totalVolume) * 100 : 50;

  const volume: VolumeData = {
    thalaswapVolume,
    cellanaVolume,
    totalVolume,
    thalaswapPercentage,
    cellanaPercentage,
  };

  return {
    latestSwap: swap,
    spreadHistory,
    depth,
    status,
    volume,
  };
}

// ---------- Pangea Client Setup ----------
async function setupPangeaClient(): Promise<{
  client: any;
  handle: any;
}> {
  // Make sure Client is initialized
  if (!Client) {
    console.log("Waiting for pangea-client to initialize...");
    const pkg = await import("pangea-client");
    Client = pkg.default.Client;
    RequestFormats = pkg.default.RequestFormats;
  }

  const endpoint = (typeof process !== 'undefined' && process.env && process.env.PANGEA_URL) || "aptos.app.pangea.foundation";

  const client = await Client.build({
    endpoint,
  });

  // Set connection status to true once client is built
  isConnected = true;

  // Request parameters for both DEXes
  const requestParams = {
    chains: "APTOS",
    from_block: "-10000",
    to_block: "none",
    address__in: [CELLANA_ADDRESS, THALASWAP_ADDRESS],
    event_name__in: [
      "SwapEvent",
      "AddLiquidityEvent",
      "RemoveLiquidityEvent",
      "SyncEvent",
    ],
  };

  const handle = await client.get_logs_decoded(
    requestParams,
    RequestFormats.JSON_STREAM,
  );

  return { client, handle };
}

// ---------- Data Stream ----------
async function* stream(): AsyncGenerator<Snapshot> {
  const { client, handle } = await setupPangeaClient();

  try {
    for await (const chunk of handle) {
      // Set receivedAt timestamp once for the entire chunk
      const chunkReceivedAt = Date.now();
      const lines = chunk.toString().split("\n").filter(Boolean);

      // Process all events in the chunk with the same receivedAt timestamp
      lines.forEach((line: string) => {
        let log: PangeaEvent = JSON.parse(line);

        if (typeof log.decoded === "string") {
          try {
            log.decoded = JSON.parse(log.decoded);
          } catch (e) {
            // Silently handle parsing errors
          }
        }

        log.receivedAt = chunkReceivedAt;
        processEvent(log);
      });

      // Try to create a snapshot with the current data
      const snapshot = createSnapshot();

      // Always yield a snapshot, even if we don't have swap events yet
      // This ensures the UI always shows the latest data
      if (snapshot) {
        yield snapshot;
      } else {
        // If createSnapshot returned null, create a basic snapshot with status info
        // Check if we have any price data to show
        const hasThalaPrice = thalaswapState.currentPrice > 0;
        const hasCellanaPrice = cellanaState.currentPrice > 0;

        // Use actual prices if available
        const thalaPrice = hasThalaPrice ? thalaswapState.currentPrice : 0;
        const cellanaPrice = hasCellanaPrice ? cellanaState.currentPrice : 0;

        // Calculate spread if both prices are available
        const spread = (hasThalaPrice && hasCellanaPrice)
          ? calculatePriceSpread(thalaswapState, cellanaState) / 100
          : 0;

        yield {
          latestSwap: {
            dex: hasThalaPrice ? "ThalaSwap" : "Cellana", // Default to Cellana if no ThalaSwap price
            side: "BUY",
            amount: 0,
            price: hasThalaPrice ? thalaPrice : cellanaPrice,
            usdc: 0,
            hash: "0x0000000000000000",
            latencyMs: 0,
          },
          spreadHistory: [...spreadHistory.slice(1), spread],
          depth: [1000, 10000, 100000].map((a) => ({
            amount: a,
            thalaPrice: thalaPrice,
            thalaImp: 0,
            cellPrice: cellanaPrice,
            cellImp: 0,
            spread: spread,
          })),
          status: {
            connected: isConnected,
            apiLatencyMs: lastApiLatency,
            processingTimeMs: lastProcessingTime,
            totalLatencyMs: lastTotalLatency,
            eventsProcessed: eventsProcessed,
            currentVersion: "0x0", // No events yet
          },
          volume: {
            thalaswapVolume,
            cellanaVolume,
            totalVolume: thalaswapVolume + cellanaVolume,
            thalaswapPercentage: thalaswapVolume > 0 || cellanaVolume > 0
              ? (thalaswapVolume / (thalaswapVolume + cellanaVolume)) * 100
              : 50,
            cellanaPercentage: thalaswapVolume > 0 || cellanaVolume > 0
              ? (cellanaVolume / (thalaswapVolume + cellanaVolume)) * 100
              : 50,
          },
        };
      }

      // No delay between processing chunks to prevent event queuing
    }
  } finally {
    isConnected = false;
    client.disconnect();
  }
}

// ---------- Main App ----------
const App = () => {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const { exit } = useApp();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for await (const s of stream()) {
        if (cancelled) break;
        setSnap(s);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = (c: string, key: { ctrl: boolean; name: string }) => {
      if (key.ctrl && key.name === "c") exit();
    };
    if (typeof process !== 'undefined' && process.stdin) {
      process.stdin.on("keypress", handler);
      return () => {
        process.stdin.off("keypress", handler);
      };
    }
    return () => {};
  }, [exit]);

  if (!snap) {
    return (
      <Gradient name="pastel">
        <BigText text="Loading…" />
      </Gradient>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Row 1 - Left: status */}
      <Box>
        <Box flexGrow={1}>
          <PangeaStatusComponent status={snap.status} />
        </Box>
      </Box>

      {/* Row 2 and 3 with explicit layout for alignment */}
      <Box flexDirection="column">
        {/* Row 2 */}
        <Box>
          <Box width={85} marginRight={2}>
            <SwapPanel swap={snap.latestSwap} />
          </Box>
          <VolumePanel volume={snap.volume} />
        </Box>

        {/* Row 3 */}
        <Box>
          <Box width={85} marginRight={2}>
            <DepthPanel rows={snap.depth} />
          </Box>
          <Box>
            <SpreadPanel history={snap.spreadHistory} />
          </Box>
          <Box marginLeft={2}>
            <LiquidityPane thalaswapState={thalaswapState} cellanaState={cellanaState} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default App;
