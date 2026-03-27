"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/use-user";
import { SeverityBadge } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import { getAlertImageUrl } from "@/lib/utils/images";
import { formatTimestamp, timeAgo } from "@/lib/utils/date";
import type { Alert } from "@/types";

interface AckWithProfile {
  id: string;
  alert_id: string;
  user_id: string;
  note: string;
  acknowledged_at: string;
  profiles: { display_name: string } | null;
}

export function AlertDetail({
  alert,
  acknowledgments,
}: {
  alert: Alert;
  acknowledgments: AckWithProfile[];
}) {
  const [acks, setAcks] = useState(acknowledgments);
  const [acking, setAcking] = useState(false);
  const [isFP, setIsFP] = useState(alert.false_positive ?? false);
  const [isStarred, setIsStarred] = useState(alert.starred ?? false);
  const { user } = useUser();
  const supabase = createClient();
  const router = useRouter();

  const alreadyAcked = acks.some((a) => a.user_id === user?.id);

  async function handleAcknowledge() {
    if (!user || alreadyAcked) return;
    setAcking(true);
    const { data } = await supabase
      .from("alert_acknowledgments")
      .insert({ alert_id: alert.id, user_id: user.id })
      .select("*, profiles:user_id(display_name)")
      .single();
    if (data) setAcks((prev) => [...prev, data]);
    setAcking(false);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to alerts
      </button>

      {/* Image */}
      <div className="overflow-hidden rounded-lg border border-border bg-muted">
        <img
          src={getAlertImageUrl(alert.image_path)}
          alt={`Alert from ${alert.camera_id}`}
          className="w-full"
        />
      </div>

      {/* Metadata */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <MetaField label="Camera" value={alert.camera_id} />
        <MetaField label="Severity">
          <SeverityBadge severity={alert.severity_num} />
        </MetaField>
        <MetaField label="Confidence" value={`${alert.confidence}%`} />
        <MetaField label="Status" value={alert.event_status} />
        <MetaField label="Time" value={formatTimestamp(alert.captured_at)} />
        <MetaField label="Relative" value={timeAgo(alert.captured_at)} />
        {alert.consecutive_count > 1 && (
          <MetaField label="Consecutive" value={`${alert.consecutive_count} cycles`} />
        )}
        {alert.first_seen_at && (
          <MetaField label="First Seen" value={formatTimestamp(alert.first_seen_at)} />
        )}
        {alert.analyzer_host && (
          <MetaField label="Analyzer Host" value={alert.analyzer_host} />
        )}
        {alert.analyzer_model && (
          <MetaField label="AI Model" value={alert.analyzer_model.split("/").pop() || alert.analyzer_model} />
        )}
      </div>

      {/* Description */}
      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
        <p className="text-sm">{alert.description}</p>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={handleAcknowledge}
          disabled={alreadyAcked || acking}
          variant={alreadyAcked ? "secondary" : "default"}
          size="sm"
        >
          {alreadyAcked ? "Acknowledged" : acking ? "..." : "Acknowledge"}
        </Button>
        <Button
          onClick={async () => {
            await supabase
              .from("alerts")
              .update({ false_positive: !isFP })
              .eq("id", alert.id);
            setIsFP(!isFP);
          }}
          variant={isFP ? "secondary" : "outline"}
          size="sm"
          className={isFP ? "text-orange-400" : ""}
        >
          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384" />
          </svg>
          {isFP ? "False Positive" : "False Positive"}
        </Button>
        <Button
          onClick={async () => {
            await supabase
              .from("alerts")
              .update({ starred: !isStarred })
              .eq("id", alert.id);
            setIsStarred(!isStarred);
          }}
          variant={isStarred ? "secondary" : "outline"}
          size="sm"
          className={isStarred ? "text-yellow-400" : ""}
        >
          <svg className={`h-4 w-4 mr-1 ${isStarred ? "fill-yellow-400" : ""}`} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
          {isStarred ? "Starred" : "Star"}
        </Button>
      </div>

      {/* Acknowledgments */}
      {acks.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Acknowledged by
          </h3>
          <div className="space-y-1">
            {acks.map((ack) => (
              <div key={ack.id} className="text-xs text-muted-foreground">
                {ack.profiles?.display_name || "Unknown"} &mdash;{" "}
                {timeAgo(ack.acknowledged_at)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {children || <p className="text-sm font-medium">{value}</p>}
    </div>
  );
}
