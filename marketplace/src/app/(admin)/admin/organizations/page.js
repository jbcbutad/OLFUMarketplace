"use client";

import { useConfirm } from "@/components/ConfirmProvider";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Building2, Check, X, ShieldCheck, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { ui, btn } from "../ui";

export default function AdminOrganizationsPage() {
    const askConfirm = useConfirm();
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        fetchApplications();
    }, []);

    async function fetchApplications() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("org_applications")
                .select(`
          *,
          profiles ( full_name, is_verified_org )
        `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setApps(data || []);
        } catch (err) {
            console.error("Error loading applications:", err);
        } finally {
            setLoading(false);
        }
    }

    const updateOrgStatus = async (app, newStatus) => {
        setProcessingId(app.id);
        try {
            // 1. Update application status
            const { error: appErr } = await supabase
                .from("org_applications")
                .update({ status: newStatus })
                .eq("id", app.id);

            if (appErr) throw appErr;

            // 2. Update verification status on profile
            const isApproved = newStatus === "approved";
            const { error: profileErr } = await supabase
                .from("profiles")
                .update({
                    is_verified_org: isApproved,
                    org_name: isApproved ? app.org_name : null,
                })
                .eq("id", app.user_id);

            if (profileErr) throw profileErr;

            setApps((prev) =>
                prev.map((item) =>
                    item.id === app.id
                        ? { ...item, status: newStatus, profiles: { ...item.profiles, is_verified_org: isApproved } }
                        : item
                )
            );
        } catch (err) {
            toast.error("Error updating status: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const deleteApplication = async (app) => {
        const ok = await askConfirm({
            title: "Remove organization?",
            message: `Remove "${app.org_name}" from the list? This can't be undone.`,
            confirmText: "Remove",
        });
        if (!ok) return;
        setProcessingId(app.id);
        try {
            const { data, error } = await supabase
                .from("org_applications")
                .delete()
                .eq("id", app.id)
                .select();

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error("Nothing was deleted. Check your delete permissions (RLS).");
            }

            setApps((prev) => prev.filter((item) => item.id !== app.id));
        } catch (err) {
            toast.error("Error removing application: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[300px] flex items-center justify-center">
                <Loader2 className="animate-spin text-brand" size={32} />
            </div>
        );
    }

    return (
        <div className="text-foreground">
            <div className={ui.page}>
                <div>
                    <h1 className={ui.title}>
                        <Building2 size={28} className={ui.titleIcon} /> Organization Requests
                    </h1>
                    <p className={ui.subtitle}>
                        Review applications from student organizations requesting verified status.
                    </p>
                </div>

                {apps.length === 0 ? (
                    <div className={`${ui.empty} py-16`}>
                        No organization applications received yet.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {apps.map((app) => (
                            <div
                                key={app.id}
                                className={`${ui.card} p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6`}
                            >
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-bold text-foreground">{app.org_name}</h3>
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${app.status === "approved"
                                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                                : app.status === "rejected"
                                                    ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                                                    : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                                }`}
                                        >
                                            {app.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-ink-soft font-medium">
                                        Department: <span className="text-foreground">{app.department}</span> | Email:{" "}
                                        <span className="text-foreground">{app.contact_email}</span>
                                    </p>
                                    <p className="text-xs text-ink-soft">
                                        Applicant:{" "}
                                        <span className="text-foreground font-semibold">
                                            {app.profiles?.full_name || "Student Applicant"}
                                        </span>
                                    </p>
                                    <p className="text-sm bg-tint p-3 rounded-xl border border-line text-foreground/90 mt-2">
                                        {app.description}
                                    </p>
                                </div>

                                {/* ACTION CONTROLS FOR ADMINS */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {app.status === "pending" && (
                                        <>
                                            <button
                                                onClick={() => updateOrgStatus(app, "approved")}
                                                disabled={processingId === app.id}
                                                className={btn("primary", "sm")}
                                            >
                                                <Check size={14} /> Approve
                                            </button>
                                            <button
                                                onClick={() => updateOrgStatus(app, "rejected")}
                                                disabled={processingId === app.id}
                                                className={btn("dangerOutline", "sm")}
                                            >
                                                <X size={14} /> Reject
                                            </button>
                                        </>
                                    )}

                                    {app.status === "approved" && (
                                        <button
                                            onClick={() => updateOrgStatus(app, "rejected")}
                                            disabled={processingId === app.id}
                                            className={btn("dangerOutline", "sm")}
                                        >
                                            <X size={14} /> Revoke Verification
                                        </button>
                                    )}

                                    {app.status === "rejected" && (
                                        <>
                                            <button
                                                onClick={() => updateOrgStatus(app, "approved")}
                                                disabled={processingId === app.id}
                                                className={btn("primary", "sm")}
                                            >
                                                <RotateCcw size={14} /> Re-Approve
                                            </button>
                                            <button
                                                onClick={() => deleteApplication(app)}
                                                disabled={processingId === app.id}
                                                title="Remove from list"
                                                className="p-2.5 bg-tint hover:bg-rose-500/10 text-ink-soft hover:text-rose-500 border border-line rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}