-- Vigil: Surveillance Alert Web Dashboard
-- Supabase schema for alert storage, user management, and realtime
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)

-- ============================================================
-- 1. CUSTOM TYPES
-- ============================================================
CREATE TYPE alert_severity AS ENUM ('normal','info','low','medium','high','critical');
CREATE TYPE alert_event_status AS ENUM ('new','recurring','cleared','changed','known');
CREATE TYPE user_role AS ENUM ('viewer','admin');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- 2a. User profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL DEFAULT '',
  role          user_role NOT NULL DEFAULT 'viewer',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  all_cameras_access BOOLEAN NOT NULL DEFAULT FALSE
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2b. Camera registry
CREATE TABLE public.cameras (
  id            TEXT PRIMARY KEY,
  display_name  TEXT,
  location      TEXT,
  image_path    TEXT,
  is_fisheye    BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2c. User camera access (junction table)
CREATE TABLE public.user_camera_access (
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  camera_id TEXT NOT NULL REFERENCES public.cameras(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, camera_id)
);

-- 2d. Alerts (core table)
CREATE TABLE public.alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id         TEXT NOT NULL REFERENCES public.cameras(id),
  captured_at       TIMESTAMPTZ NOT NULL,
  confidence        SMALLINT NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  severity          alert_severity NOT NULL DEFAULT 'normal',
  severity_num      SMALLINT NOT NULL DEFAULT 0 CHECK (severity_num BETWEEN 0 AND 5),
  event_status      alert_event_status NOT NULL DEFAULT 'new',
  consecutive_count INTEGER NOT NULL DEFAULT 1,
  return_count      INTEGER NOT NULL DEFAULT 0,
  first_seen_at     TIMESTAMPTZ,
  description       TEXT NOT NULL DEFAULT '',
  image_path        TEXT NOT NULL,
  source_filename   TEXT,
  false_positive    BOOLEAN NOT NULL DEFAULT FALSE,
  starred           BOOLEAN NOT NULL DEFAULT FALSE,
  analyzer_host     TEXT,
  analyzer_model    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2f. Alert acknowledgments
CREATE TABLE public.alert_acknowledgments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id        UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note            TEXT DEFAULT '',
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(alert_id, user_id)
);

-- 2g. Silence rules
CREATE TABLE public.silence_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id     TEXT REFERENCES public.cameras(id) ON DELETE CASCADE,
  min_severity  SMALLINT,
  max_severity  SMALLINT,
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason        TEXT DEFAULT '',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2h. Notification preferences (per-user)
CREATE TABLE public.notification_preferences (
  user_id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  severity_threshold       SMALLINT NOT NULL DEFAULT 3,
  browser_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  email_severity_threshold SMALLINT NOT NULL DEFAULT 3 CHECK (email_severity_threshold BETWEEN 3 AND 5),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX idx_user_camera_access_user  ON public.user_camera_access (user_id);
CREATE INDEX idx_alerts_captured_at       ON public.alerts (captured_at DESC);
CREATE INDEX idx_alerts_camera_captured   ON public.alerts (camera_id, captured_at DESC);
CREATE INDEX idx_alerts_severity_captured ON public.alerts (severity_num DESC, captured_at DESC);
CREATE INDEX idx_alerts_created_at        ON public.alerts (created_at);
CREATE INDEX idx_ack_alert_id            ON public.alert_acknowledgments (alert_id);
CREATE INDEX idx_silence_active          ON public.silence_rules (is_active) WHERE is_active = TRUE;

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_camera_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- USER CAMERA ACCESS
CREATE POLICY "Users can view own camera access"
  ON public.user_camera_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins can manage camera access"
  ON public.user_camera_access FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Helper: can current user see a given camera?
CREATE OR REPLACE FUNCTION public.can_access_camera(cam_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND all_cameras_access = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.user_camera_access
      WHERE user_id = auth.uid() AND camera_id = cam_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- CAMERAS
CREATE POLICY "Users can view accessible cameras"
  ON public.cameras FOR SELECT TO authenticated
  USING (public.can_access_camera(id));
CREATE POLICY "Admins can manage cameras"
  ON public.cameras FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ALERTS (inserts from service_role bypass RLS)
CREATE POLICY "Users can view alerts for accessible cameras"
  ON public.alerts FOR SELECT TO authenticated
  USING (public.can_access_camera(camera_id));
CREATE POLICY "Authenticated users can update alerts"
  ON public.alerts FOR UPDATE TO authenticated
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Admins can delete alerts"
  ON public.alerts FOR DELETE TO authenticated
  USING (public.is_admin());

-- ALERT ACKNOWLEDGMENTS
CREATE POLICY "Authenticated users can view acknowledgments"
  ON public.alert_acknowledgments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can acknowledge alerts"
  ON public.alert_acknowledgments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own acknowledgments"
  ON public.alert_acknowledgments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- SILENCE RULES
CREATE POLICY "Authenticated users can view silence rules"
  ON public.silence_rules FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can create silence rules"
  ON public.silence_rules FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own silence rules"
  ON public.silence_rules FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins can manage all silence rules"
  ON public.silence_rules FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- NOTIFICATION PREFERENCES
CREATE POLICY "Users can manage own notification prefs"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2i. Service status (heartbeat from analyzers)
CREATE TABLE public.service_status (
  service_id        TEXT PRIMARY KEY,
  last_heartbeat    TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'running',
  hostname          TEXT,
  model             TEXT,
  images_analyzed   INTEGER DEFAULT 0,
  alerts_count      INTEGER DEFAULT 0
);

ALTER TABLE public.service_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view service status"
  ON public.service_status FOR SELECT TO authenticated USING (TRUE);

-- ============================================================
-- 5. REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_acknowledgments;

-- ============================================================
-- 6. STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'alert-images',
  'alert-images',
  TRUE,
  2097152,
  ARRAY['image/jpeg']
);

-- Public read for alert images
CREATE POLICY "Public read for alert images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'alert-images');

-- ============================================================
-- 7. SEED CAMERAS
-- ============================================================
INSERT INTO public.cameras (id, display_name) VALUES
  ('CCTVTR2066-C1-c1', 'Trailer 2066 Cam 1'),
  ('CCTVTR2066-C2-c2', 'Trailer 2066 Cam 2'),
  ('CCTVTR2066-C3-c3', 'Trailer 2066 Cam 3'),
  ('CCTVTR2066-C4-c4', 'Trailer 2066 Cam 4'),
  ('MOBT-SVCM001-C1-c1', 'Mobile Tower SVC-M001 Cam 1'),
  ('MOBT-SVCM001-C2-c2', 'Mobile Tower SVC-M001 Cam 2'),
  ('MOBT-SVCM001-C3-c3', 'Mobile Tower SVC-M001 Cam 3'),
  ('MOBT-SVCM001-C4-c4', 'Mobile Tower SVC-M001 Cam 4'),
  ('MOBT-SVCM004-C1-c1', 'Mobile Tower SVC-M004 Cam 1'),
  ('MOBT-SVCM004-C2-c2', 'Mobile Tower SVC-M004 Cam 2'),
  ('MOBT-SVCM004-C3-c3', 'Mobile Tower SVC-M004 Cam 3'),
  ('MOBT-SVCM004-C4-c4', 'Mobile Tower SVC-M004 Cam 4'),
  ('MOBT-SVCM006-C1-c1', 'Mobile Tower SVC-M006 Cam 1'),
  ('MOBT-SVCM006-C2-c2', 'Mobile Tower SVC-M006 Cam 2'),
  ('MOBT-SVCM006-C3-c3', 'Mobile Tower SVC-M006 Cam 3'),
  ('MOBT-SVCM006-C4-c4', 'Mobile Tower SVC-M006 Cam 4'),
  ('cctv-svc-001-C9-c9', 'SVC-001 Cam 9'),
  ('cctv-svc-001-C_St-26st-c4', 'SVC-001 C St & 26th'),
  ('cctv-svc-001-C_St-TacD_Parkin-c5', 'SVC-001 C St Tac D Parking'),
  ('cctv-svc-001-E_26th_LP-c6', 'SVC-001 E 26th LP')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. ANALYZER HELPERS
-- ============================================================

-- Returns all users with email notifications enabled,
-- their email, severity threshold, and accessible camera IDs.
-- Intended to be called by the analyzer via service_role key.
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
