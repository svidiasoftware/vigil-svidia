"use client";

import { useState } from "react";
import { timeAgo, formatTimestamp } from "@/lib/utils/date";
import type {
  Alert,
  AlertLifecycleEvent,
  AlertLifecycleEventType,
} from "@/types";

interface AckWithProfile {
  id: string;
  alert_id: string;
  user_id: string;
  note: string;
  acknowledged_at: string;
  profiles: { display_name: string } | null;
}

// Client-side merge of the three sources that together describe an alert's
// history: lifecycle events (new), acknowledgments (existing), and
// starred/false-positive columns on the alert row. Acks and column-derived
// pseudo-events are rendered with a different `kind` so the timeline makes
// it clear which came from the unified log vs. legacy stores.
type TimelineItem =
  | { kind: "event"; at: string; event: AlertLifecycleEvent }
  | { kind: "ack"; at: string; ack: AckWithProfile }
  | { kind: "state"; at: string; label: string; note?: string };

export function AlertLifecycleTimeline({
  events,
  acknowledgments,
  alert,
}: {
  events: AlertLifecycleEvent[];
  acknowledgments: AckWithProfile[];
  alert: Alert;
}) {
  const items: TimelineItem[] = [
    ...events.map((e): TimelineItem => ({
      kind: "event", at: e.created_at, event: e,
    })),
    ...acknowledgments.map((a): TimelineItem => ({
      kind: "ack", at: a.acknowledged_at, ack: a,
    })),
  ];
  if (alert.starred) {
    items.push({
      kind: "state",
      at: alert.agent_reviewed_at || alert.created_at,
      label: "Starred",
      note: alert.agent_reviewed_at
        ? "by agent review"
        : "(exact time unknown)",
    });
  }
  if (alert.false_positive) {
    items.push({
      kind: "state",
      at: alert.created_at,
      label: "Marked false positive",
      note: "(exact time unknown)",
    });
  }

  items.sort((a, b) => a.at.localeCompare(b.at));

  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        No lifecycle events recorded for this alert.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Lifecycle timeline
      </h3>
      {alert.prompt ? <PromptBlock prompt={alert.prompt} /> : null}
      <ol className="relative border-l border-border pl-4 ml-2 space-y-2">
        {items.map((it, i) => (
          <TimelineRow key={i} item={it} />
        ))}
      </ol>
    </div>
  );
}

function PromptBlock({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-md border border-border bg-muted/50 text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 hover:bg-muted transition-colors"
      >
        <span className="text-muted-foreground">
          {open ? "▾" : "▸"} Inference prompt ({prompt.length} chars)
        </span>
      </button>
      {open && (
        <pre className="px-3 pb-3 whitespace-pre-wrap break-words text-muted-foreground">
          {prompt}
        </pre>
      )}
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const [open, setOpen] = useState(false);
  const dotColor =
    item.kind === "ack"
      ? "bg-blue-500"
      : item.kind === "state"
      ? "bg-amber-500"
      : eventDotColor(item.event);

  const title =
    item.kind === "ack"
      ? `Acknowledged by ${item.ack.profiles?.display_name || "user"}`
      : item.kind === "state"
      ? item.label
      : summarizeEvent(item.event);

  const canExpand = item.kind === "event";

  return (
    <li className="relative">
      <span
        className={`absolute -left-[21px] top-1 block h-2.5 w-2.5 rounded-full ring-2 ring-background ${dotColor}`}
      />
      <div
        className={`rounded-md border border-border bg-card px-3 py-1.5 text-xs ${canExpand ? "cursor-pointer hover:bg-muted/50" : ""}`}
        onClick={canExpand ? () => setOpen((v) => !v) : undefined}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground" title={formatTimestamp(item.at)}>
            {timeAgo(item.at)}
          </span>
          <span className="font-medium">{title}</span>
          {item.kind === "event" && <EventChips event={item.event} />}
          {item.kind === "state" && item.note && (
            <span className="text-muted-foreground italic">{item.note}</span>
          )}
        </div>
        {canExpand && open && (
          <div className="mt-2 space-y-1">
            {item.event.error && (
              <div className="rounded bg-red-500/10 text-red-400 px-2 py-1 break-words">
                {item.event.error}
              </div>
            )}
            <pre className="whitespace-pre-wrap break-words bg-muted/40 rounded px-2 py-1 text-muted-foreground">
              {JSON.stringify(item.event.details, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </li>
  );
}

function EventChips({ event }: { event: AlertLifecycleEvent }) {
  return (
    <>
      {event.severity_num !== null && (
        <Chip label={`S${event.severity_num}`} className="bg-sky-500/10 text-sky-400" />
      )}
      {event.model && (
        <Chip label={event.model} className="bg-violet-500/10 text-violet-400" />
      )}
      {event.latency_ms !== null && (
        <Chip label={`${event.latency_ms}ms`} className="bg-slate-500/10 text-slate-300" />
      )}
      {event.cost_usd !== null && (
        <Chip
          label={`$${event.cost_usd.toFixed(4)}`}
          className="bg-emerald-500/10 text-emerald-400"
        />
      )}
      {(event.input_tokens !== null || event.output_tokens !== null) && (
        <Chip
          label={`${event.input_tokens ?? "?"}→${event.output_tokens ?? "?"}t`}
          className="bg-slate-500/10 text-slate-300"
        />
      )}
    </>
  );
}

function Chip({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${className}`}>
      {label}
    </span>
  );
}

function eventDotColor(e: AlertLifecycleEvent): string {
  if (e.error) return "bg-red-500";
  switch (e.event_type) {
    case "alert_inserted":
    case "agent_review_applied":
      return "bg-emerald-500";
    case "alert_insert_failed":
      return "bg-red-500";
    case "known_similarity_override":
    case "known_override_fire":
      return "bg-amber-500";
    case "cloud_confirm_start":
    case "cloud_confirm_attempt":
    case "cloud_confirm_result":
      return "bg-violet-500";
    case "agent_review_tier1":
    case "agent_review_tier2":
    case "agent_escalation_email":
    case "surveillance_agent_decision":
      return "bg-fuchsia-500";
    case "deferred_resolve":
      return "bg-sky-500";
    default:
      return "bg-slate-500";
  }
}

function summarizeEvent(e: AlertLifecycleEvent): string {
  const d = e.details || {};
  const g = <T,>(k: string): T | undefined => d[k] as T | undefined;
  switch (e.event_type) {
    case "local_inference":
      return `Local inference: ${g<string>("description") || "(no description)"}`;
    case "known_similarity_check": {
      const matched = g<boolean>("matched");
      const idx = g<number | null>("match_index");
      return matched
        ? `Similarity match (idx=${idx ?? "?"})`
        : "Similarity check: no match";
    }
    case "known_similarity_override":
      return `Status overridden to 'known' (matched idx=${g<number | null>("match_index") ?? "?"})`;
    case "cloud_confirm_start":
      return `Cloud confirm started (${g<string>("reason") || "?"}, strategy=${g<string>("strategy") || "?"})`;
    case "cloud_confirm_attempt":
      return `Cloud attempt #${(g<number>("provider_index") ?? 0) + 1}`;
    case "cloud_confirm_result": {
      const failed = g<boolean>("all_failed");
      if (failed) return "Cloud confirm: all providers failed";
      return `Cloud confirmed: ${(g<string>("winner_description") || "").slice(0, 80)}`;
    }
    case "deferred_resolve":
      return `Resolved: ${g<string>("cloud_outcome") || "?"} (final S${g<number>("final_severity") ?? "?"})`;
    case "known_override_fire":
      return "Known-override alert fired (cloud re-check disagreed with 'known' suppression)";
    case "alert_inserted":
      return "Alert inserted to Supabase";
    case "alert_insert_failed":
      return "Alert insert failed (queued for retry)";
    case "alert_queue_retry":
      return "Queued alert retry succeeded";
    case "agent_review_tier1":
      return `Agent tier-1 review (batch of ${g<number>("batch_size") ?? "?"})`;
    case "agent_review_tier2":
      return `Agent tier-2 visual review: ${g<string>("severity_reason") || "(no reason)"}`;
    case "agent_review_applied":
      return g<boolean>("severity_changed")
        ? `Agent applied S${g<number>("severity_old")}→S${g<number>("severity_new")}`
        : "Agent review applied (no severity change)";
    case "agent_escalation_email":
      return g<string>("skipped_reason")
        ? `Escalation email skipped (${g<string>("skipped_reason")})`
        : e.error
        ? "Escalation email failed"
        : "Escalation email sent";
    case "surveillance_agent_decision":
      return `Agent decision: ${g<string>("decision_type") || "?"}`;
    default: {
      const t: AlertLifecycleEventType = e.event_type;
      return t;
    }
  }
}
