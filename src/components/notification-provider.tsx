"use client";

import { useNotification } from "@/lib/hooks/use-notification";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  // This hook subscribes to realtime alerts and shows browser notifications
  useNotification();
  return <>{children}</>;
}
