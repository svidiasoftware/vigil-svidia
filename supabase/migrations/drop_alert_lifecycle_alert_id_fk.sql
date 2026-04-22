-- Drop the FK on alert_lifecycle_events.alert_id.
-- Run in Supabase SQL Editor before (or during) deploying analyzeag v0.17.1.
--
-- The FK caused frequent 23503 violations in staging: lifecycle events
-- legitimately precede the alerts row insert (local_inference fires at
-- analysis time; the alerts row lands later in _output_worker after the
-- push-threshold check), and some frames never produce an alerts row at
-- all (severity 0, skip_push, failed push). A single bad alert_id in a
-- batched insert fails the entire batch, so one orphan id could block
-- several legitimate events on every retry until the alerts row lands —
-- or forever, when the alerts row never does.
--
-- Keeping alert_id as a plain indexed column still lets the UI query
-- `WHERE alert_id = $id`. Cascade-on-delete semantics are preserved by
-- a trigger below so admin/retention deletes still clean up.

ALTER TABLE public.alert_lifecycle_events
  DROP CONSTRAINT IF EXISTS alert_lifecycle_events_alert_id_fkey;

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

-- Without the FK, events whose alert_id points at a never-inserted
-- alerts row (skip_push, declined cloud confirm, failed push) would
-- accumulate indefinitely. Prune them alongside the NULL-alert ones.
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
