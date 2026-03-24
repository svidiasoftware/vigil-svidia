"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Alert, AlertAcknowledgment } from "@/types";

const PAGE_SIZE = 20;

interface AlertFilters {
  cameras?: string[];
  severities?: number[];
  sortBy?: "captured_at" | "severity_num";
  sortOrder?: "asc" | "desc";
}

export function useAlerts(filters: AlertFilters = {}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const fetchAlerts = useCallback(async (pageNum = 0, append = false) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("alerts")
      .select("*", { count: "exact" })
      .order(filters.sortBy || "captured_at", {
        ascending: filters.sortOrder === "asc",
      })
      .range(from, to);

    if (filters.cameras?.length) {
      query = query.in("camera_id", filters.cameras);
    }
    if (filters.severities?.length) {
      query = query.in("severity_num", filters.severities);
    }

    const { data, error, count } = await query;
    if (!error && data) {
      if (append) {
        setAlerts((prev) => [...prev, ...data]);
      } else {
        setAlerts(data);
      }
      if (count !== null) setTotalCount(count);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [filters.cameras, filters.severities, filters.sortBy, filters.sortOrder]);

  const fetchAcks = useCallback(async () => {
    const { data } = await supabase
      .from("alert_acknowledgments")
      .select("alert_id");
    if (data) {
      setAcknowledgedIds(new Set(data.map((a) => a.alert_id)));
    }
  }, []);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchAlerts(0, false);
    fetchAcks();
  }, [fetchAlerts, fetchAcks]);

  function loadMore() {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchAlerts(nextPage, true);
  }

  // Realtime subscription — stable client ref, runs once
  useEffect(() => {
    const channel = supabase
      .channel("vigil-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          const newAlert = payload.new as Alert;
          setAlerts((prev) => [newAlert, ...prev]);
          setTotalCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "alerts" },
        (payload) => {
          const updated = payload.new as Alert;
          setAlerts((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "alerts" },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setAlerts((prev) => prev.filter((a) => a.id !== deletedId));
          setTotalCount((prev) => Math.max(0, prev - 1));
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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Vigil] Realtime connected");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return { alerts, acknowledgedIds, totalCount, loading, loadingMore, hasMore, loadMore, refetch: fetchAlerts };
}
