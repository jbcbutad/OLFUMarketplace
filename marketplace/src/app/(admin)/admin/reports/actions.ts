"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function banUserAction(userId: string, reason: string, reportId: number | null) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("moderate_ban_user", {
        p_user_id: userId, p_reason: reason, p_report_id: reportId,
    });
    if (error) return { error: error.message };

    // Reached only if the staff checks passed. Blocks sign-in and token refresh.
    const { error: authError } = await createAdminClient()
        .auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (authError) return { error: "Banned in the database, but the sign-in block failed: " + authError.message };
    return { error: null };
}

export async function unbanUserAction(userId: string) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("moderate_unban_user", { p_user_id: userId });
    if (error) return { error: error.message };

    const { error: authError } = await createAdminClient()
        .auth.admin.updateUserById(userId, { ban_duration: "none" });
    if (authError) return { error: authError.message };
    return { error: null };
}