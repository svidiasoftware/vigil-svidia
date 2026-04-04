"use client";

import { SeverityBadge } from "@/components/severity-badge";
import { getAlertImageUrl } from "@/lib/utils/images";
import { formatShort } from "@/lib/utils/date";
import type { Camera } from "@/types";

interface LatestAlert {
  camera_id: string;
  severity_num: number;
  captured_at: string;
  image_path: string;
}

export function CameraGrid({
  cameras,
  alertsByCamera,
}: {
  cameras: Camera[];
  alertsByCamera: Map<string, LatestAlert[]>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cameras.map((camera) => {
        const alerts = alertsByCamera.get(camera.id) || [];
        const latest = alerts[0];
        const alertCount = alerts.length;

        return (
          <div
            key={camera.id}
            className="rounded-lg border border-border bg-card overflow-hidden"
          >
            {/* Image */}
            <div className="aspect-video bg-muted relative">
              {latest ? (
                <img
                  src={getAlertImageUrl(latest.image_path, 320)}
                  alt={camera.id}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : camera.image_path ? (
                <img
                  src={getAlertImageUrl(camera.image_path, 320)}
                  alt={camera.id}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No image
                </div>
              )}
            </div>
            {/* Info */}
            <div className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium truncate">
                  {camera.id}
                </p>
                <div className="h-2 w-2 rounded-full bg-green-500" title="Active" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                {latest ? (
                  <>
                    <SeverityBadge severity={latest.severity_num} />
                    <span className="text-xs text-muted-foreground">
                      {alertCount} alert{alertCount !== 1 ? "s" : ""} | {formatShort(latest.captured_at)}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">No recent activity</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
