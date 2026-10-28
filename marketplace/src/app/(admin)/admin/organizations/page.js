"use client";

import { useConfirm } from "@/components/ConfirmProvider";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import {
    Building2,
    Check,
    X,
    Loader2,
    RotateCcw,
    Trash2,
    Clock,
    Search,
    CheckCircle2,
    XCircle,
    Mail,
    GraduationCap,
    ShieldCheck,
    ShieldOff,
} from "lucide-react";
import { ui, btn } from "../ui";

// Popup text for each button. key = `${current status}->${new status}`
const CONFIRM_COPY = {
    "pending->approved": {
        title: "Approve organization?",
        message: (name) => `Approve "${name}" and give it verified status?`,
        confirmText: "Approve",
    },
    "pending->rejected": {
        title: "Reject application?",
        message: (name) => `Reject the application from "${name}"?`,
        confirmText: "Reject",
    },
    "approved->revoked": {
        title: "Revoke verification?",
        message: (name) => `Remove verified status from "${name}"? They will lose their verified badge.`,
        confirmText: "Revoke",
    },
    "rejected->approved": {
        title: "Re-approve organization?",
        message: (name) => `Re-approve "${name}" and restore verified status?`,
        confirmText: "Re-Approve",
    },
    "revoked->approved": {
        title: "Re-approve organization?",
        message: (name) => `Re-approve "${name}" and restore verified status?`,
        confirmText: "Re-Approve",
    },
};

// Look of each status (full class names so Tailwind keeps them)
const STATUS_STYLE = {
    pending: {
        icon: Clock,
        iconBox: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        label: "pending",
    },
    approved: {
        icon: ShieldCheck,
        iconBox: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        label: "approved",
    },
    rejected: {
        icon: XCircle,
        iconBox: "bg-rose-500/10 text-rose-600 border-rose-500/20",
        chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        label: "rejected",
    },
    revoked: {
        icon: ShieldOff,
        iconBox: "bg-orange-500/10 text-orange-600 border-orange-500/20",
        chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
        label: "revoked",
    },
};

function Avatar({ name, url, size = 36 }) {
    const initials =
        name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
    return url ? (
        <img
            src={url}
            alt=""
            style={{ width: size, height: size }}
            className="rounded-full object-cover shrink-0 border border-line bg-tint"
        />
    ) : (
        <div
            style={{ width: size, height: size }}
            className="rounded-full shrink-0 flex items-center justify-center bg-tint text-ink-soft text-[11px] font-black border border-line"
        >
            {initials}
        </div>
    );
}

export default function AdminOrganizationsPage() {
    const askConfirm = useConfirm(); // still used for the delete (trash) button
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("pending");
    const [processingId, setProcessingId] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null); // { app, newStatus }

    useEffect(() => {
        fetchApplications();
    }, []);

    // Close the popup with the Escape key
    useEffect(() => {
        if (!confirmAction) return;
        const onKey = (e) => e.key === "Escape" && closeConfirm();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [confirmAction, processingId]);

    async function fetchApplications() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("org_applications")
                .select(`
          *,
          profiles ( full_name, email, avatar_url, is_verified_org )
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

    // ---- confirmation popup helpers ----
    const requestStatusChange = (app, newStatus) => setConfirmAction({ app, newStatus });

    const closeConfirm = () => {
        if (!processingId) setConfirmAction(null);
    };

    const handleConfirm = async () => {
        const { app, newStatus } = confirmAction;
        await updateOrgStatus(app, newStatus);
        setConfirmAction(null);
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

    const statusOf = (a) => a.status || "pending";
    const countOf = (status) => apps.filter((a) => statusOf(a) === status).length;

    const query = search.trim().toLowerCase();
    const filteredApps = apps.filter((a) => {
        if (statusOf(a) !== filterStatus) return false;
        if (!query) return true;
        const haystack = [
            a.org_name,
            a.department,
            a.contact_email,
            a.description,
            a.profiles?.full_name,
            a.profiles?.email,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        return haystack.includes(query);
    });

    const tabs = [
        ["pending", "Pending"],
        ["approved", "Approved"],
        ["rejected", "Rejected"],
        ["revoked", "Revoked"],
    ];

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
                {/* HEADER SECTION */}
                <div className={ui.headerBar}>
                    <div>
                        <h1 className={ui.title}>
                            <Building2 size={28} className={ui.titleIcon} /> Organization Requests
                        </h1>
                        <p className={ui.subtitle}>
                            Review applications from student organizations requesting verified status.
                        </p>
                    </div>
                    <div className={ui.countBadge}>{countOf("pending")} Pending</div>
                </div>

                {/* STATUS TABS */}
                <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
                    {tabs.map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setFilterStatus(key)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${filterStatus === key
                                ? "bg-brand text-on-brand border-brand shadow-sm"
                                : "bg-tint text-ink-soft border-line hover:text-brand-deep"
                                }`}
                        >
                            {label} ({countOf(key)})
                        </button>
                    ))}
                </div>

                {/* SEARCH */}
                <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by organization, department, email or applicant..."
                        className={`${ui.input} w-full pl-10 text-xs`}
                    />
                </div>

                {/* QUEUE CONTENT */}
                {filteredApps.length === 0 ? (
                    <div className="border border-line rounded-2xl bg-surface p-16 text-center flex flex-col items-center justify-center min-h-[350px] shadow-sm space-y-2">
                        <CheckCircle2 size={48} className="text-ink-soft/40 mb-2" />
                        <h3 className="text-base font-bold text-foreground">Queue Cleared</h3>
                        <p className="text-sm text-ink-soft">
                            {query
                                ? "No organizations match your search."
                                : `No ${filterStatus} organization requests right now.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredApps.map((app) => {
                            const status = statusOf(app);
                            const style = STATUS_STYLE[status] || STATUS_STYLE.pending;
                            const StatusIcon = style.icon;
                            const busy = processingId === app.id;
                            const applicantName = app.profiles?.full_name || app.profiles?.email || "Student Applicant";

                            return (
                                <div
                                    key={app.id}
                                    className={`bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4 transition-all ${busy ? "opacity-50 pointer-events-none" : ""
                                        }`}
                                >
                                    {/* CARD HEADER */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className={`p-2 rounded-xl border ${style.iconBox}`}>
                                                <StatusIcon size={18} />
                                            </span>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-foreground truncate">
                                                    Organization:{" "}
                                                    <span className="text-rose-600 dark:text-rose-400">{app.org_name}</span>
                                                </h4>
                                                <p className="text-xs text-ink-soft flex items-center gap-2 mt-0.5">
                                                    <span>
                                                        Submitted by: <strong>{applicantName}</strong>
                                                    </span>
                                                    {app.created_at && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock size={12} /> {new Date(app.created_at).toLocaleString()}
                                                            </span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <span
                                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border w-fit ${style.chip}`}
                                        >
                                            {style.label}
                                        </span>
                                    </div>

                                    {/* APPLICANT + ORGANIZATION DETAILS */}
                                    <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                                        <div className="flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl border border-line bg-tint">
                                            <Avatar name={applicantName} url={app.profiles?.avatar_url} size={40} />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Applicant</p>
                                                <p className="text-sm font-bold text-foreground truncate">{applicantName}</p>
                                                {app.profiles?.email && (
                                                    <p className="text-[11px] text-ink-soft truncate">{app.profiles.email}</p>
                                                )}
                                                {app.profiles?.is_verified_org && (
                                                    <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                                        <ShieldCheck size={12} /> Verified organization
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0 grid gap-2 p-3 rounded-xl border border-line bg-tint">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <GraduationCap size={16} className="text-ink-soft shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Department</p>
                                                    <p className="text-sm font-bold text-foreground truncate">{app.department || "Not provided"}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Mail size={16} className="text-ink-soft shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Contact email</p>
                                                    <p className="text-sm font-bold text-foreground truncate select-all">
                                                        {app.contact_email || "Not provided"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* DESCRIPTION BOX */}
                                    <div className="p-3.5 rounded-xl bg-tint border border-line">
                                        <p className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-1">
                                            About the Organization
                                        </p>
                                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line font-medium">
                                            {app.description ? `"${app.description}"` : "No description was provided."}
                                        </p>
                                    </div>

                                    {/* ACTION BUTTONS */}
                                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                                        {status === "pending" && (
                                            <>
                                                <button
                                                    onClick={() => requestStatusChange(app, "rejected")}
                                                    disabled={busy}
                                                    className={btn("dangerOutline", "sm")}
                                                >
                                                    <X size={14} /> Reject
                                                </button>
                                                <button
                                                    onClick={() => requestStatusChange(app, "approved")}
                                                    disabled={busy}
                                                    className={btn("primary", "sm")}
                                                >
                                                    <Check size={14} /> Approve
                                                </button>
                                            </>
                                        )}

                                        {status === "approved" && (
                                            <button
                                                onClick={() => requestStatusChange(app, "revoked")}
                                                disabled={busy}
                                                className={btn("dangerOutline", "sm")}
                                            >
                                                <ShieldOff size={14} /> Revoke Verification
                                            </button>
                                        )}

                                        {(status === "rejected" || status === "revoked") && (
                                            <>
                                                <button
                                                    onClick={() => deleteApplication(app)}
                                                    disabled={busy}
                                                    className={btn("dangerOutline", "sm")}
                                                    title="Remove from list"
                                                >
                                                    <Trash2 size={14} /> Remove
                                                </button>
                                                <button
                                                    onClick={() => requestStatusChange(app, "approved")}
                                                    disabled={busy}
                                                    className={btn("primary", "sm")}
                                                >
                                                    <RotateCcw size={14} /> Re-Approve
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* CONFIRMATION POPUP */}
            {confirmAction && (() => {
                const { app, newStatus } = confirmAction;
                const copy = CONFIRM_COPY[`${app.status}->${newStatus}`];
                const busy = processingId === app.id;
                const isApprove = newStatus === "approved";

                return (
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={closeConfirm}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md rounded-2xl border border-line bg-surface text-foreground p-6 shadow-2xl"
                        >
                            <h2 className="text-lg font-bold mb-1">{copy.title}</h2>
                            <p className="text-sm text-ink-soft mb-6">{copy.message(app.org_name)}</p>

                            <div className="flex justify-end gap-3">
                                <button onClick={closeConfirm} disabled={busy} className={btn("outline", "sm")}>
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={busy}
                                    className={btn(isApprove ? "primary" : "danger", "sm")}
                                >
                                    {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                                    {copy.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}