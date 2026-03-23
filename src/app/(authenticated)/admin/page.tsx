import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");

  const { count: alertCount } = await supabase
    .from("alerts")
    .select("*", { count: "exact", head: true });

  const { count: cameraCount } = await supabase
    .from("cameras")
    .select("*", { count: "exact", head: true })
    .eq("is_enabled", true);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Admin</h1>

      {/* System stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Active Alerts" value={alertCount ?? 0} />
        <StatCard label="Cameras" value={cameraCount ?? 0} />
        <StatCard label="Users" value={profiles?.length ?? 0} />
      </div>

      {/* User management */}
      <div>
        <h2 className="text-sm font-medium mb-2">Users</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Joined</th>
              </tr>
            </thead>
            <tbody>
              {profiles?.map((profile) => (
                <tr key={profile.id} className="border-b border-border last:border-0">
                  <td className="p-3">{profile.display_name}</td>
                  <td className="p-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                      {profile.role}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Manage users via the Supabase Dashboard for now. Full admin UI coming in Phase 2.
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
