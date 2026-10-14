"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ShieldCheck, Database, Activity, Terminal } from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PING_EVERY_MS = 60_000;
const SLOW_MS = 1000;
const TIMEOUT_MS = 8000;

const STATUS_UI = {
  checking: { label: "Checking…", color: "text-purple-300" },
  healthy: { label: "Healthy", color: "text-emerald-400" },
  slow: { label: "Slow", color: "text-amber-400" },
  down: { label: "Unreachable", color: "text-rose-400" },
};

async function pingDatabase() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?select=id&limit=1`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      signal: controller.signal,
      cache: "no-store",
    });
    const ms = Math.round(performance.now() - started);
    if (res.status >= 500) return { state: "down", ms };
    return { state: ms > SLOW_MS ? "slow" : "healthy", ms };
  } catch {
    return { state: "down", ms: null };
  } finally {
    clearTimeout(timer);
  }
}

export default function AdminFooter() {
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState({ state: "checking", ms: null });

  useEffect(() => {
    let isMounted = true;
    let checkedUserId = null;

    async function checkRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          checkedUserId = null;
          if (isMounted) {
            setUserRole(null);
            setLoading(false);
          }
          return;
        }

        checkedUserId = user.id;
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
      (event, session) => {
        if (!session?.user) {
          checkedUserId = null;
          setUserRole(null);
          setLoading(false);
          return;
        }
        // Token refreshes and the first event don't change who is logged in
        if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
        // Only look the role up again when a different user signs in
        if (session.user.id !== checkedUserId) checkRole();
      }
    );

    // Same event the Sidebar listens to, so role changes still show up right away
    window.addEventListener("user-role-changed", checkRole);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener("user-role-changed", checkRole);
    };
  }, []);

  // Live health check: only admins see the footer, so only they ping
  useEffect(() => {
    if (!userRole) return;

    let cancelled = false;
    let running = false;

    const run = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      const result = await pingDatabase();
      running = false;
      if (!cancelled) setHealth(result);
    };

    run();
    const timer = setInterval(run, PING_EVERY_MS);
    document.addEventListener("visibilitychange", run);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [userRole]);

  if (loading || !userRole) return null;

  const status = STATUS_UI[health.state];

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
            <Database size={13} className={status.color} />
            <span className="text-purple-300">DB Status:</span>
            <span className={`${status.color} font-semibold`}>{status.label}</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5">
            <Activity size={13} className={status.color} />
            <span className="text-purple-300">Latency:</span>
            <span className={`${status.color} font-semibold`}>
              {health.ms == null ? "—" : `${health.ms} ms`}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5">
            <Terminal size={13} className="text-purple-300" />
            <span className="text-purple-300">Environment:</span>
            <span className="text-purple-200 font-semibold">{process.env.NODE_ENV}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}