import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CategoriesManager from "./CategoriesManager";

export const dynamic = "force-dynamic";

const STAFF = ["moderator", "admin", "super_admin", "superadmin"];
const ADMINS = ["admin", "super_admin", "superadmin"];

export default async function AdminCategoriesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).maybeSingle();
    const role = profile?.role ?? "user";
    if (!STAFF.includes(role)) redirect("/marketplace");

    const [cats, usage, suggested, tagList] = await Promise.all([
        supabase.from("categories").select("id, name, icon").order("name"),
        supabase.rpc("admin_category_usage"),
        supabase.from("suggested_tags").select("id, name").order("sort_order").order("name"),
        supabase.rpc("admin_list_tags"),
    ]);

    const usageMap: Record<number, number> = {};
    (usage.data ?? []).forEach((r: { cat_id: number; listing_count: number }) => {
        usageMap[r.cat_id] = Number(r.listing_count);
    });

    return (
        <CategoriesManager
            categories={cats.data ?? []}
            usage={usageMap}
            suggested={suggested.data ?? []}
            tags={(tagList.data ?? []).map((t: any) => ({
                key: t.tag_key, label: t.label, count: Number(t.usage_count), isProtected: t.is_protected,
            }))}
            canDeleteCategories={ADMINS.includes(role)}
        />
    );
}