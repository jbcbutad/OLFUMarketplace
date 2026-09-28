'use server';

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function updateUserRole(targetUserId: string, newRole: string) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: requesterProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const requesterRole = requesterProfile?.role || "user";
  const isRequesterSuperAdmin = requesterRole === "super_admin" || requesterRole === "superadmin";

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .single();

  const targetRole = targetProfile?.role || "user";
  const isTargetSuperAdmin = targetRole === "super_admin" || targetRole === "superadmin";

  if (isTargetSuperAdmin && !isRequesterSuperAdmin) {
    throw new Error("Forbidden: Admins cannot alter Superadmin permissions.");
  }

  const isAssigningSuper = newRole === "super_admin" || newRole === "superadmin";
  if (isAssigningSuper && !isRequesterSuperAdmin) {
    throw new Error("Forbidden: Only Superadmins can assign the Superadmin role.");
  }

  if (requesterRole === "moderator") {
    throw new Error("Forbidden: Moderators cannot alter user roles.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (error) throw new Error(error.message);

  // Revalidate cache for admin user directory
  revalidatePath("/admin/users");

  return { success: true };
}