"use client";

import { getSeverityConfig } from "@/lib/utils/severity";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types";

export function StatsBar({ alerts, totalCount }: { alerts: Alert[]; totalCount: number }) {
  const severityCounts = [0, 0, 0, 0, 0, 0]; // indices 0-5
  for (const alert of alerts) {
    if (alert.severity_num >= 0 && alert.severity_num <= 5) {
      severityCounts[alert.severity_num]++;
    }
  }

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
    </div>
  );
}
