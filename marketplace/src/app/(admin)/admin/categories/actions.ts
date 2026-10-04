"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const STAFF = ["moderator", "admin", "super_admin", "superadmin"];
const ADMINS = ["admin", "super_admin", "superadmin"];
const PROTECTED_TAG_KEYS = ["officialmerch", "flagged", "pending", "expired", "sale", "rentals"];

type Result = { error: string | null; count?: number };

const tagKey = (t: string) => t.toLowerCase().replace(/[\s_#-]+/g, "");
const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");
const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const cleanIcon = (s: string) => {
    const t = s.trim();
    return /^\p{Extended_Pictographic}/u.test(t) ? t.slice(0, 8) : null;
};

async function requireRole(allowed: string[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { supabase, error: "Please sign in again." };

    const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).maybeSingle();

    if (!profile?.role || !allowed.includes(profile.role)) {
        return { supabase, error: "You don't have permission to do that." };
    }
    return { supabase, error: null as string | null };
}

function friendly(err: { code?: string; message: string }): string {
    if (err.code === "23505") return "That already exists.";
    if (err.code === "23503") return "Listings still use this. Move or remove them first.";
    if (err.code === "42501") return "You don't have permission to do that.";
    if (err.code === "P0001") return err.message; // our own RAISE EXCEPTION messages
    return err.message;
}

function refresh() {
    ["/admin/categories", "/marketplace", "/categories", "/create-listing"].forEach((p) =>
        revalidatePath(p)
    );
}

export async function addCategory(name: string, icon: string): Promise<Result> {
    const { supabase, error } = await requireRole(STAFF);
    if (error) return { error };

    const clean = cleanName(name);
    if (clean.length < 2 || clean.length > 30) return { error: "Name must be 2 to 30 characters." };
    if (clean.toLowerCase() === "merchandise") return { error: "Merchandise is a reserved category." };

    const slug = slugify(clean);
    if (!slug) return { error: "Use letters or numbers in the name." };

    const { error: dbError } = await supabase
        .from("categories")
        .insert({ name: clean, slug, icon: cleanIcon(icon) });
    if (dbError) return { error: friendly(dbError) };

    refresh();
    return { error: null };
}

export async function updateCategory(id: number, name: string, icon: string): Promise<Result> {
    const { supabase, error } = await requireRole(STAFF);
    if (error) return { error };

    const clean = cleanName(name);
    if (clean.length < 2 || clean.length > 30) return { error: "Name must be 2 to 30 characters." };

    const { data, error: dbError } = await supabase
        .from("categories")
        .update({ name: clean, icon: cleanIcon(icon) })
        .eq("id", id)
        .select("id");
    if (dbError) return { error: friendly(dbError) };
    if (!data?.length) return { error: "Category not found or not allowed." };

    refresh();
    return { error: null };
}

export async function deleteCategory(id: number): Promise<Result> {
    const { supabase, error } = await requireRole(ADMINS);
    if (error) return { error: "Only admins can delete categories." };

    const { data, error: dbError } = await supabase
        .from("categories").delete().eq("id", id).select("id");
    if (dbError) return { error: friendly(dbError) };
    if (!data?.length) return { error: "Category not found or not allowed." };

    refresh();
    return { error: null };
}

export async function addSuggestedTag(name: string): Promise<Result> {
    const { supabase, error } = await requireRole(STAFF);
    if (error) return { error };

    const clean = cleanName(name).replace(/^#+/, "").toLowerCase();
    if (clean.length < 2 || clean.length > 30) return { error: "Tag must be 2 to 30 characters." };
    if (PROTECTED_TAG_KEYS.includes(tagKey(clean))) {
        return { error: `"${clean}" is a protected tag.` };
    }

    const { error: dbError } = await supabase.from("suggested_tags").insert({ name: clean });
    if (dbError) return { error: friendly(dbError) };

    refresh();
    return { error: null };
}

export async function removeSuggestedTag(id: number): Promise<Result> {
    const { supabase, error } = await requireRole(STAFF);
    if (error) return { error };

    const { data, error: dbError } = await supabase
        .from("suggested_tags").delete().eq("id", id).select("id");
    if (dbError) return { error: friendly(dbError) };
    if (!data?.length) return { error: "Tag not found or not allowed." };

    refresh();
    return { error: null };
}

export async function removeTagEverywhere(tag: string): Promise<Result> {
    const { supabase, error } = await requireRole(STAFF);
    if (error) return { error };

    if (PROTECTED_TAG_KEYS.includes(tagKey(tag))) {
        return { error: "This tag is protected and cannot be removed." };
    }

    const { data, error: dbError } = await supabase.rpc("admin_remove_tag", { p_tag: tag });
    if (dbError) return { error: friendly(dbError) };

    refresh();
    return { error: null, count: typeof data === "number" ? data : 0 };
}