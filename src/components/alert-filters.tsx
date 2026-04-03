"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSeverityConfig } from "@/lib/utils/severity";
import { cn } from "@/lib/utils";
import type { AlertEventStatus, Camera } from "@/types";

interface FiltersState {
  cameras: string[];
  severities: number[];
  sortBy: "captured_at" | "severity_num";
  ackFilter: "all" | "ack" | "unack";
  starFilter: "all" | "starred";
  analyzerModel: string | null;
  analyzerHost: string | null;
  eventStatus: AlertEventStatus | null;
}

interface AlertFiltersProps {
  value: FiltersState;
  onChange: (filters: FiltersState) => void;
}

const EVENT_STATUS_LABELS: Record<AlertEventStatus, string> = {
  new: "New",
  recurring: "Recurring",
  cleared: "Cleared",
  changed: "Changed",
  known: "Known",
};

export function AlertFilters({ value, onChange }: AlertFiltersProps) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [hosts, setHosts] = useState<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("cameras")
      .select("*")
      .eq("is_enabled", true)
      .order("id")
      .then(({ data }: { data: Camera[] | null }) => {
        if (data) setCameras(data);
      });

    // Fetch distinct analyzer models and hosts from both alerts and registered services
    Promise.all([
      supabase.from("alerts").select("analyzer_model").not("analyzer_model", "is", null),
      supabase.from("service_status").select("model").not("model", "is", null),
    ]).then(([alertRes, serviceRes]) => {
      const fromAlerts = (alertRes.data as { analyzer_model: string }[] | null)?.map((r) => r.analyzer_model) ?? [];
      const fromServices = (serviceRes.data as { model: string }[] | null)?.map((r) => r.model) ?? [];
      const unique = [...new Set([...fromAlerts, ...fromServices])].sort();
      setModels(unique);
    });

    Promise.all([
      supabase.from("alerts").select("analyzer_host").not("analyzer_host", "is", null),
      supabase.from("service_status").select("hostname").not("hostname", "is", null),
    ]).then(([alertRes, serviceRes]) => {
      const fromAlerts = (alertRes.data as { analyzer_host: string }[] | null)?.map((r) => r.analyzer_host) ?? [];
      const fromServices = (serviceRes.data as { hostname: string }[] | null)?.map((r) => r.hostname) ?? [];
      const unique = [...new Set([...fromAlerts, ...fromServices])].sort();
      setHosts(unique);
    });
  }, []);

  function toggleSeverity(sev: number) {
    const next = value.severities.includes(sev)
      ? value.severities.filter((s) => s !== sev)
      : [...value.severities, sev];
    onChange({ ...value, severities: next });
  }

  function setCamera(cam: string | null) {
    if (!cam || cam === "all") {
      onChange({ ...value, cameras: [] });
    } else {
      onChange({ ...value, cameras: [cam] });
    }
  }

  const hasFilters = value.cameras.length > 0 || value.severities.length > 0 || value.ackFilter !== "all" || value.starFilter !== "all" || value.analyzerModel !== null || value.analyzerHost !== null || value.eventStatus !== null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Camera filter */}
      <Select
        value={value.cameras[0] || "all"}
        onValueChange={setCamera}
      >
        <SelectTrigger className="w-[300px] h-8 text-xs">
          <SelectValue placeholder="All cameras" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All cameras</SelectItem>
          {cameras.map((cam) => (
            <SelectItem key={cam.id} value={cam.id}>
              {cam.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Severity toggles */}
      <div className="flex items-center gap-1">
        {[5, 4, 3, 2, 1].map((sev) => {
          const config = getSeverityConfig(sev);
          const active = value.severities.length === 0 || value.severities.includes(sev);
          return (
            <button
              key={sev}
              onClick={() => toggleSeverity(sev)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-all",
                active
                  ? `${config.bg} ${config.text}`
                  : "bg-muted/30 text-muted-foreground/50",
              )}
              title={config.label}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", active ? config.dot : "bg-muted-foreground/30")} />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Starred filter */}
      <button
        onClick={() => onChange({ ...value, starFilter: value.starFilter === "all" ? "starred" : "all" })}
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-all h-8",
          value.starFilter === "starred"
            ? "bg-yellow-500/20 text-yellow-400"
            : "bg-muted/30 text-muted-foreground/50 hover:text-muted-foreground",
        )}
        title="Show starred only"
      >
        <svg className={`h-3.5 w-3.5 ${value.starFilter === "starred" ? "fill-yellow-400" : ""}`} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" fill="none">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
        Starred
      </button>

      {/* Acknowledged filter */}
      <Select
        value={value.ackFilter}
        onValueChange={(v) => onChange({ ...value, ackFilter: v as FiltersState["ackFilter"] })}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All status</SelectItem>
          <SelectItem value="unack">Unacknowledged</SelectItem>
          <SelectItem value="ack">Acknowledged</SelectItem>
        </SelectContent>
      </Select>

      {/* AI Model filter */}
      {models.length > 0 && (
        <Select
          value={value.analyzerModel || "all"}
          onValueChange={(v) => onChange({ ...value, analyzerModel: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-[300px] h-8 text-xs">
            <SelectValue placeholder="All models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {models.map((m) => (
              <SelectItem key={m} value={m} title={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Host filter */}
      {hosts.length > 0 && (
        <Select
          value={value.analyzerHost || "all"}
          onValueChange={(v) => onChange({ ...value, analyzerHost: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="All hosts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All hosts</SelectItem>
            {hosts.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Event status filter */}
      <Select
        value={value.eventStatus || "all"}
        onValueChange={(v) => onChange({ ...value, eventStatus: v === "all" ? null : v as AlertEventStatus })}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="All events" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All events</SelectItem>
          {(Object.entries(EVENT_STATUS_LABELS) as [AlertEventStatus, string][]).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select
        value={value.sortBy}
        onValueChange={(v) => onChange({ ...value, sortBy: v as FiltersState["sortBy"] })}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="captured_at">Newest first</SelectItem>
          <SelectItem value="severity_num">Severity</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => onChange({ cameras: [], severities: [], sortBy: "captured_at", ackFilter: "all", starFilter: "all", analyzerModel: null, analyzerHost: null, eventStatus: null })}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
