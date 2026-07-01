-- V2: Seed ai_model_pricing with current token rates.
-- Prices in USD per 1 000 tokens (input / output).
-- Source: provider pricing pages as of 2026-06.
-- UPDATE these rows (insert a new row with a later effective_from) whenever
-- provider prices change — the UNIQUE(provider, model, effective_from) guard
-- prevents double-seeding on re-run.
--
-- AiInteractionLogger.java has a matching hardcoded map for in-process computation;
-- keep both in sync when updating prices.

INSERT INTO ai_model_pricing (provider, model, input_per_1k_usd, output_per_1k_usd, effective_from)
VALUES
  -- Gemini 1.5 Flash (free-tier / standard)
  ('gemini', 'gemini-1.5-flash', 0.000075, 0.000300, '2026-01-01 00:00:00+00'),

  -- Groq: Llama 3.1 8B Instant
  ('groq',   'llama-3.1-8b-instant', 0.000050, 0.000080, '2026-01-01 00:00:00+00')

ON CONFLICT (provider, model, effective_from) DO NOTHING;
