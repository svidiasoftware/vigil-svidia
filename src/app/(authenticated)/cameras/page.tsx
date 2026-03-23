import { createClient } from "@/lib/supabase/server";
import { CameraGrid } from "@/components/camera-grid";

export default async function CamerasPage() {
  const supabase = await createClient();

  const { data: cameras } = await supabase
    .from("cameras")
    .select("*")
    .eq("is_enabled", true)
    .order("id");

  // Get latest alert per camera
  const { data: latestAlerts } = await supabase
    .from("alerts")
    .select("camera_id, severity_num, captured_at, image_path")
    .order("captured_at", { ascending: false });

  type LatestAlert = { camera_id: string; severity_num: number; captured_at: string; image_path: string };
  const alertsByCamera = new Map<string, LatestAlert[]>();
  for (const alert of (latestAlerts || []) as LatestAlert[]) {
    if (!alertsByCamera.has(alert.camera_id)) {
      alertsByCamera.set(alert.camera_id, []);
    }
    alertsByCamera.get(alert.camera_id)!.push(alert);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Cameras</h1>
        <p className="text-sm text-muted-foreground">
          {cameras?.length || 0} cameras registered
        </p>
      </div>
      <CameraGrid cameras={cameras || []} alertsByCamera={alertsByCamera} />
    </div>
  );
}
