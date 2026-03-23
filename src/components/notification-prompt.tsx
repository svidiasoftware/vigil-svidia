"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function NotificationPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      // Show after a short delay so it's not jarring
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  async function handleEnable() {
    const perm = await Notification.requestPermission();
    setShow(false);
    if (perm === "granted") {
      // Will be picked up by useNotification hook
    }
  }

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
      <div>
        <p className="text-sm font-medium text-blue-400">Enable notifications?</p>
        <p className="text-xs text-muted-foreground">
          Get browser alerts for high-severity events
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShow(false)}>
          Later
        </Button>
        <Button size="sm" onClick={handleEnable}>
          Enable
        </Button>
      </div>
    </div>
  );
}
