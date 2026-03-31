import { createClient } from "@/lib/supabase/server";
import { UserTable } from "@/components/admin/user-table";

export default async function AdminPage() {
  const supabase = await createClient();

  const [
    { data: profiles },
    { count: alertCount },
    { data: cameras },
    { data: cameraAccess },
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("alerts").select("*", { count: "exact", head: true }),
    supabase.from("cameras").select("*").eq("is_enabled", true).order("id"),
    supabase.from("user_camera_access").select("user_id, camera_id"),
  ]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Admin</h1>

      {/* System stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Active Alerts" value={alertCount ?? 0} />
        <StatCard label="Cameras" value={cameras?.length ?? 0} />
        <StatCard label="Users" value={profiles?.length ?? 0} />
      </div>

      {/* User management */}
      <div>
        <h2 className="text-sm font-medium mb-2">Users</h2>
        <UserTable
          profiles={profiles ?? []}
          cameras={cameras ?? []}
          cameraAccess={cameraAccess ?? []}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Click a user row to manage their camera access.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
