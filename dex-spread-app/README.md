# DEX Comparison App

A terminal-based application that compares swap events, prices, and depth of market between ThalaSwap and Cellana DEXs on the Aptos blockchain.

## Features

- Real-time streaming of swap events from both DEXs
- Visual comparison of price spreads with history graph
- Depth of Market (DOM) analysis showing price impacts at different trade sizes
- Beautiful terminal UI using Ink (React for the terminal)

## Installation

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Run the application
npm start
```

## Development

This application is built with:

- TypeScript
- React
- Ink (React for terminal)
- Pangea Client (for blockchain event streaming)

### Project Structure

- `source/App.tsx` - Main application component
- `source/cli.tsx` - CLI entry point
- `source/types.ts` - Type definitions
- `source/constants.ts` - Constants for DEX addresses and token IDs
- `source/utils.ts` - Utility functions
- `source/components/` - UI components

### Components

- `SwapPanel` - Displays the latest swap event with fixed-width layout to prevent UI shifting
- `SpreadPanel` - Shows the price spread between DEXs with history
- `DepthPanel` - Displays depth of market comparison
- `VolumePanel` - Shows trading volume statistics for both DEXs with percentage visualization
- `LiquidityPane` - Displays liquidity information for both DEXs
- `PangeaStatus` - Shows connection status and detailed latency metrics

## Usage

The application will automatically connect to the Pangea API and start streaming events from both DEXs. The UI will update in real-time as new events are received.

Press `Ctrl+C` to exit the application.

## Environment Variables

- `PANGEA_URL` - URL of the Pangea API (default: "aptos.app.pangea.foundation")
