// types.ts
export type Swap = {
  dex: "Cellana" | "ThalaSwap";
  side: "BUY" | "SELL";
  amount: number;
  price: number;
  usdc: number;
  hash: string;
  latencyMs: number;
};

export type DepthRow = {
  amount: number;
  thalaPrice: number;
  thalaImp: number;
  cellPrice: number;
  cellImp: number;
  spread: number;
};

export type PangeaStatus = {
  connected: boolean;
  apiLatencyMs: number; // Time between blockchain event and app receipt
  processingTimeMs: number; // Time to process the event
  totalLatencyMs: number; // Total end-to-end latency
  eventsProcessed: number;
  currentVersion?: string; // Current blockchain version (block number)
};

export type VolumeData = {
  thalaswapVolume: number;
  cellanaVolume: number;
  totalVolume: number;
  thalaswapPercentage: number;
  cellanaPercentage: number;
};

export type Snapshot = {
  latestSwap: Swap;
  spreadHistory: number[];
  depth: DepthRow[];
  status: PangeaStatus;
  volume: VolumeData;
};

export interface PoolEvent {
  type: "Swap" | "Add Liquidity" | "Remove Liquidity";
  aptAmount: number;
  usdcAmount: number;
  price: number;
  version: string;
  logIndex: string;
  timestamp: string;
  latency: number;
  direction?: string;
  txHash?: string;
}

export interface UnifiedEvent extends PoolEvent {
  source: "ThalaSwap" | "Cellana";
}

export interface PoolState {
  aptBalance: number;
  usdcBalance: number;
  recentEvents: PoolEvent[];
  currentPrice: number;
}

export interface PangeaEvent {
  decoded: any;
  block_number: string;
  log_index: string;
  timestamp: number;
  event_name: string;
  receivedAt?: number;
  transaction_hash?: string;
  address?: string;
  module?: string;
}
