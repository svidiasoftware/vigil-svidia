"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/use-user";

interface CameraFetchResult {
  userId: string;
  cameras: string[];
}

/**
 * Returns the camera IDs the current user can access.
 * - null means "all cameras" (admin or all_cameras_access flag)
 * - string[] means only those specific camera IDs
 *
 * Needed for filtering Supabase Realtime events which bypass RLS.
 */
export function useAllowedCameras() {
  const { user, profile, loading: userLoading } = useUser();
  const [fetchResult, setFetchResult] = useState<CameraFetchResult | null>(null);
  const supabase = createClient();

  const isAllAccess = !!profile && (profile.role === "admin" || profile.all_cameras_access);
  const needsFetch = !userLoading && !!user && !!profile && !isAllAccess;
  const userId = user?.id;

  // Fetch specific camera assignments when needed
  useEffect(() => {
    if (!needsFetch || !userId) return;

    let cancelled = false;
    supabase
      .from("user_camera_access")
      .select("camera_id")
      .eq("user_id", userId)
      .then(({ data }: { data: { camera_id: string }[] | null }) => {
        if (cancelled) return;
        setFetchResult({
          userId,
          cameras: data ? data.map((r) => r.camera_id) : [],
        });
      });

    return () => { cancelled = true; };
  }, [needsFetch, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive result from state
  if (userLoading) return { allowedCameraIds: null, loading: true };
  if (!user || !profile) return { allowedCameraIds: [] as string[], loading: false };
  if (isAllAccess) return { allowedCameraIds: null, loading: false };
  if (!fetchResult || fetchResult.userId !== user.id) return { allowedCameraIds: null, loading: true };
  return { allowedCameraIds: fetchResult.cameras, loading: false };
}
