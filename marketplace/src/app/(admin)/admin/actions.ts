'use server';

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// Add or remove roles here to match the options in RoleSelect
const ALLOWED_ROLES = ["user", "moderator", "admin", "super_admin", "superadmin"];

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

  // Matches the page: only super admins can change roles
  if (!isRequesterSuperAdmin) {
    throw new Error("Forbidden: Only super admins can change roles.");
  }
  if (!ALLOWED_ROLES.includes(newRole)) throw new Error("Invalid role.");
  if (targetUserId === user.id) throw new Error("You can't change your own role.");

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");

  return { success: true };
}