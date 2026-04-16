"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Alert, AlertAcknowledgment, AlertEventStatus } from "@/types";

const PAGE_SIZE = 20;

interface AlertFilters {
  cameras?: string[];
  severities?: number[];
  starred?: boolean;
  agentHighlighted?: boolean;
  analyzerModel?: string;
  analyzerHost?: string;
  eventStatus?: AlertEventStatus;
  sortBy?: "captured_at" | "severity_num";
  sortOrder?: "asc" | "desc";
  /** Camera IDs the user can access (null = all). Used to filter realtime events that bypass RLS. */
  allowedCameraIds?: string[] | null;
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
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.cameras?.length) {
      query = query.in("camera_id", filters.cameras);
    }
    if (filters.severities?.length) {
      query = query.in("severity_num", filters.severities);
    }
    if (filters.starred) {
      query = query.eq("starred", true);
    }
    if (filters.agentHighlighted) {
      query = query.not("agent_comment", "is", null);
    }
    if (filters.analyzerModel) {
      query = query.eq("analyzer_model", filters.analyzerModel);
    }
    if (filters.analyzerHost) {
      query = query.eq("analyzer_host", filters.analyzerHost);
    }
    if (filters.eventStatus) {
      query = query.eq("event_status", filters.eventStatus);
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
  }, [filters.cameras, filters.severities, filters.starred, filters.agentHighlighted, filters.analyzerModel, filters.analyzerHost, filters.eventStatus, filters.sortBy, filters.sortOrder]);

  const fetchAcks = useCallback(async () => {
    const { data } = await supabase
      .from("alert_acknowledgments")
      .select("alert_id");
    if (data) {
      setAcknowledgedIds(new Set(data.map((a: { alert_id: string }) => a.alert_id)));
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Payload = any;
  const allowedRef = useRef(filters.allowedCameraIds);
  useEffect(() => {
    allowedRef.current = filters.allowedCameraIds;
  }, [filters.allowedCameraIds]);

  const sortByRef = useRef(filters.sortBy);
  const sortOrderRef = useRef(filters.sortOrder);
  useEffect(() => {
    sortByRef.current = filters.sortBy;
    sortOrderRef.current = filters.sortOrder;
  }, [filters.sortBy, filters.sortOrder]);

  useEffect(() => {
    const channel = supabase
      .channel("vigil-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload: Payload) => {
          const newAlert = payload.new as Alert;
          // Realtime bypasses RLS — filter by allowed cameras
          const allowed = allowedRef.current;
          if (allowed !== null && allowed !== undefined && !allowed.includes(newAlert.camera_id)) return;
          setAlerts((prev) => {
            // Insert in sorted position (primary sort + created_at desc tiebreaker)
            // so cloud-confirm alerts (created later) appear above their local counterparts
            const sortBy = sortByRef.current || "captured_at";
            const desc = sortOrderRef.current !== "asc";
            const idx = prev.findIndex((existing) => {
              let cmp: number;
              if (sortBy === "severity_num") {
                cmp = newAlert.severity_num - existing.severity_num;
              } else {
                cmp = new Date(newAlert.captured_at).getTime() - new Date(existing.captured_at).getTime();
              }
              if (cmp !== 0) return desc ? cmp > 0 : cmp < 0;
              return new Date(newAlert.created_at).getTime() > new Date(existing.created_at).getTime();
            });
            if (idx === -1) return [...prev, newAlert];
            return [...prev.slice(0, idx), newAlert, ...prev.slice(idx)];
          });
          setTotalCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "alerts" },
        (payload: Payload) => {
          const updated = payload.new as Alert;
          setAlerts((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "alerts" },
        (payload: Payload) => {
          const deletedId = payload.old?.id as string;
          setAlerts((prev) => prev.filter((a) => a.id !== deletedId));
          setTotalCount((prev) => Math.max(0, prev - 1));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alert_acknowledgments" },
        (payload: Payload) => {
          const ack = payload.new as AlertAcknowledgment;
          setAcknowledgedIds((prev) => new Set([...prev, ack.alert_id]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "alert_acknowledgments" },
        (payload: Payload) => {
          const alertId = payload.old?.alert_id as string;
          setAcknowledgedIds((prev) => {
            const next = new Set(prev);
            next.delete(alertId);
            return next;
          });
        },
      )
      .subscribe((status: string) => {
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
