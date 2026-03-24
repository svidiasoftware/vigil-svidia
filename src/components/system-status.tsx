"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils/date";
import type { Alert } from "@/types";

export function SystemStatus() {
  const [lastAlert, setLastAlert] = useState<string | null>(null);
  const [cameraCount, setCameraCount] = useState(0);
  const [, setTick] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function fetchInitial() {
      const { data: alert } = await supabase
        .from("alerts")
        .select("captured_at")
        .order("captured_at", { ascending: false })
        .limit(1)
        .single();

      if (alert) setLastAlert(alert.captured_at);

      const { count } = await supabase
        .from("cameras")
        .select("*", { count: "exact", head: true })
        .eq("is_enabled", true);

      setCameraCount(count ?? 0);
    }
    fetchInitial();

    // Realtime: update on new alerts
    const channel = supabase
      .channel("vigil-status")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const newAlert = payload.new as Alert;
          setLastAlert((prev) =>
            !prev || new Date(newAlert.captured_at) > new Date(prev)
              ? newAlert.captured_at
              : prev,
          );
        },
      )
      .subscribe();

    // Refresh relative time every 30s
    const timer = setInterval(() => setTick((t) => t + 1), 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, []);

  const isRecent = lastAlert
    ? Date.now() - new Date(lastAlert).getTime() < 20 * 60 * 1000
    : false;

  return (
    <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
      <div
        className={`h-2 w-2 rounded-full ${isRecent ? "bg-green-500" : "bg-yellow-500"}`}
      />
      <span>
        {lastAlert ? `Last: ${timeAgo(lastAlert)}` : "No alerts yet"}
        {cameraCount > 0 && ` | ${cameraCount} cameras`}
      </span>
    </div>
  );
}
