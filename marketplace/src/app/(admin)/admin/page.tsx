import { createClient } from "@/lib/supabase/server";
import { Users, ShoppingBag, Flag, ShieldAlert, LayoutDashboard } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { ui } from "./ui";

export default async function AdminDashboardPage() {
  await requireRole(["admin", "super_admin", "superadmin"]);
  const supabase = await createClient();

  // Aggregate Metrics in Parallel
  const [usersCount, productsCount, reportsCount] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("reports").select("*", { count: "exact", head: true }),
  ]);

  // Fetch recent reports for quick action
  const { data: recentReports } = await supabase
    .from("reports")
    .select("*, profiles!reports_reported_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className={ui.page}>
      <div>
        <h1 className={ui.title}>
          <LayoutDashboard className={ui.titleIcon} size={28} /> System Telemetry
        </h1>
        <p className={ui.subtitle}>
          Platform performance and real-time operational status.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${ui.card} p-6 space-y-2`}>
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-bold uppercase tracking-wider">Total Registered Users</span>
            <Users size={18} className="text-brand" />
          </div>
          <p className="text-3xl font-extrabold text-foreground">{usersCount.count || 0}</p>
        </div>

        <div className={`${ui.card} p-6 space-y-2`}>
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-bold uppercase tracking-wider">Marketplace Products</span>
            <ShoppingBag size={18} className="text-gold" />
          </div>
          <p className="text-3xl font-extrabold text-foreground">{productsCount.count || 0}</p>
        </div>

        <div className={`${ui.card} p-6 space-y-2`}>
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-bold uppercase tracking-wider">Flagged Reports</span>
            <Flag size={18} className="text-red-600 dark:text-red-400" />
          </div>
          <p className="text-3xl font-extrabold text-red-600 dark:text-red-400">{reportsCount.count || 0}</p>
        </div>
      </div>

      {/* Recent Flagged Activity Feed */}
      <div className={`${ui.card} overflow-hidden`}>
        <div className={`px-6 py-4 ${ui.tableHead} flex items-center gap-2`}>
          <ShieldAlert size={16} className="text-gold" /> Recent Safety Flags
        </div>

        {recentReports && recentReports.length > 0 ? (
          <div className="divide-y divide-line">
            {recentReports.map((report) => (
              <div key={report.id} className="px-6 py-4 flex items-center justify-between gap-4 text-sm hover:bg-tint/50 transition-colors">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{report.reason}</p>
                  <p className="text-xs text-ink-soft">
                    Reported user: {report.profiles?.full_name || report.profiles?.email || "Unknown User"}
                  </p>
                </div>
                <span className="text-xs text-ink-soft shrink-0">
                  {new Date(report.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft px-6 py-8 text-center">No recent safety flags found.</p>
        )}
      </div>
    </div>
  );
}