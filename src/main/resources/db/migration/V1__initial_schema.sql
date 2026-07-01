-- =====================================================================
-- OutreachOS X  --  V1__initial_schema.sql   (CORRECTED)
-- Flyway forward migration. Target: PostgreSQL (Supabase).
-- Place in: src/main/resources/db/migration/
-- Rollback:  U1__initial_schema.sql  (provided separately)
--
-- This is the Build Companion schema with every Section I correction from
-- the Final Audit folded in. Each change is tagged to its finding.
--
-- CHANGES vs the original draft:
--   D1  removed 'follow_up_due' from app_status (it corrupted the state machine)
--   C1  applications.company_canonical + role_canonical, dedup keyed on these
--   C3  users.notif_channel default -> 'in_app'  (+ explicit no-channel handling)
--   C4  applications.deleted_at  (SOFT DELETE; timeline + outcomes preserved)
--   C5  user_skills.source + scoring note (don't reward unverified self-report)
--   C6  subscriptions.razorpay_order_id (one-time pass != recurring subscription)
--   C9  email_verification_tokens + password_reset_tokens tables
--   D2  cohort_stats.score_histogram (so "top 30%" is actually computable)
--   D4  cgpa_bonus -> cgpa_component  (a component WITHIN 1000, never additive)
--   D7  career_health_scores.is_stale (dirty-user recalculation)
--   D8  partial unique index: exactly one active resume per user
--   D11 user_sessions.is_active + rotated_to (refresh-token reuse detection)
--   D13 subscription expiry documented as lazy (compare period_end to now)
--   D14 usage_quotas.resets_at declared the single reset source of truth
--   D15 payment webhook ordering documented (insert-then-activate, one tx)
--   E2  users.ai_processing_consent_at (resume PII goes to 3rd-party AI)
--   E3  inbound_email_drafts.created_at indexed for the TTL purge job
--   E5  forwarding_addresses.address = long random token (app-generated)
--   F7  ai_model_pricing table (so AI cost numbers don't drift)
--   H2/H3/H4 analytics + device_fingerprint + trust_score annotated
--   BONUS (found while building): cgpa widened to DECIMAL(4,2) — DECIMAL(3,2)
--         cannot store a perfect 10.00 CGPA and would throw on insert.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------- shared updated_at trigger (D6) ----------
-- DEFAULT NOW() only fires on INSERT. Without this, updated_at never changes
-- on UPDATE. Attach the trigger to every table that has an updated_at column.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- ENUMS ----------
CREATE TYPE auth_provider AS ENUM ('local','google','github');
CREATE TYPE plan_tier     AS ENUM ('free','pass_holder','premium','admin');

-- D1: 'follow_up_due' REMOVED. Follow-up is derived, not a status:
--     current_status = 'applied' AND next_action_due < now().
--     Putting it in the enum overwrote the real stage.
CREATE TYPE app_status AS ENUM (
  'applied','pending_oa','oa_submitted','interview_scheduled','interview_done',
  'technical_round','hr_round','shortlisted','offer_received','offer_accepted',
  'offer_declined','rejected','ghosted','withdrawn'
);

CREATE TYPE app_source AS ENUM ('manual','forwarded_email');
CREATE TYPE sub_status AS ENUM ('active','expired','cancelled','past_due');

-- ---------- USERS ----------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  auth_provider auth_provider NOT NULL DEFAULT 'local',
  -- C8: on OAuth callback, MATCH on email and LINK the provider to the existing
  --     user — never insert a second row for the same email. For Google + GitHub
  --     on one account, promote this to a user_identities table later.
  provider_id VARCHAR(255),
  plan_tier plan_tier NOT NULL DEFAULT 'free',
  is_email_verified BOOLEAN DEFAULT FALSE,
  is_suspended BOOLEAN DEFAULT FALSE,
  -- H4: trust_score is not wired to any feature yet. Drive fraud logic from it
  --     or drop it. Left, defaulted, pending that decision.
  trust_score INT DEFAULT 50,
  -- H3: "last seen" fingerprint only. device_registry is the source of truth
  --     for multi-device. This is a convenience cache, not the real picture.
  device_fingerprint VARCHAR(255),
  -- C3: default in_app. Switch to 'whatsapp' ONLY after a verified number AND
  --     opt-in (whatsapp_opt_in_at). "no valid channel" is an explicit error,
  --     never a silent skip.
  notif_channel VARCHAR(20) DEFAULT 'in_app',   -- in_app | email | whatsapp
  whatsapp_number VARCHAR(20),
  whatsapp_opt_in_at TIMESTAMPTZ,
  consent_at TIMESTAMPTZ,
  -- E2: explicit consent that resume PII is sent to 3rd-party AI providers.
  ai_processing_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()       -- set in the app on activity
);
CREATE INDEX idx_users_email ON users(email);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- SESSIONS (refresh tokens) ----------
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL,
  -- D11: reuse detection. On rotation, set is_active=FALSE and rotated_to=new id.
  --      If an inactive/rotated token is presented again -> reuse -> invalidate
  --      the whole session family. Tolerate brief races with a short grace window.
  is_active BOOLEAN DEFAULT TRUE,
  rotated_to UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  device_info JSONB,
  ip_address VARCHAR(45),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_user  ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(refresh_token_hash);

-- ---------- EMAIL VERIFICATION + PASSWORD RESET (C9) ----------
-- Store the HASH of the token, never the raw token. Single-use + expiring.
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_evt_user ON email_verification_tokens(user_id);

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_prt_user ON password_reset_tokens(user_id);

-- ---------- PROFILE ----------
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  full_name VARCHAR(255),
  -- D3: target_role/target_domain MUST map to a controlled taxonomy (a fixed
  --     dropdown list) so cohort_key doesn't fragment into sub-20 cohorts.
  target_role VARCHAR(120),
  target_domain VARCHAR(120),
  cohort_key VARCHAR(160),        -- canonical e.g. 'backend|2026', derived from the list
  graduation_year INT,
  college_name VARCHAR(255),
  branch VARCHAR(120),
  cgpa DECIMAL(4,2),              -- BONUS FIX: was DECIMAL(3,2); 10.00 would overflow
  github_username VARCHAR(120),
  linkedin_url VARCHAR(400),
  location VARCHAR(160),
  github_connected BOOLEAN DEFAULT FALSE,
  github_data JSONB,
  github_last_fetched TIMESTAMPTZ,
  profile_completeness_pct INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_profiles_cohort ON user_profiles(cohort_key);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE user_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  skill_name VARCHAR(100) NOT NULL,
  proficiency SMALLINT DEFAULT 1 CHECK (proficiency BETWEEN 1 AND 5),
  -- C5: self-reported proficiency is gameable. Let scoring weight corroborated
  --     skills (resume/github) above pure self-report.
  source VARCHAR(40),             -- self_reported | resume | github
  UNIQUE(user_id, skill_name)
);

-- ---------- RESUMES ----------
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) DEFAULT 'My Resume',
  version INT DEFAULT 1,
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  raw_text TEXT,
  parsed_data JSONB DEFAULT '{}',
  target_role VARCHAR(120),
  readiness_score INT,
  keyword_score INT,
  impact_score INT,
  formatting_score INT,
  keyword_gaps TEXT[] DEFAULT '{}',
  ai_fixes JSONB DEFAULT '[]',
  analysis_status VARCHAR(30) DEFAULT 'pending',  -- pending|processing|done|done_basic|failed
  analysis_source VARCHAR(20) DEFAULT 'ai',       -- ai|rule_based
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ
);
-- D8: exactly ONE active resume per user. Deactivate the old one in the SAME
--     transaction as activating a new one.
CREATE UNIQUE INDEX idx_one_active_resume ON resumes(user_id) WHERE is_active;

-- ---------- CAREER HEALTH SCORE ----------
CREATE TABLE career_health_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  overall_score INT DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 1000),
  resume_score INT DEFAULT 0,
  applications_score INT DEFAULT 0,
  skills_score INT DEFAULT 0,
  profile_score INT DEFAULT 0,
  github_score INT DEFAULT 0,
  -- D4: CGPA is a COMPONENT WITHIN the 1000 ceiling, NOT an additive bonus.
  --     All components sum to <= 1000 on EVERY branch (incl. GitHub
  --     redistribution, which scales the remaining components so a maxed
  --     profile hits 1000 with or without GitHub). Unit-test: score <= 1000.
  cgpa_component INT DEFAULT 0,
  github_weight_redistributed BOOLEAN DEFAULT FALSE,
  breakdown JSONB DEFAULT '{}',
  next_action TEXT,
  band VARCHAR(30),
  weekly_delta INT DEFAULT 0,
  version INT DEFAULT 0,           -- optimistic lock. D10: retry 2-3x on conflict.
  -- D7: dirty-user recalculation. Set TRUE on any score-relevant data change;
  --     the daily job processes only is_stale=TRUE, then clears the flag.
  is_stale BOOLEAN DEFAULT TRUE,
  last_computed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_scores_stale ON career_health_scores(is_stale) WHERE is_stale;

CREATE TABLE career_health_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  overall_score INT,
  recorded_date DATE NOT NULL,
  -- D5: the daily snapshot uses
  --     INSERT ... ON CONFLICT (user_id, recorded_date) DO UPDATE
  --     SET overall_score = EXCLUDED.overall_score;
  --     This unique constraint is what makes the upsert work.
  UNIQUE(user_id, recorded_date)
);
CREATE INDEX idx_history_user_date ON career_health_history(user_id, recorded_date DESC);

-- ---------- APPLICATIONS ----------
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company VARCHAR(255) NOT NULL,
  -- C1: canonical = lowercased, trimmed, suffixes stripped (LLC/India/Pvt/Inc).
  --     Real dedup runs on company_canonical via pg_trgm similarity + a +/-2 day
  --     window on applied_date + a "possible duplicate?" merge prompt. The UNIQUE
  --     below is only a backstop. Populate canonicals on every write.
  company_canonical VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  role_canonical VARCHAR(255) NOT NULL,
  source app_source DEFAULT 'manual',
  source_platform VARCHAR(120),
  job_url VARCHAR(500),
  applied_date DATE NOT NULL,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  current_status app_status DEFAULT 'applied',
  priority VARCHAR(10) DEFAULT 'medium',
  recruiter_name VARCHAR(255),
  recruiter_email VARCHAR(255),
  next_action TEXT,
  next_action_due TIMESTAMPTZ,    -- D1: drives the derived "follow-up due" flag
  response_latency_days INT,
  notes TEXT,
  -- C4: SOFT DELETE. Set deleted_at instead of deleting. Filter
  --     "deleted_at IS NULL" in every query. Preserves the immutable timeline
  --     (FR-4.4) and the outcome-loop data (FR-2.9) — your moat.
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_canonical, role_canonical, applied_date)
);
CREATE INDEX idx_apps_user_status ON applications(user_id, current_status)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_apps_company_trgm ON applications
  USING gin (company_canonical gin_trgm_ops);
CREATE INDEX idx_apps_followup ON applications(next_action_due)
  WHERE current_status = 'applied' AND deleted_at IS NULL;
CREATE TRIGGER trg_apps_updated BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE application_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- C4: CASCADE only fires on TRUE erasure (account / DPDP deletion). Normal
  --     "deletes" are soft, so the immutable timeline survives.
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  status app_status NOT NULL,
  notes TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(20) DEFAULT 'user'   -- user | system
);
CREATE INDEX idx_timeline_app ON application_timeline(application_id, occurred_at);

CREATE TABLE application_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- C4: same as timeline. Outcomes are your learning loop; never lost to a
  --     normal delete, only to a full account erasure.
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  outcome VARCHAR(40),            -- interview_got | offer_got | rejected_after_interview
  score_at_time INT,              -- snapshot of career score when logged (FR-2.9)
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_outcomes_user ON application_outcomes(user_id);

-- ---------- EMAIL FORWARDING INGESTION ----------
CREATE TABLE forwarding_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  -- E5: address = long random token (16+ char base32), app-generated, retried
  --     on the rare unique collision. NEVER sequential/guessable (it is semi-public).
  address VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inbound_email_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- C7: verify the mail provider's signature/token BEFORE this write. Add
  --     per-user inbound rate limiting + a draft cap (anti spam-dump).
  -- E3: raw_payload is third-party content. A TTL job MUST purge it shortly
  --     after confirm/discard (7-30 days). Keep parsed fields, drop the raw email.
  raw_payload JSONB,
  parsed_company VARCHAR(255),
  parsed_role VARCHAR(255),
  parsed_date DATE,
  confidence DECIMAL(4,3),        -- AI parse confidence; < 0.6 => flag for review
  status VARCHAR(20) DEFAULT 'pending_confirm',  -- pending_confirm|confirmed|discarded
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_drafts_user    ON inbound_email_drafts(user_id, status);
CREATE INDEX idx_drafts_created ON inbound_email_drafts(created_at);  -- supports TTL purge (E3)

-- ---------- COHORT STATS ----------
CREATE TABLE cohort_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_key VARCHAR(160) NOT NULL,
  cohort_size INT DEFAULT 0,      -- show band only when >= 20 (min-size guard)
  p25 INT, p50 INT, p75 INT, p90 INT,
  -- D2: p25/p50/p75/p90 give only ~5 coarse buckets — you CANNOT say "top 30%".
  --     Either reframe copy to these bands, OR use this histogram to compute the
  --     user's exact percentile at query time.
  score_histogram JSONB,          -- e.g. {"0-100":3,"101-200":7,...}
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cohort_key)
);

-- ---------- AI COST TRACKING ----------
CREATE TABLE ai_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  task_type VARCHAR(80) NOT NULL,
  provider VARCHAR(40),
  model VARCHAR(80),
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,   -- F7: computed from ai_model_pricing below
  latency_ms INT,
  cache_hit BOOLEAN DEFAULT FALSE,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ai_user ON ai_interactions(user_id, created_at DESC);

-- F7: per-model pricing source so the admin "AI cost today" stays accurate
--     when providers change their rates.
CREATE TABLE ai_model_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(40) NOT NULL,
  model VARCHAR(80) NOT NULL,
  input_per_1k_usd DECIMAL(10,6) NOT NULL,
  output_per_1k_usd DECIMAL(10,6) NOT NULL,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, model, effective_from)
);

-- ---------- USAGE QUOTAS ----------
CREATE TABLE usage_quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  metric VARCHAR(80) NOT NULL,    -- e.g. resume_analyses
  used INT DEFAULT 0,
  quota_limit INT NOT NULL,
  -- D14: ONE reset model. resets_at is the single source of truth (per-user
  --      lazy reset): when now() >= resets_at, set used=0 and roll resets_at
  --      forward. Do NOT also run a global monthly-1st reset job.
  -- C2:  decrement ATOMICALLY at request time, not on completion:
  --        UPDATE usage_quotas SET used = used + 1
  --         WHERE user_id=:u AND metric=:m AND used < quota_limit;
  --      rows-affected = 0  ->  reject 429. Refund on hard failure.
  resets_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, metric)
);

-- ---------- BILLING ----------
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  plan plan_tier NOT NULL,
  status sub_status NOT NULL DEFAULT 'active',
  is_season_pass BOOLEAN DEFAULT FALSE,
  amount_inr INT,
  -- C6: one-time Season Pass and recurring subscription are DIFFERENT Razorpay
  --     integrations with DIFFERENT webhook events. A pass uses razorpay_order_id
  --     (+ payment); a subscription uses razorpay_subscription_id. The
  --     WebhookController must handle BOTH event sets.
  razorpay_order_id VARCHAR(255),
  razorpay_subscription_id VARCHAR(255),
  razorpay_customer_id VARCHAR(255),
  period_start TIMESTAMPTZ,
  -- D13: EXPIRY IS LAZY. Compare period_end to now() on every access — a pass
  --      past period_end is expired even before any sweep flips its status.
  --      (Optional daily sweep sets status='expired' for reporting only.)
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(80),
  -- C7/D15: verify signature BEFORE any write. Then in ONE transaction INSERT
  --     this row FIRST (provider_event_id UNIQUE is the idempotency guard) and
  --     THEN activate. A duplicate's unique violation aborts the whole tx
  --     before any second activation can happen.
  provider_event_id VARCHAR(255) UNIQUE,
  amount_inr INT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- NOTIFICATIONS ----------
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  cta_url VARCHAR(500),
  is_read BOOLEAN DEFAULT FALSE,
  channels TEXT[] DEFAULT '{in_app}',
  -- C3: if channel resolution finds no valid channel (e.g. whatsapp selected
  --     but no opted-in number), set 'no_channel' and surface it — never skip silently.
  delivery_status VARCHAR(20) DEFAULT 'pending',  -- pending|sent|failed|no_channel
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id, is_read);

-- ---------- FEEDBACK ----------
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  screen VARCHAR(120),
  type VARCHAR(20) DEFAULT 'bug',  -- bug | feature
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- ANTI-ABUSE ----------
CREATE TABLE device_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fingerprint VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  account_count INT DEFAULT 1,
  is_flagged BOOLEAN DEFAULT FALSE,   -- fraud job sets this; define what flagged DOES
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_device_fingerprint ON device_registry(fingerprint);

-- ---------- ANALYTICS ----------
-- H2: you also have PostHog with server-side mirroring. Pick ONE source of
--     truth. If PostHog is primary, keep this only as a thin ad-blocker-resilient
--     mirror, or drop it. Don't let two stores of the same events drift.
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_name VARCHAR(100) NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_name ON user_events(event_name, created_at DESC);

-- =====================================================================
-- END V1. Run this against Supabase on DAY ONE (audit F6) to confirm all
-- three extensions install cleanly before you build on top of it.
-- =====================================================================
