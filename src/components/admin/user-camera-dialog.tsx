"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Camera, Profile } from "@/types";

interface UserCameraDialogProps {
  profile: Profile;
  cameras: Camera[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function UserCameraDialog({
  profile,
  cameras,
  open,
  onOpenChange,
  onSaved,
}: UserCameraDialogProps) {
  const [allAccess, setAllAccess] = useState(profile.all_cameras_access);
  const [selectedCameras, setSelectedCameras] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  // Load current camera assignments when dialog opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    supabase
      .from("user_camera_access")
      .select("camera_id")
      .eq("user_id", profile.id)
      .then(({ data }: { data: { camera_id: string }[] | null }) => {
        if (cancelled) return;
        setAllAccess(profile.all_cameras_access);
        setSelectedCameras(new Set(data?.map((r) => r.camera_id) ?? []));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, profile.id, profile.all_cameras_access]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCamera(cameraId: string) {
    setSelectedCameras((prev) => {
      const next = new Set(prev);
      if (next.has(cameraId)) next.delete(cameraId);
      else next.add(cameraId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);

    // Update all_cameras_access on profile
    await supabase
      .from("profiles")
      .update({ all_cameras_access: allAccess })
      .eq("id", profile.id);

    // Replace camera assignments: delete all, then insert selected
    await supabase
      .from("user_camera_access")
      .delete()
      .eq("user_id", profile.id);

    if (!allAccess && selectedCameras.size > 0) {
      const rows = Array.from(selectedCameras).map((camera_id) => ({
        user_id: profile.id,
        camera_id,
      }));
      await supabase.from("user_camera_access").insert(rows);
    }

    setSaving(false);
    onSaved();
    onOpenChange(false);
  }

  const isAdmin = profile.role === "admin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Camera Access</DialogTitle>
          <DialogDescription>
            {profile.display_name}
            {isAdmin && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                admin
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isAdmin ? (
          <p className="text-sm text-muted-foreground py-2">
            Admins always have access to all cameras. No configuration needed.
          </p>
        ) : loading ? (
          <div className="py-4 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* All cameras toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={allAccess}
                onClick={() => setAllAccess(!allAccess)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  allAccess ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    allAccess ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
              <span className="text-sm font-medium">All cameras</span>
            </label>

            {/* Camera checklist */}
            {!allAccess && (
              <div className="space-y-1 max-h-64 overflow-y-auto rounded-lg border border-border p-2">
                {cameras.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">No cameras available</p>
                ) : (
                  cameras.map((camera) => (
                    <label
                      key={camera.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCameras.has(camera.id)}
                        onChange={() => toggleCamera(camera.id)}
                        className="h-3.5 w-3.5 rounded border-muted-foreground/40 accent-primary"
                      />
                      <span className="text-sm truncate">
                        {camera.id}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}

            {!allAccess && (
              <p className="text-xs text-muted-foreground">
                {selectedCameras.size} of {cameras.length} cameras selected
              </p>
            )}
          </div>
        )}

        {!isAdmin && (
          <DialogFooter>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
