-- Preserve camera-local timezone offset on each alert.
--
-- captured_at remains UTC (TIMESTAMPTZ) as the sort/retention source of truth.
-- captured_at_offset_minutes records the original offset of the source image
-- in signed minutes (e.g. -420 for -0700). The web UI displays camera-local
-- time as UTC + offset_minutes. Existing rows default to 0 (= UTC display,
-- same as today's behavior).

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS captured_at_offset_minutes SMALLINT NOT NULL DEFAULT 0;
