import { createClient } from "@/lib/supabase/server";
import { Users, ShoppingBag, Flag, ShieldAlert } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";

export default async function AdminDashboardPage() {
  await requireRole(["admin", "super_admin", "superadmin"]);
  const supabase = await createClient();

  // Aggregate Metrics in Parallel
  const [usersCount, productsCount, reportsCount] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
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
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Telemetry</h1>
        <p className="text-muted-foreground text-sm">
          Platform performance and real-time operational status.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-card space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-medium">Total Registered Users</span>
            <Users size={20} />
          </div>
          <p className="text-3xl font-bold">{usersCount.count || 0}</p>
        </div>

        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-card space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-medium">Active Marketplace Products</span>
            <ShoppingBag size={20} />
          </div>
          <p className="text-3xl font-bold">{productsCount.count || 0}</p>
        </div>

        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-card space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-medium">Flagged Reports</span>
            <Flag size={20} className="text-red-500" />
          </div>
          <p className="text-3xl font-bold text-red-500">{reportsCount.count || 0}</p>
        </div>
      </div>

      {/* Recent Flagged Activity Feed */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-card p-6 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShieldAlert size={20} className="text-amber-500" /> Recent Safety Flags
        </h2>

        {recentReports && recentReports.length > 0 ? (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {recentReports.map((report) => (
              <div key={report.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold">{report.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Reported user: {report.profiles?.full_name || report.profiles?.email || "Unknown User"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(report.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">No recent safety flags found.</p>
        )}
      </div>
    </div>
  );
}