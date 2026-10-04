"use client";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, Building2, Clock, Send, ShieldCheck, AlertCircle } from "lucide-react";
import MerchTermsModal from "@/components/MerchTermsModal";

export default function OrgApplyPage() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [existingApp, setExistingApp] = useState(null);
    const [isVerified, setIsVerified] = useState(false);
    const [isFaculty, setIsFaculty] = useState(false); // 👉 Tracks if logged-in user is faculty/staff
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [showMerchTerms, setShowMerchTerms] = useState(false); // 👉 Controls the merchandise terms modal state

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
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <p className="text-muted-foreground font-bold">Loading organization portal...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-foreground p-6 md:p-10">
            <div className="max-w-3xl mx-auto">
                <Link
                    href="/categories?category=Merchandise"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium mb-6 transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Merchandise
                </Link>

                {isVerified ? (
                    <div className="bg-card border border-emerald-500/30 rounded-3xl p-8 text-center space-y-4 shadow-lg">
                        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                            <ShieldCheck size={36} />
                        </div>
                        <h1 className="text-2xl font-black">Official Organization Status Active!</h1>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                            Your account is verified as an official organization seller. All your merchandise listings will feature the official badge!
                        </p>
                        <Link
                            href="/create-listing"
                            className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all"
                        >
                            Post Merchandise Listing
                        </Link>
                    </div>
                ) : existingApp && existingApp.status === "pending" ? (
                    <div className="bg-card border border-amber-500/30 rounded-3xl p-8 text-center space-y-4 shadow-lg">
                        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                            <Clock size={36} />
                        </div>
                        <h1 className="text-2xl font-black">Application Under Review</h1>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                            Your application for <span className="font-bold text-foreground">{existingApp.org_name}</span> has been submitted and is awaiting administrator approval.
                        </p>
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                                <Building2 size={28} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black">Organization Seller Application</h1>
                                <p className="text-xs text-muted-foreground">Register your club, council, or department for official merchandise selling rights</p>
                            </div>
                        </div>

                        {/* 👉 Conditional Verification Requirements Notice */}
                        {!isFaculty ? (
                            <div className="p-5 bg-card border border-neutral-300 dark:border-neutral-700 rounded-2xl space-y-3 text-xs text-foreground leading-relaxed shadow-sm">
                                <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 font-black uppercase tracking-wider text-[11px]">
                                    <AlertCircle size={16} /> Important Verification Requirement
                                </div>
                                <p className="text-muted-foreground font-medium">
                                    To ensure institutional authenticity and protect the student body, student-led organization applications require formal endorsement. Please have your designated <strong className="text-foreground">Organization Adviser or Faculty Professor</strong> send a confirmation email to <span className="text-foreground font-bold underline">olfumarketplace@fatima.edu.ph</span>.
                                </p>
                                <p className="text-muted-foreground">
                                    The email body must explicitly state the professor&apos;s endorsement of your organization and formally list authorized student representatives. Failure to complete this step will result in processing delays.
                                </p>
                            </div>
                        ) : (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                                <ShieldCheck size={20} className="shrink-0" />
                                <span>Faculty account detected: You can freely submit this application without external adviser email verifications.</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-2">
                                    Organization / Club / Department Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. OLFU Computer Society"
                                    value={formData.org_name}
                                    onChange={(e) => setFormData({ ...formData, org_name: e.target.value })}
                                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-foreground"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-2">
                                    Department / College / Campus
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. College of Computer Studies - Valenzuela"
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-foreground"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-2">
                                    Official Contact Email
                                </label>
                                <input
                                    type="email"
                                    required
                                    placeholder="e.g. org.cs@student.fatima.edu.ph"
                                    value={formData.contact_email}
                                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-foreground"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-2">
                                    Organization Description & Purpose
                                </label>
                                <textarea
                                    rows={4}
                                    required
                                    placeholder="Describe your organization and the merchandise you intend to sell..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-foreground resize-none"
                                />
                            </div>

                            {/* 👉 TERMS AND CONDITIONS CHECKBOX WITH MERCH MODAL TRIGGER */}
                            <div className="flex items-start gap-3 pt-2">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded border-border accent-emerald-600 cursor-pointer"
                                />
                                <label htmlFor="terms" className="text-xs text-muted-foreground leading-normal">
                                    I agree to the{" "}
                                    <button
                                        type="button"
                                        onClick={() => setShowMerchTerms(true)}
                                        className="text-foreground underline font-semibold hover:opacity-80 cursor-pointer bg-transparent border-0 p-0 inline"
                                    >
                                        Official OLFU Merchandise Terms & Conditions
                                    </button>{" "}
                                    for official merchandise sellers, and I confirm that all details provided are true and authorized by the institution.
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !agreedToTerms}
                                className="w-full py-3.5 bg-foreground text-background font-bold rounded-xl text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                <Send size={16} /> Submit Application
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* 👉 MERCHANDISE TERMS MODAL POPUP */}
            <MerchTermsModal isOpen={showMerchTerms} onClose={() => setShowMerchTerms(false)} />
        </div>
    );
}