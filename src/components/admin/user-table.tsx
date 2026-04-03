"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { UserCameraDialog } from "@/components/admin/user-camera-dialog";
import { SetPasswordDialog } from "@/components/admin/set-password-dialog";
import type { Camera, Profile, UserCameraAccess } from "@/types";

interface UserTableProps {
  profiles: Profile[];
  cameras: Camera[];
  cameraAccess: UserCameraAccess[];
}

function accessSummary(profile: Profile, cameraAccess: UserCameraAccess[]): string {
  if (profile.role === "admin") return "All (admin)";
  if (profile.all_cameras_access) return "All cameras";
  const count = cameraAccess.filter((a) => a.user_id === profile.id).length;
  if (count === 0) return "No access";
  return `${count} camera${count !== 1 ? "s" : ""}`;
}

export function UserTable({ profiles, cameras, cameraAccess: initialAccess }: UserTableProps) {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [passwordProfile, setPasswordProfile] = useState<Profile | null>(null);
  const [cameraAccess, setCameraAccess] = useState(initialAccess);
  const [profileList, setProfileList] = useState(profiles);

  async function handleSaved() {
    // Re-fetch fresh data after save
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    const [{ data: freshProfiles }, { data: freshAccess }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("user_camera_access").select("user_id, camera_id"),
    ]);

    if (freshProfiles) setProfileList(freshProfiles);
    if (freshAccess) setCameraAccess(freshAccess);
  }

  return (
    <>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Cameras</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Joined</th>
              <th className="p-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {profileList.map((profile) => (
              <tr
                key={profile.id}
                className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setSelectedProfile(profile)}
              >
                <td className="p-3">{profile.display_name}</td>
                <td className="p-3">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                    {profile.role}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {accessSummary(profile, cameraAccess)}
                </td>
                <td className="p-3 text-muted-foreground">
                  {new Date(profile.created_at).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    title="Set password"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPasswordProfile(profile);
                    }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedProfile && (
        <UserCameraDialog
          profile={selectedProfile}
          cameras={cameras}
          open={!!selectedProfile}
          onOpenChange={(open) => {
            if (!open) setSelectedProfile(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {passwordProfile && (
        <SetPasswordDialog
          profile={passwordProfile}
          open={!!passwordProfile}
          onOpenChange={(open) => {
            if (!open) setPasswordProfile(null);
          }}
        />
      )}
    </>
  );
}
