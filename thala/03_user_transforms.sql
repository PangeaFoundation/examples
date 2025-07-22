-- Process pools table updates for batch
INSERT INTO pools (
        pool_address,
        timestamp,
        token0_name,
        token0_symbol,
        token0_decimals,
        token1_name,
        token1_symbol,
        token1_decimals,
        initial_amounts_0,
        initial_amounts_1,
        normalized_initial_amounts_0,
        normalized_initial_amounts_1,
        pool_type,
        swap_fee_bps,
        locked,
        amp_factor,
        precision_multiplier_0,
        precision_multiplier_1,
        weight_0,
        weight_1,
        pool_category
    ) WITH token_decimals AS (
        -- Use ROW_NUMBER to explicitly pick one decimal value per token address
        SELECT address,
            decimals,
            name,
            symbol
        FROM (
                -- Prioritize FA tokens (higher priority = 1)
                SELECT address,
                    decimals,
                    name,
                    symbol,
                    1 as priority
                FROM aptos_fa_tokens
                WHERE decimals != 0
                UNION ALL
                -- Coins as backup (lower priority = 2)
                SELECT from_hex(SUBSTR(SPLIT_PART(address, '::', 1), 3)) as address,
                    decimals,
                    name,
                    symbol,
                    2 as priority
                FROM aptos_coins
                WHERE decimals != 0
            ) ranked QUALIFY ROW_NUMBER() OVER (
                PARTITION BY address
                ORDER BY priority
            ) = 1
    )
SELECT DISTINCT pool_creation_events.pool_address,
    pool_creation_events.timestamp as timestamp,
    token0.name AS token0_name,
    token0.symbol AS token0_symbol,
    token0.decimals AS token0_decimals,
    token1.name AS token1_name,
    token1.symbol AS token1_symbol,
    token1.decimals AS token1_decimals,
    pool_creation_events.amounts_0 as initial_amounts_0,
    pool_creation_events.amounts_1 as initial_amounts_1,
    -- Normalized initial amounts using decimals
    pool_creation_events.amounts_0::DOUBLE / POW(10, token0.decimals) as normalized_initial_amounts_0,
    pool_creation_events.amounts_1::DOUBLE / POW(10, token1.decimals) as normalized_initial_amounts_1,
    -- Pool configuration from pool_receipts
    pr.pool_type,
    pr.swap_fee_bps,
    pr.locked,
    -- StablePool specific data
    spr.amp_factor,
    spr.precision_multiplier_0,
    spr.precision_multiplier_1,
    -- WeightedPool specific data
    wpr.weight_0,
    wpr.weight_1,
    -- Pool type classification
    CASE
        WHEN spr.stable_pool_address IS NOT NULL THEN 'StablePool'
        WHEN wpr.weighted_pool_address IS NOT NULL THEN 'WeightedPool'
        ELSE 'StandardPool'
    END as pool_category
FROM pool_creation_events
    INNER JOIN token_decimals AS token0 ON pool_creation_events.token_0_address = token0.address
    INNER JOIN token_decimals AS token1 ON pool_creation_events.token_1_address = token1.address
    LEFT JOIN pool_receipts pr ON pool_creation_events.pool_address = pr.pool_address
    LEFT JOIN stable_pool_receipts spr ON pool_creation_events.pool_address = spr.stable_pool_address
    LEFT JOIN weighted_pool_receipts wpr ON pool_creation_events.pool_address = wpr.weighted_pool_address
WHERE pool_creation_events.block_number BETWEEN __FROM_BLOCK__ AND __TO_BLOCK__ ON CONFLICT (pool_address) DO
UPDATE
SET timestamp = EXCLUDED.timestamp,
    token0_name = EXCLUDED.token0_name,
    token0_symbol = EXCLUDED.token0_symbol,
    token0_decimals = EXCLUDED.token0_decimals,
    token1_name = EXCLUDED.token1_name,
    token1_symbol = EXCLUDED.token1_symbol,
    token1_decimals = EXCLUDED.token1_decimals,
    initial_amounts_0 = EXCLUDED.initial_amounts_0,
    initial_amounts_1 = EXCLUDED.initial_amounts_1,
    normalized_initial_amounts_0 = EXCLUDED.normalized_initial_amounts_0,
    normalized_initial_amounts_1 = EXCLUDED.normalized_initial_amounts_1,
    pool_type = EXCLUDED.pool_type,
    swap_fee_bps = EXCLUDED.swap_fee_bps,
    locked = EXCLUDED.locked,
    amp_factor = EXCLUDED.amp_factor,
    precision_multiplier_0 = EXCLUDED.precision_multiplier_0,
    precision_multiplier_1 = EXCLUDED.precision_multiplier_1,
    weight_0 = EXCLUDED.weight_0,
    weight_1 = EXCLUDED.weight_1,
    pool_category = EXCLUDED.pool_category;
-- Process prices table updates for batch (complex with normalized calculations)
INSERT INTO prices (
        chain,
        block_number,
        block_hash,
        transaction_index,
        transaction_hash,
        log_index,
        timestamp,
        address,
        pool_address,
        token_0_address,
        token_1_address,
        traded_price,
        mid_price,
        normalized_amount_in,
        normalized_amount_out,
        normalized_balance_0,
        normalized_balance_1,
        token0_decimals,
        token1_decimals,
        direction,
        idx_in,
        idx_out,
        amount_in,
        amount_out,
        total_fee_amount,
        protocol_fee_amount,
        pool_balance_0,
        pool_balance_1,
        token0_name,
        token1_name,
        pool_category,
        weight_0,
        weight_1
    ) WITH normalized_swaps AS (
        SELECT s.*,
            -- Get decimals and pool info from pools view
            p.token0_decimals,
            p.token1_decimals,
            p.token0_name,
            p.token1_name,
            p.pool_category,
            p.weight_0,
            p.weight_1,
            -- Normalize amounts using decimals
            s.amount_in::DOUBLE / POW(
                10,
                CASE
                    WHEN s.idx_in = 0 THEN p.token0_decimals
                    ELSE p.token1_decimals
                END
            ) as normalized_amount_in,
            s.amount_out::DOUBLE / POW(
                10,
                CASE
                    WHEN s.idx_out = 0 THEN p.token0_decimals
                    ELSE p.token1_decimals
                END
            ) as normalized_amount_out,
            s.pool_balance_0::DOUBLE / POW(10, p.token0_decimals) as normalized_balance_0,
            s.pool_balance_1::DOUBLE / POW(10, p.token1_decimals) as normalized_balance_1
        FROM swap_events s
            INNER JOIN pools p ON s.pool_address = p.pool_address
        WHERE s.block_number BETWEEN __FROM_BLOCK__ AND __TO_BLOCK__
    )
SELECT chain,
    block_number,
    block_hash,
    transaction_index,
    transaction_hash,
    log_index,
    timestamp,
    address,
    pool_address,
    token_0_address,
    token_1_address,
    -- Human-readable price calculations
    CASE
        WHEN idx_in = 0 THEN -- BUY token_0 with token_1: price = token_1_amount / token_0_amount
        CASE
            WHEN normalized_amount_in = 0 THEN NULL
            ELSE normalized_amount_out / normalized_amount_in
        END
        ELSE -- SELL token_0 for token_1: price = token_1_amount / token_0_amount
        CASE
            WHEN normalized_amount_out = 0 THEN NULL
            ELSE normalized_amount_in / normalized_amount_out
        END
    END as traded_price,
    CASE
        WHEN normalized_balance_1 = 0 THEN NULL
        WHEN pool_category = 'WeightedPool'
        AND weight_0 > 0
        AND weight_1 > 0 THEN -- Weighted pool adjusted price: (balance_0 * weight_1) / (balance_1 * weight_0)
        1 / (
            (normalized_balance_0 * weight_1::DOUBLE) / (normalized_balance_1 * weight_0::DOUBLE)
        )
        ELSE 1 / (normalized_balance_0 / normalized_balance_1)
    END as mid_price,
    -- Additional useful fields
    normalized_amount_in,
    normalized_amount_out,
    normalized_balance_0,
    normalized_balance_1,
    token0_decimals,
    token1_decimals,
    CASE
        WHEN idx_in = 0 THEN 'BUY'
        ELSE 'SELL'
    END as direction,
    -- All original swap event data
    idx_in,
    idx_out,
    amount_in,
    amount_out,
    total_fee_amount,
    protocol_fee_amount,
    pool_balance_0,
    pool_balance_1,
    token0_name,
    token1_name,
    pool_category,
    weight_0,
    weight_1
FROM normalized_swaps ON CONFLICT DO NOTHING;