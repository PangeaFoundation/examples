// constants.ts

// Constants for both DEXs
export const THALASWAP_ADDRESS =
  "0x007730cd28ee1cdc9e999336cbc430f99e7c44397c0aa77516f6f23a78559bb5";
export const CELLANA_ADDRESS =
  "0x4bf51972879e3b95c4781a5cdcb9e1ee24ef483e7d22f2d903626f126df62bd1";

// ThalaSwap constants
export const THALA_APT_USDC_POOL_ID =
  "a928222429caf1924c944973c2cd9fc306ec41152ba4de27a001327021a4dff7";
export const THALA_APT_TOKEN_ID =
  "000000000000000000000000000000000000000000000000000000000000000a";
export const THALA_USDC_TOKEN_ID =
  "bae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";

// Cellana constants
export const CELLANA_APT_USDC_POOL_ID =
  "0x71c6ae634bd3c36470eb7e7f4fb0912973bb31543dfdb7d7fb6863d886d81d67";
export const CELLANA_USDC_TOKEN_ID =
  "bae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";
export const CELLANA_APT_IDENTIFIER = "aptos_coin::AptosCoin";

// Byte arrays for direct comparison (optimization)
export const CELLANA_USDC_TOKEN_BYTES = [
  98, 97, 101, 50, 48, 55, 54, 53, 57, 100, 98, 56, 56, 98, 101, 97, 48, 99, 98,
  101, 97, 100, 54, 100, 97, 48, 101, 100, 48, 48, 97, 97, 99, 49, 50, 101, 100,
  99, 100, 100, 97, 49, 54, 57, 101, 53, 57, 49, 99, 100, 52, 49, 99, 57, 52,
  49, 56, 48, 98, 52, 54, 102, 51, 98,
];
export const CELLANA_APT_IDENTIFIER_BYTES = [
  97, 112, 116, 111, 115, 95, 99, 111, 105, 110, 58, 58, 65, 112, 116, 111, 115,
  67, 111, 105, 110,
];
// Decimal constants
export const APT_DECIMALS = 8;
export const USDC_DECIMALS = 6;
