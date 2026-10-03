import { createAdminClient } from "@/lib/supabase/admin";

type AuditEvent = {
    action: string;
    severity?: "info" | "warning" | "error";
    targetType?: string;
    targetId?: string;
    summary?: string;
    details?: Record<string, unknown>;
    actorId?: string | null;
};

/** Server-side only. Never throws: logging must not break the request. */
export async function logEvent(e: AuditEvent) {
    try {
        const { error } = await createAdminClient().rpc("audit_write", {
            p_action: e.action,
            p_target_type: e.targetType ?? null,
            p_target_id: e.targetId ?? null,
            p_summary: e.summary ?? null,
            p_details: e.details ?? {},
            p_severity: e.severity ?? "info",
            p_actor: e.actorId ?? null,
        });
        if (error) console.error("[audit] write failed:", error.message);
    } catch (err) {
        console.error("[audit] write failed:", err);
    }
}