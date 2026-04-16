-- Add agent-review columns + partial index for unreviewed-alerts fetch.
-- Run in Supabase SQL Editor before deploying analyzeag v0.9.0.
--
-- The AlertReviewAgent (analyzeag/agent/alert_review_agent.py) periodically
-- scans alerts where agent_reviewed_at IS NULL, stars presentation-worthy ones,
-- and writes a one-sentence note to agent_comment.

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS agent_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agent_comment TEXT;

CREATE INDEX IF NOT EXISTS alerts_unreviewed_captured_idx
  ON public.alerts (captured_at DESC)
  WHERE agent_reviewed_at IS NULL;
