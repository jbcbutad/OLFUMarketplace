"use client";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, Building2, Clock, Send, ShieldCheck, AlertCircle, XCircle, Loader2 } from "lucide-react";
import MerchTermsModal from "@/components/MerchTermsModal";

// Shared field styles so every input matches the Edit Listing form
const LABEL = "block text-xs font-bold uppercase tracking-wider mb-2 text-foreground";
const INPUT =
    "w-full bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl p-3.5 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-foreground placeholder:text-neutral-400";

export default function OrgApplyPage() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [existingApp, setExistingApp] = useState(null);
    const [isVerified, setIsVerified] = useState(false);
    const [isFaculty, setIsFaculty] = useState(false); // Tracks if logged-in user is faculty/staff
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [showMerchTerms, setShowMerchTerms] = useState(false); // Controls the merchandise terms modal state

    const [formData, setFormData] = useState({
        org_name: "",
        department: "",
        contact_email: "",
        description: "",
    });

    useEffect(() => {
        async function checkStatus() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            // Check profile verification status and role
            const { data: profile } = await supabase
                .from("profiles")
                .select("is_verified_org, org_name, role")
                .eq("id", user.id)
                .single();

            if (profile?.is_verified_org) {
                setIsVerified(true);
            }

            // Check if user is faculty based on email domain or profile role
            const userEmail = user.email || "";
            const isFacultyUser =
                profile?.role === "faculty" ||
                profile?.role === "admin" ||
                !userEmail.endsWith("@student.fatima.edu.ph");

            setIsFaculty(isFacultyUser);

            // If faculty, pre-fill contact email for convenience
            if (isFacultyUser && userEmail) {
                setFormData((prev) => ({ ...prev, contact_email: userEmail }));
            }

            // Check previous application
            const { data: app } = await supabase
                .from("org_applications")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (app) {
                setExistingApp(app);
            }

            setLoading(false);
        }

        checkStatus();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!agreedToTerms) {
            toast.error("You must agree to the Official Merchandise Terms and Conditions before submitting your application.");
            return;
        }

        setSubmitting(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error("You must be logged in to apply.");

            const { error } = await supabase.from("org_applications").insert([
                {
                    user_id: user.id,
                    org_name: formData.org_name,
                    department: formData.department,
                    contact_email: formData.contact_email,
                    description: formData.description,
                    status: "pending",
                },
            ]);

            if (error) throw error;

            setExistingApp({
                org_name: formData.org_name,
                status: "pending",
                created_at: new Date().toISOString(),
            });
        } catch (err) {
            toast.error(err.message || "Failed to submit application.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen text-foreground flex flex-col items-center justify-center w-full">
                <Loader2 className="animate-spin text-foreground mb-2" size={32} />
                <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">Loading Organization Portal...</p>
            </div>
        );
    }

    const isRejected = existingApp?.status === "rejected";

    return (
        <div className="min-h-screen text-foreground p-4 sm:p-6 md:p-10 transition-colors">
            <div className="max-w-3xl mx-auto">
                <Link
                    href="/categories?category=Merchandise"
                    className="inline-flex items-center gap-2 text-neutral-500 hover:text-foreground text-xs font-black uppercase tracking-wider mb-6 transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Merchandise
                </Link>

                {isVerified ? (
                    <div className="bg-neutral-50 dark:bg-neutral-900 border border-emerald-600/50 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
                        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                            <ShieldCheck size={36} />
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Official Organization Status Active</h1>
                        <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-md mx-auto leading-relaxed">
                            Your account is verified as an official organization seller. All your merchandise listings will feature the official badge.
                        </p>
                        <Link
                            href="/create-listing?merch=true"
                            className="inline-block px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-black uppercase tracking-wider text-xs rounded-xl transition-all active:scale-95 shadow-md"
                        >
                            Post Merchandise Listing
                        </Link>
                    </div>
                ) : existingApp && existingApp.status === "pending" ? (
                    <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-neutral-900 dark:border-white rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
                        <div className="w-16 h-16 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
                            <Clock size={36} />
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Application Under Review</h1>
                        <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-md mx-auto leading-relaxed">
                            Your application for <span className="font-bold text-foreground">{existingApp.org_name}</span> has been submitted and is awaiting administrator approval.
                        </p>
                    </div>
                ) : (
                    <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-900 dark:border-white rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm space-y-6">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
                                <Building2 size={28} />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Organization Seller Application</h1>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                    Register your club, council, or department for official merchandise selling rights
                                </p>
                            </div>
                        </div>

                        {/* Previous application was rejected: tell them they can reapply */}
                        {isRejected && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-xs text-red-700 dark:text-red-400 font-semibold leading-relaxed">
                                <XCircle size={18} className="shrink-0 mt-0.5" />
                                <span>
                                    Your previous application for <strong>{existingApp.org_name}</strong> was not approved. You can update the details below and apply again.
                                </span>
                            </div>
                        )}

                        {/* Conditional verification requirements notice */}
                        {!isFaculty ? (
                            <div className="p-4 sm:p-5 bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl space-y-3 text-xs text-foreground leading-relaxed">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black uppercase tracking-wider text-[11px]">
                                    <AlertCircle size={16} /> Important Verification Requirement
                                </div>
                                <p className="text-neutral-600 dark:text-neutral-400 font-medium">
                                    To ensure institutional authenticity and protect the student body, student-led organization applications require formal endorsement. Please have your designated <strong className="text-foreground">Organization Adviser or Faculty Professor</strong> send a confirmation email to <span className="text-foreground font-bold underline break-all">olfumarketplace@gmail.com</span>.
                                </p>
                                <p className="text-neutral-600 dark:text-neutral-400">
                                    The email body must explicitly state the professor&apos;s endorsement of your organization and formally list authorized student representatives. Failure to complete this step will result in processing delays.
                                </p>
                            </div>
                        ) : (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-600/30 rounded-xl flex items-center gap-3 text-emerald-700 dark:text-emerald-400 text-xs font-semibold leading-relaxed">
                                <ShieldCheck size={20} className="shrink-0" />
                                <span>Faculty account detected: You can freely submit this application without external adviser email verifications.</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="org_name" className={LABEL}>
                                    Organization / Club / Department Name
                                </label>
                                <input
                                    id="org_name"
                                    type="text"
                                    required
                                    placeholder="e.g. OLFU Computer Society"
                                    value={formData.org_name}
                                    onChange={(e) => setFormData({ ...formData, org_name: e.target.value })}
                                    className={INPUT}
                                />
                            </div>

                            <div>
                                <label htmlFor="department" className={LABEL}>
                                    Department / College / Campus
                                </label>
                                <input
                                    id="department"
                                    type="text"
                                    required
                                    placeholder="e.g. College of Computer Studies - Valenzuela"
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className={INPUT}
                                />
                            </div>

                            <div>
                                <label htmlFor="contact_email" className={LABEL}>
                                    Official Contact Email
                                </label>
                                <input
                                    id="contact_email"
                                    type="email"
                                    required
                                    placeholder="e.g. org.cs@student.fatima.edu.ph"
                                    value={formData.contact_email}
                                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                    className={INPUT}
                                />
                            </div>

                            <div>
                                <label htmlFor="description" className={LABEL}>
                                    Organization Description &amp; Purpose
                                </label>
                                <textarea
                                    id="description"
                                    rows={4}
                                    required
                                    placeholder="Describe your organization and the merchandise you intend to sell..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className={`${INPUT} resize-none`}
                                />
                            </div>

                            {/* Terms and conditions checkbox with merch modal trigger */}
                            <div className="flex items-start gap-3 pt-1">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 shrink-0 rounded border-neutral-400 accent-emerald-700 cursor-pointer"
                                />
                                <label htmlFor="terms" className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                    I agree to the{" "}
                                    <button
                                        type="button"
                                        onClick={() => setShowMerchTerms(true)}
                                        className="text-foreground underline font-bold hover:opacity-80 cursor-pointer bg-transparent border-0 p-0 inline"
                                    >
                                        Official OLFU Merchandise Terms &amp; Conditions
                                    </button>{" "}
                                    for official merchandise sellers, and I confirm that all details provided are true and authorized by the institution.
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !agreedToTerms}
                                className="w-full py-3.5 bg-foreground text-background font-black uppercase tracking-wider text-xs rounded-xl hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                            >
                                {submitting ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <>
                                        <Send size={16} /> Submit Application
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Merchandise terms modal popup */}
            <MerchTermsModal isOpen={showMerchTerms} onClose={() => setShowMerchTerms(false)} />
        </div>
    );
}