-- Production hardening: indexes for FK columns and hot query paths (Section 1).

-- applications: soft-delete admin queries + list ordering
CREATE INDEX IF NOT EXISTS idx_apps_user_deleted
    ON applications (user_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_apps_user_applied_desc
    ON applications (user_id, applied_date DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_apps_resume_id
    ON applications (resume_id)
    WHERE resume_id IS NOT NULL;

-- notifications: list by created_at (existing idx is user_id + is_read)
CREATE INDEX IF NOT EXISTS idx_notif_user_created
    ON notifications (user_id, created_at DESC);

-- ai_interactions: admin cost rollup by date
CREATE INDEX IF NOT EXISTS idx_ai_created_at
    ON ai_interactions (created_at DESC);

-- application_outcomes: score engine batch fetch
CREATE INDEX IF NOT EXISTS idx_outcomes_user_app
    ON application_outcomes (user_id, application_id);

-- career_health_scores: stale job batch
CREATE INDEX IF NOT EXISTS idx_scores_stale
    ON career_health_scores (is_stale)
    WHERE is_stale = TRUE;
