-- Speed up nightly subscription expiry sweep (status + period_end filter).
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period_end
    ON subscriptions (status, period_end)
    WHERE status IN ('active', 'past_due');
