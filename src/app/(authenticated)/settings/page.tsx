"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/use-user";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSeverityConfig } from "@/lib/utils/severity";

export default function SettingsPage() {
  const { user } = useUser();
  const supabase = createClient();
  const [threshold, setThreshold] = useState(3);
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }: { data: { severity_threshold: number; browser_enabled: boolean } | null }) => {
        if (data) {
          setThreshold(data.severity_threshold);
          setBrowserEnabled(data.browser_enabled);
        }
      });

    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
    }
  }, [user]);

  async function handleSave() {
    if (!user) return;
    await supabase.from("notification_preferences").upsert({
      user_id: user.id,
      severity_threshold: threshold,
      browser_enabled: browserEnabled,
      updated_at: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      setBrowserEnabled(true);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Settings</h1>

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium mb-2">Notification Preferences</h2>
          <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div>
              <label className="text-xs text-muted-foreground">
                Minimum severity for notifications
              </label>
              <Select
                value={String(threshold)}
                onValueChange={(v) => setThreshold(Number(v))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((sev) => (
                    <SelectItem key={sev} value={String(sev)}>
                      {getSeverityConfig(sev).label} ({sev})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                Browser notifications
              </label>
              <div className="mt-1 flex items-center gap-2">
                {notifPermission === "granted" ? (
                  <span className="text-xs text-green-400">Enabled</span>
                ) : notifPermission === "denied" ? (
                  <span className="text-xs text-red-400">
                    Blocked (enable in browser settings)
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={requestPermission}>
                    Enable Notifications
                  </Button>
                )}
              </div>
            </div>

            <Button size="sm" onClick={handleSave}>
              {saved ? "Saved!" : "Save Preferences"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
