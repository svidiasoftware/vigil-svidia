import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AlertDetail } from "@/components/alert-detail";

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: alert }, { data: acks }, { data: events }] = await Promise.all([
    supabase.from("alerts").select("*").eq("id", id).single(),
    supabase
      .from("alert_acknowledgments")
      .select("*, profiles:user_id(display_name)")
      .eq("alert_id", id),
    supabase
      .from("alert_lifecycle_events")
      .select("*")
      .eq("alert_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  if (!alert) notFound();

  return (
    <AlertDetail
      alert={alert}
      acknowledgments={acks || []}
      events={events || []}
    />
  );
}
