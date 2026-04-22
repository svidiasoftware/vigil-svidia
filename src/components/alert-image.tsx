"use client";

import { useState, useEffect } from "react";
import { getAlertImageUrl } from "@/lib/utils/images";

/**
 * Thumbnail with retry-on-error. Supabase's /render/image endpoint can
 * cold-start for an image and return before it's ready; the browser then
 * caches the failure until a hard refresh. Retry once with a cache-buster
 * after a short delay, then fall back to the raw object endpoint (which
 * skips the render transform entirely).
 */
export function AlertImage({
  imagePath,
  cameraId,
  width,
  className = "",
  loading = "lazy",
}: {
  imagePath: string;
  cameraId: string;
  width?: number;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [attempt, setAttempt] = useState(0);
  const [fallback, setFallback] = useState(false);

  // Reset retry state if the path changes (React reuses the node across
  // props changes, e.g. when the list re-orders after realtime inserts).
  useEffect(() => {
    setAttempt(0);
    setFallback(false);
  }, [imagePath]);

  const baseSrc = fallback
    ? getAlertImageUrl(imagePath)
    : getAlertImageUrl(imagePath, width);
  const src = attempt > 0 ? `${baseSrc}${baseSrc.includes("?") ? "&" : "?"}r=${attempt}` : baseSrc;

  return (
    <img
      key={`${fallback}-${attempt}`}
      src={src}
      alt={`Alert from ${cameraId}`}
      className={className}
      loading={loading}
      onError={() => {
        if (attempt < 2) {
          setTimeout(() => setAttempt((a) => a + 1), 600 * (attempt + 1));
        } else if (!fallback) {
          setFallback(true);
          setAttempt(0);
        }
      }}
    />
  );
}
