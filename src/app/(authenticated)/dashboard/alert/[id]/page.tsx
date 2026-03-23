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

  const { data: alert } = await supabase
    .from("alerts")
    .select("*")
    .eq("id", id)
    .single();

  if (!alert) notFound();

  const { data: acks } = await supabase
    .from("alert_acknowledgments")
    .select("*, profiles:user_id(display_name)")
    .eq("alert_id", id);

  return <AlertDetail alert={alert} acknowledgments={acks || []} />;
}
