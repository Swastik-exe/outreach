-- Supplementary indexes not covered in V1/V3 (usage_quotas lookup, forwarding address resolve).

CREATE INDEX IF NOT EXISTS idx_quotas_user_metric
    ON usage_quotas (user_id, metric);

CREATE INDEX IF NOT EXISTS idx_forwarding_address
    ON forwarding_addresses (address);
