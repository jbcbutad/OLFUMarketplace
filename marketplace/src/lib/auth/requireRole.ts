import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const STAFF = ["super_admin", "superadmin", "admin", "moderator"];

export async function requireRole(allowed: string[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login"); // use your real login path

    const { data: me } = await supabase
        .from("profiles").select("role").eq("id", user.id).maybeSingle();
    const role = me?.role ?? "user";

    if (!STAFF.includes(role)) redirect("/marketplace");
    if (!allowed.includes(role)) redirect("/admin/reports");
    return { user, role };
}