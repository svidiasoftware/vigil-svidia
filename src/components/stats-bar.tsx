"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSeverityConfig } from "@/lib/utils/severity";
import { cn } from "@/lib/utils";

export function StatsBar({ totalCount }: { totalCount: number }) {
  const [severityCounts, setSeverityCounts] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [starredCount, setStarredCount] = useState(0);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    async function fetchCounts() {
      const counts = [0, 0, 0, 0, 0, 0];
      const promises = [1, 2, 3, 4, 5].map(async (sev) => {
        const { count } = await supabase
          .from("alerts")
          .select("*", { count: "exact", head: true })
          .eq("severity_num", sev);
        counts[sev] = count ?? 0;
      });
      const starredPromise = supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("starred", true);
      const [, { count: starred }] = await Promise.all([
        Promise.all(promises),
        starredPromise,
      ]);
      setSeverityCounts(counts);
      setStarredCount(starred ?? 0);
    }
    fetchCounts();

    // Refresh on realtime changes
    const channel = supabase
      .channel("vigil-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => { fetchCounts(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 text-sm">
      <div className="font-medium">
        <span className="text-lg font-bold">{totalCount}</span>{" "}
        <span className="text-muted-foreground">active alerts</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-3">
        {[5, 4, 3, 2, 1].map((sev) => {
          const count = severityCounts[sev];
          if (count === 0) return null;
          const config = getSeverityConfig(sev);
          return (
            <div key={sev} className="flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", config.dot)} />
              <span className={cn("text-xs font-medium", config.text)}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
      {starredCount > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium text-yellow-400">
              {starredCount}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
