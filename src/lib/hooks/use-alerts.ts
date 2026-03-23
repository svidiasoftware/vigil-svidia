"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Alert, AlertAcknowledgment } from "@/types";

interface AlertFilters {
  cameras?: string[];
  severities?: number[];
  sortBy?: "captured_at" | "severity_num";
  sortOrder?: "asc" | "desc";
}

export function useAlerts(filters: AlertFilters = {}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchAlerts = useCallback(async () => {
    let query = supabase
      .from("alerts")
      .select("*")
      .order(filters.sortBy || "captured_at", {
        ascending: filters.sortOrder === "asc",
      })
      .limit(100);

    if (filters.cameras?.length) {
      query = query.in("camera_id", filters.cameras);
    }
    if (filters.severities?.length) {
      query = query.in("severity_num", filters.severities);
    }

    const { data, error } = await query;
    if (!error && data) {
      setAlerts(data);
    }
    setLoading(false);
  }, [filters.cameras, filters.severities, filters.sortBy, filters.sortOrder]);

  const fetchAcks = useCallback(async () => {
    const { data } = await supabase
      .from("alert_acknowledgments")
      .select("alert_id");
    if (data) {
      setAcknowledgedIds(new Set(data.map((a) => a.alert_id)));
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    fetchAcks();
  }, [fetchAlerts, fetchAcks]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("vigil-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          const newAlert = payload.new as Alert;
          setAlerts((prev) => [newAlert, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "alerts" },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setAlerts((prev) => prev.filter((a) => a.id !== deletedId));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alert_acknowledgments" },
        (payload) => {
          const ack = payload.new as AlertAcknowledgment;
          setAcknowledgedIds((prev) => new Set([...prev, ack.alert_id]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "alert_acknowledgments" },
        (payload) => {
          const oldAck = payload.old as { alert_id: string };
          setAcknowledgedIds((prev) => {
            const next = new Set(prev);
            next.delete(oldAck.alert_id);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { alerts, acknowledgedIds, loading, refetch: fetchAlerts };
}
