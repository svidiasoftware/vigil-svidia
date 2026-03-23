import { AlertFeed } from "@/components/alert-feed";
import { NotificationPrompt } from "@/components/notification-prompt";

export default function DashboardPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <NotificationPrompt />
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Real-time surveillance alerts from all cameras
        </p>
      </div>
      <AlertFeed />
    </div>
  );
}
