"use client";

import { useConfirm } from "@/components/ConfirmProvider";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Building2, Check, X, ShieldCheck, Loader2, RotateCcw, Trash2 } from "lucide-react";

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
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="animate-spin text-foreground" size={32} />
            </div>
        );
    }

    return (
        <div className="bg-background text-foreground min-h-screen p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                    <Building2 size={28} className="text-purple-500" />
                    <h1 className="text-3xl font-black uppercase italic tracking-tight">
                        Organization Approval Requests
                    </h1>
                </div>

                {apps.length === 0 ? (
                    <div className="text-center py-16 bg-card border border-dashed border-border rounded-2xl text-muted-foreground font-semibold">
                        No organization applications received yet.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {apps.map((app) => (
                            <div
                                key={app.id}
                                className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
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
                                    <p className="text-xs text-muted-foreground font-medium">
                                        Department: <span className="text-foreground">{app.department}</span> | Email:{" "}
                                        <span className="text-foreground">{app.contact_email}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Applicant:{" "}
                                        <span className="text-foreground font-semibold">
                                            {app.profiles?.full_name || "Student Applicant"}
                                        </span>
                                    </p>
                                    <p className="text-sm bg-muted/60 p-3 rounded-xl border border-border text-foreground/90 mt-2">
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
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                <Check size={14} /> Approve
                                            </button>
                                            <button
                                                onClick={() => updateOrgStatus(app, "rejected")}
                                                disabled={processingId === app.id}
                                                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                <X size={14} /> Reject
                                            </button>
                                        </>
                                    )}

                                    {app.status === "approved" && (
                                        <button
                                            onClick={() => updateOrgStatus(app, "rejected")}
                                            disabled={processingId === app.id}
                                            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            <X size={14} /> Revoke Verification
                                        </button>
                                    )}

                                    {app.status === "rejected" && (
                                        <>
                                            <button
                                                onClick={() => updateOrgStatus(app, "approved")}
                                                disabled={processingId === app.id}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                <RotateCcw size={14} /> Re-Approve
                                            </button>
                                            <button
                                                onClick={() => deleteApplication(app)}
                                                disabled={processingId === app.id}
                                                title="Remove from list"
                                                className="p-2.5 bg-muted hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 border border-border rounded-xl transition-colors cursor-pointer disabled:opacity-50"
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