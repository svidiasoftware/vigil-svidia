-- Migration: Add email notification settings
-- Adds email_enabled and email_severity_threshold to notification_preferences,
-- and creates a function for the analyzer to query recipients with camera access.

-- 1. Add columns to notification_preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_severity_threshold SMALLINT NOT NULL DEFAULT 3
    CHECK (email_severity_threshold BETWEEN 3 AND 5);

-- 2. Function for analyzer to pull all email notification recipients
--    with their allowed camera IDs in a single query.
--    Call via service_role: supabase.rpc('get_email_notification_recipients')
CREATE OR REPLACE FUNCTION public.get_email_notification_recipients()
RETURNS TABLE (
  user_id              UUID,
  email                TEXT,
  display_name         TEXT,
  email_severity_threshold SMALLINT,
  camera_ids           TEXT[]
) AS $$
  SELECT
    np.user_id,
    u.email,
    p.display_name,
    np.email_severity_threshold,
    CASE
      WHEN p.role = 'admin' OR p.all_cameras_access = TRUE THEN
        (SELECT array_agg(c.id) FROM public.cameras c WHERE c.is_enabled = TRUE)
      ELSE
        (SELECT array_agg(uca.camera_id)
         FROM public.user_camera_access uca
         JOIN public.cameras c ON c.id = uca.camera_id AND c.is_enabled = TRUE
         WHERE uca.user_id = np.user_id)
    END AS camera_ids
  FROM public.notification_preferences np
  JOIN auth.users u ON u.id = np.user_id
  JOIN public.profiles p ON p.id = np.user_id
  WHERE np.email_enabled = TRUE;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
