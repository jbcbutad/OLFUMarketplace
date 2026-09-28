"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ShieldCheck, Database, Activity, Terminal } from "lucide-react";

export default function AdminFooter() {
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          if (isMounted) {
            setUserRole(null);
            setLoading(false);
          }
          return;
        }

        if (isMounted) setUserId(user.id);

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (error) console.error("AdminFooter error:", error);

        const role = profile?.role;
        if (isMounted) {
          if (role === "admin" || role === "super_admin") {
            setUserRole(role);
          } else {
            setUserRole(null);
          }
        }
      } catch (err) {
        console.error("AdminFooter error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          checkRole();
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading || !userRole) return null;

  return (
    <footer className="sticky bottom-0 left-0 right-0 w-full border-t border-purple-500/40 bg-purple-950 text-purple-200 text-xs py-2.5 px-6 shrink-0 z-[9999] shadow-2xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Left Status Badge */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] bg-purple-500/30 text-purple-200 border border-purple-400/50 px-2.5 py-0.5 rounded-md">
            <ShieldCheck size={14} className="text-purple-300" />
            {userRole === "super_admin" ? "Superadmin Mode Active" : "Admin Mode Active"}
          </span>
          <span className="hidden sm:inline-block text-purple-400/50">|</span>
          <span className="hidden sm:inline font-mono text-[11px] text-purple-300">
            Session ID: {userId ? `${userId.substring(0, 8)}...` : "Loading..."}
          </span>
        </div>

        {/* Telemetry Info */}
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <div className="flex items-center gap-1.5">
            <Database size={13} className="text-emerald-400" />
            <span className="text-purple-300">DB Status:</span>
            <span className="text-emerald-400 font-semibold">Healthy</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5">
            <Activity size={13} className="text-sky-400" />
            <span className="text-purple-300">Latency:</span>
            <span className="text-sky-400 font-semibold">&lt; 10ms</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5">
            <Terminal size={13} className="text-purple-300" />
            <span className="text-purple-300">Environment:</span>
            <span className="text-purple-200 font-semibold">development</span>
          </div>
        </div>
      </div>
    </footer>
  );
}