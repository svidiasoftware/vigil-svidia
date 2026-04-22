-- Alert lifecycle events: one row per decision/inference/action taken for an alert.
-- Populated by analyzeag/output/supabase_lifecycle.py; read by web UI timeline.
-- Run in Supabase SQL Editor before deploying analyzeag v0.17.0.
--
-- Every lifecycle row carries camera_id (set by the Python emitter) so RLS can
-- authorize via can_access_camera() without joining back to alerts. alert_id
-- is nullable because pre-insert events (local_inference, known_similarity_*,
-- cloud_confirm_*) run before the alerts row exists, and some never result
-- in an insert at all (severity 0).
--
-- alert_id is intentionally a plain UUID without a foreign key. Events
-- can land before the alerts row is inserted (local_inference fires at
-- analysis time, the alerts row lands later in _output_worker) and some
-- never produce an alerts row at all. A strict FK turns every one of
-- those into a 23503 violation that also fails every other row in the
-- same batched insert. Cascade-on-delete semantics are preserved via a
-- trigger (see below) so admin/retention deletes still clean up.

DO $$ BEGIN
  CREATE TYPE alert_lifecycle_event_type AS ENUM (
    'local_inference',
    'known_similarity_check',
    'known_similarity_override',
    'cloud_confirm_start',
    'cloud_confirm_attempt',
    'cloud_confirm_result',
    'deferred_resolve',
    'known_override_fire',
    'alert_inserted',
    'alert_insert_failed',
    'alert_queue_retry',
    'agent_review_tier1',
    'agent_review_tier2',
    'agent_review_applied',
    'agent_escalation_email',
    'surveillance_agent_decision'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.alert_lifecycle_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id        UUID,
  camera_id       TEXT REFERENCES public.cameras(id) ON DELETE SET NULL,
  source_filename TEXT,
  event_type      alert_lifecycle_event_type NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  model           TEXT,
  severity_num    SMALLINT,
  latency_ms      INTEGER,
  cost_usd        NUMERIC(10,5),
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  error           TEXT,
  details         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ale_alert_created
  ON public.alert_lifecycle_events (alert_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ale_camera_created
  ON public.alert_lifecycle_events (camera_id, created_at DESC)
  WHERE alert_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_ale_created_at
  ON public.alert_lifecycle_events (created_at DESC);

ALTER TABLE public.alert_lifecycle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view lifecycle events for accessible cameras"
  ON public.alert_lifecycle_events;
CREATE POLICY "Users can view lifecycle events for accessible cameras"
  ON public.alert_lifecycle_events FOR SELECT TO authenticated
  USING (camera_id IS NOT NULL AND public.can_access_camera(camera_id));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_lifecycle_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Cascade-on-delete for alerts → lifecycle events, implemented as a
-- trigger instead of a FK so pre-insert and orphan events don't cause
-- 23503 violations on insert.
CREATE OR REPLACE FUNCTION public.cleanup_lifecycle_events_for_alert()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.alert_lifecycle_events
   WHERE alert_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cleanup_lifecycle_events ON public.alerts;
CREATE TRIGGER trg_cleanup_lifecycle_events
  AFTER DELETE ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_lifecycle_events_for_alert();

-- Retention prune for orphan events: NULL alert_id, or alert_id with
-- no corresponding alerts row (never inserted — skip_push, declined
-- cloud confirm, failed push).
CREATE OR REPLACE FUNCTION public.prune_orphan_lifecycle_events(retention_hours INT DEFAULT 48)
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  WITH d AS (
    DELETE FROM public.alert_lifecycle_events ale
     WHERE ale.created_at < now() - (retention_hours || ' hours')::interval
       AND (ale.alert_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM public.alerts a WHERE a.id = ale.alert_id
            ))
    RETURNING 1
  )
  SELECT count(*) INTO deleted FROM d;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
