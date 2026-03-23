export type AlertSeverity = "normal" | "info" | "low" | "medium" | "high" | "critical";
export type AlertEventStatus = "new" | "recurring" | "cleared" | "changed" | "known";
export type UserRole = "viewer" | "admin";

export interface Alert {
  id: string;
  camera_id: string;
  captured_at: string;
  confidence: number;
  severity: AlertSeverity;
  severity_num: number;
  event_status: AlertEventStatus;
  consecutive_count: number;
  return_count: number;
  first_seen_at: string | null;
  description: string;
  image_path: string;
  source_filename: string | null;
  false_positive: boolean;
  created_at: string;
}

export interface AlertWithAck extends Alert {
  acknowledged_by?: string[];
}

export interface AlertAcknowledgment {
  id: string;
  alert_id: string;
  user_id: string;
  note: string;
  acknowledged_at: string;
}

export interface Camera {
  id: string;
  display_name: string | null;
  location: string | null;
  is_fisheye: boolean;
  is_enabled: boolean;
  created_at: string;
}

export interface SilenceRule {
  id: string;
  camera_id: string | null;
  min_severity: number | null;
  max_severity: number | null;
  created_by: string;
  reason: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  severity_threshold: number;
  browser_enabled: boolean;
  updated_at: string;
}
