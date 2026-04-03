"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setUserPassword(
  userId: string,
  password: string,
): Promise<{ error?: string }> {
  // Verify the caller is an admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "admin") return { error: "Not authorized" };

  // Validate password
  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  // Use admin client to update the user's password
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });

  if (error) return { error: error.message };
  return {};
}
