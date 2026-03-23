"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils/date";

export function SystemStatus() {
  const [lastAlert, setLastAlert] = useState<string | null>(null);
  const [cameraCount, setCameraCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
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
    fetch();
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
