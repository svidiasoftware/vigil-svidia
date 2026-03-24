"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/use-user";
import { getSeverityConfig } from "@/lib/utils/severity";
import { getAlertImageUrl } from "@/lib/utils/images";
import type { Alert } from "@/types";

export function useNotification() {
  const { user } = useUser();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [threshold, setThreshold] = useState(3);
  const [enabled, setEnabled] = useState(false);
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load preferences
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }

    if (!user) return;
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }: { data: { severity_threshold: number; browser_enabled: boolean } | null }) => {
        if (data) {
          setThreshold(data.severity_threshold);
          setEnabled(data.browser_enabled);
        }
      });
  }, [user]);

  // Subscribe to new alerts for notifications
  useEffect(() => {
    if (!enabled || permission !== "granted") return;

    const channel = supabase
      .channel("vigil-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const alert = payload.new as Alert;
          if (alert.severity_num >= threshold) {
            showNotification(alert);
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, permission, threshold]);

  return { permission, enabled, threshold };
}

function showNotification(alert: Alert) {
  const config = getSeverityConfig(alert.severity_num);

  const notification = new Notification(
    `${config.label} Alert: ${alert.camera_id}`,
    {
      body: alert.description,
      icon: "/favicon.ico",
      tag: alert.id,
      requireInteraction: alert.severity_num >= 4,
    },
  );

  notification.onclick = () => {
    window.focus();
    window.location.href = `/dashboard/alert/${alert.id}`;
  };
}
