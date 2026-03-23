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
import type { Camera } from "@/types";

interface FiltersState {
  cameras: string[];
  severities: number[];
  sortBy: "captured_at" | "severity_num";
  ackFilter: "all" | "ack" | "unack";
}

interface AlertFiltersProps {
  value: FiltersState;
  onChange: (filters: FiltersState) => void;
}

export function AlertFilters({ value, onChange }: AlertFiltersProps) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("cameras")
      .select("*")
      .eq("is_enabled", true)
      .order("id")
      .then(({ data }) => {
        if (data) setCameras(data);
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

  const hasFilters = value.cameras.length > 0 || value.severities.length > 0 || value.ackFilter !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Camera filter */}
      <Select
        value={value.cameras[0] || "all"}
        onValueChange={setCamera}
      >
        <SelectTrigger className="w-[180px] h-8 text-xs">
          <SelectValue placeholder="All cameras" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All cameras</SelectItem>
          {cameras.map((cam) => (
            <SelectItem key={cam.id} value={cam.id}>
              {cam.display_name || cam.id}
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
          onClick={() => onChange({ cameras: [], severities: [], sortBy: "captured_at", ackFilter: "all" })}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
