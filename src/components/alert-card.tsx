"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { formatShort, timeAgo } from "@/lib/utils/date";
import { getAlertImageUrl } from "@/lib/utils/images";
import { getSeverityConfig } from "@/lib/utils/severity";
import type { Alert } from "@/types";

interface AlertCardProps {
  alert: Alert;
  acknowledged: boolean;
  onAcknowledge?: (alertId: string) => void;
  onFilterCamera?: (cameraId: string) => void;
  onFalsePositive?: (alertId: string) => void;
  onDelete?: (alertId: string) => void;
  isAdmin?: boolean;
}

export function AlertCard({ alert, acknowledged, onAcknowledge, onFilterCamera, onFalsePositive, onDelete, isAdmin }: AlertCardProps) {
  const config = getSeverityConfig(alert.severity_num);

  return (
    <Link
      href={`/dashboard/alert/${alert.id}`}
      className={cn(
        "group flex gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50",
        acknowledged ? "border-border/50 opacity-60" : config.border,
      )}
    >
      {/* Thumbnail */}
      <div className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-md bg-muted">
        <img
          src={getAlertImageUrl(alert.image_path, 320)}
          alt={`Alert from ${alert.camera_id}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {alert.consecutive_count > 1 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">
            x{alert.consecutive_count}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={alert.severity_num} />
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFilterCamera?.(alert.camera_id);
              }}
              className="text-xs font-medium text-foreground hover:text-primary hover:underline transition-colors"
              title={`Filter by ${alert.camera_id}`}
            >
              {alert.camera_id}
            </button>
            {alert.event_status !== "new" && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                {alert.event_status}
              </span>
            )}
            {acknowledged && (
              <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
                ACK
              </span>
            )}
            {alert.false_positive && (
              <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                FALSE +
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {alert.description}
          </p>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground" title={timeAgo(alert.captured_at)}>
            {formatShort(alert.captured_at)}
          </span>
          <span className="text-xs text-muted-foreground">
            {alert.confidence}% confidence
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-1 flex-shrink-0 self-center opacity-0 transition-opacity group-hover:opacity-100">
        {!acknowledged && onAcknowledge && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAcknowledge(alert.id);
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Acknowledge"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </button>
        )}
        {!alert.false_positive && onFalsePositive && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFalsePositive(alert.id);
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-orange-500/20 hover:text-orange-400"
            title="Mark as false positive"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384" />
            </svg>
          </button>
        )}
        {isAdmin && onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (confirm("Delete this alert?")) onDelete(alert.id);
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
            title="Delete alert"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        )}
      </div>
    </Link>
  );
}
