"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo, formatTimestamp } from "@/lib/utils/date";
import type { ServiceStatus } from "@/types";

function getStatusColor(service: ServiceStatus) {
  if (service.status === "stopped") return "bg-red-500";
  const age = Date.now() - new Date(service.last_heartbeat).getTime();
  if (age < 15 * 60 * 1000) return "bg-green-500";
  if (age < 30 * 60 * 1000) return "bg-yellow-500";
  return "bg-red-500";
}

function getWorstColor(services: ServiceStatus[]) {
  if (services.length === 0) return "bg-muted-foreground/50";
  const colors = services.map(getStatusColor);
  if (colors.includes("bg-red-500")) return "bg-red-500";
  if (colors.includes("bg-yellow-500")) return "bg-yellow-500";
  return "bg-green-500";
}

export function SystemStatus() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [lastAlert, setLastAlert] = useState<string | null>(null);
  const [cameraCount, setCameraCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [, setTick] = useState(0);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    async function fetchAll() {
      const [{ data: svcData }, { data: alertData }, { count }] = await Promise.all([
        supabase.from("service_status").select("*").order("last_heartbeat", { ascending: false }),
        supabase.from("alerts").select("captured_at").order("captured_at", { ascending: false }).limit(1).single(),
        supabase.from("cameras").select("*", { count: "exact", head: true }).eq("is_enabled", true),
      ]);
      if (svcData) setServices(svcData as ServiceStatus[]);
      if (alertData) setLastAlert(alertData.captured_at);
      setCameraCount(count ?? 0);
    }
    fetchAll();

    // Realtime: update last alert on new inserts
    const channel = supabase
      .channel("vigil-header-status")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const captured = payload.new?.captured_at as string;
          if (captured) {
            setLastAlert((prev) =>
              !prev || new Date(captured) > new Date(prev) ? captured : prev,
            );
          }
        },
      )
      .subscribe();

    // Poll service status every 60s
    const poll = setInterval(async () => {
      const { data } = await supabase.from("service_status").select("*").order("last_heartbeat", { ascending: false });
      if (data) setServices(data as ServiceStatus[]);
    }, 60000);
    // Refresh relative time every 30s
    const tick = setInterval(() => setTick((t) => t + 1), 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [supabase]);

  const latestHeartbeat = services.length > 0
    ? services.reduce((a, b) =>
        new Date(a.last_heartbeat) > new Date(b.last_heartbeat) ? a : b
      ).last_heartbeat
    : null;

  return (
    <div className="relative hidden sm:block">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className={`h-2 w-2 rounded-full ${getWorstColor(services)}`} />
        <span>
          {lastAlert ? `Last alert: ${timeAgo(lastAlert)}` : "No alerts"}
          {cameraCount > 0 && ` | ${cameraCount} cam`}
          {services.length > 0 && ` | ${services.length} analyzer${services.length !== 1 ? "s" : ""}`}
        </span>
      </button>

      {/* Dropdown detail */}
      {expanded && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 w-80 rounded-lg border border-border bg-popover p-3 shadow-lg">
            <h3 className="text-xs font-medium text-foreground mb-2">Analyzer Services</h3>
            {services.length === 0 ? (
              <p className="text-xs text-muted-foreground">No services registered</p>
            ) : (
              <div className="space-y-3">
                {services.map((svc) => (
                  <div key={svc.service_id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${getStatusColor(svc)}`} />
                      <span className="text-xs font-medium truncate">{svc.hostname || svc.service_id}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground uppercase">
                        {svc.status}
                      </span>
                    </div>
                    <div className="pl-4 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span>Last seen</span>
                      <span>{timeAgo(svc.last_heartbeat)}</span>
                      <span>Heartbeat</span>
                      <span>{formatTimestamp(svc.last_heartbeat)}</span>
                      <span>Model</span>
                      <span className="truncate" title={svc.model || "—"}>
                        {svc.model ? svc.model.split("/").pop() : "—"}
                      </span>
                      <span>Images</span>
                      <span>{svc.images_analyzed.toLocaleString()}</span>
                      <span>Alerts</span>
                      <span>{svc.alerts_count.toLocaleString()}</span>
                      <span>Service ID</span>
                      <span className="truncate" title={svc.service_id}>{svc.service_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
