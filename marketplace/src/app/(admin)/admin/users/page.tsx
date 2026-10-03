import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import RoleSelect from "../RoleSelect";
import UnbanButton from "./UnbanButton";
import BanButton from "./BanButton";
import { Users, ShieldAlert, UserCheck, Search } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const STAFF_ROLES = ["super_admin", "superadmin", "admin", "moderator"];

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; type?: string; page?: string }>;
}) {
  const { user, role: viewerRole } = await requireRole(["admin", "super_admin", "superadmin"]);
  const canChangeRoles = viewerRole === "super_admin" || viewerRole === "superadmin";
  const currentUserId = user.id;

  const sp = await searchParams;
  const q = (sp.q || "").replace(/[,()%*\\]/g, " ").trim();
  const roleFilter = sp.role || "all";
  const statusFilter = sp.status || "all";
  const typeFilter = sp.type === "student" || sp.type === "faculty" ? sp.type : "all";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select('id, full_name, email, role, avatar_url, "First_Name", "Last_Name", is_banned', { count: "exact" })
    .order("email", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) {
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,First_Name.ilike.%${q}%,Last_Name.ilike.%${q}%`);
  }
  if (roleFilter === "super_admin") query = query.in("role", ["super_admin", "superadmin"]);
  else if (roleFilter === "user") query = query.or("role.is.null,role.eq.user");
  else if (roleFilter !== "all") query = query.eq("role", roleFilter);
  if (statusFilter === "banned") query = query.eq("is_banned", true);
  if (typeFilter === "student") query = query.ilike("email", "%@student.fatima.edu.ph");
  else if (typeFilter === "faculty") query = query.ilike("email", "%@fatima.edu.ph");

  const { data: users, count, error } = await query;
  if (error) console.error("Error fetching users list:", error);
  // Ban reasons come from a staff-only function, not a direct column read
  const bannedIds = (users ?? []).filter((u: any) => u.is_banned).map((u: any) => u.id);
  const banReasons: Record<string, string> = {};
  if (bannedIds.length > 0) {
    const { data: reasonRows, error: reasonErr } = await supabase.rpc("admin_get_ban_reasons", {
      p_ids: bannedIds,
    });
    if (reasonErr) console.error("Error fetching ban reasons:", reasonErr);
    for (const r of (reasonRows ?? []) as { id: string; ban_reason: string | null }[]) {
      if (r.ban_reason) banReasons[r.id] = r.ban_reason;
    }
  }

  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };

  const tabHref = (t: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (t !== "all") params.set("type", t);
    const s = params.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };

  const emailType = (email?: string | null) => {
    const e = (email || "").toLowerCase();
    if (e.endsWith("@student.fatima.edu.ph")) return "student";
    if (e.endsWith("@fatima.edu.ph")) return "faculty";
    return "other";
  };
  const resolveDisplayName = (u: any) => {
    const derived = `${u.First_Name || ""} ${u.Last_Name || ""}`.trim();
    return u.full_name || (derived.length > 0 ? derived : null) || u.email || "Unnamed Account";
  };

  const { data: meRow } = await supabase
    .from("profiles")
    .select('full_name, avatar_url, email, "First_Name", "Last_Name"')
    .eq("id", currentUserId)
    .maybeSingle();
  const loggedInDisplayName = meRow ? resolveDisplayName(meRow) : user.email || "Unknown User";
  const loggedInAvatarUrl = meRow?.avatar_url;

  const inputCls =
    "bg-background text-foreground text-xs font-semibold px-3 py-2 rounded-xl border border-border outline-none";

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* HEADER & LOGGED-IN BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Users className="text-purple-400" size={28} /> User Directory
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage system permissions, roles, bans, and administrative access across all accounts.
          </p>
        </div>

        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-card border border-border shadow-sm">
          <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-xs text-foreground shrink-0 overflow-hidden">
            {loggedInAvatarUrl ? (
              <img src={loggedInAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              loggedInDisplayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="text-left overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <UserCheck size={12} className="text-emerald-500" /> Logged In As
            </p>
            <p className="text-xs font-bold text-foreground truncate max-w-[200px]">{loggedInDisplayName}</p>
          </div>
        </div>
      </div>

      {/* ACCOUNT TYPE TABS */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "All" },
          { key: "student", label: "Students" },
          { key: "faculty", label: "Faculty" },
        ].map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${typeFilter === t.key
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* SEARCH & FILTERS (plain GET form, no client JS) */}
      <form method="get" action="/admin/users" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="type" value={typeFilter} />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or email"
            className={`${inputCls} pl-8 w-64`}
          />
        </div>
        <select name="role" defaultValue={roleFilter} className={inputCls}>
          <option value="all">All roles</option>
          <option value="super_admin">Super admin</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="user">User</option>
        </select>
        <select name="status" defaultValue={statusFilter} className={inputCls}>
          <option value="all">All accounts</option>
          <option value="banned">Banned only</option>
        </select>
        <button type="submit" className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold cursor-pointer">
          Apply
        </button>
        {(q || roleFilter !== "all" || statusFilter !== "all" || typeFilter !== "all") && (
          <Link href="/admin/users" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Clear
          </Link>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{count ?? 0} accounts</span>
      </form>

      <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-4 px-6 py-3.5 bg-muted/50 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-4">User</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Current Role</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>

        <div className="divide-y divide-border">
          {users && users.length > 0 ? (
            users.map((u: any) => {
              const displayName = resolveDisplayName(u);
              const isMe = u.id === currentUserId;
              const targetIsStaff = STAFF_ROLES.includes(u.role || "");
              // Matches the database rule: only super admins can ban staff accounts
              const canBan = !isMe && !u.is_banned && (!targetIsStaff || canChangeRoles);

              return (
                <div
                  key={u.id}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 items-center text-sm transition-colors ${isMe ? "bg-accent/40 hover:bg-accent/60 font-medium" : "hover:bg-muted/30"}`}
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-xs text-foreground shrink-0 overflow-hidden">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-foreground truncate flex items-center gap-1.5">
                        {displayName}
                        {isMe && (
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-foreground text-background rounded-md">
                            You
                          </span>
                        )}
                        {emailType(u.email) === "student" && (
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-sky-950 text-sky-300 border border-sky-800 rounded-md">
                            Student
                          </span>
                        )}
                        {emailType(u.email) === "faculty" && (
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-amber-950 text-amber-300 border border-amber-800 rounded-md">
                            Faculty
                          </span>
                        )}
                        {u.is_banned && (
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-rose-600 text-white rounded-md">
                            Banned
                          </span>
                        )}
                      </span>
                      {u.is_banned && banReasons[u.id] && (
                        <p className="text-[11px] text-rose-500 truncate">Reason: {banReasons[u.id]}</p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-3 text-muted-foreground text-xs truncate">
                    {u.email || "No Email Provided"}
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${u.role === "super_admin" || u.role === "superadmin"
                        ? "bg-purple-950 text-purple-300 border border-purple-800"
                        : u.role === "admin"
                          ? "bg-blue-950 text-blue-300 border border-blue-800"
                          : u.role === "moderator"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                    >
                      {u.role || "user"}
                    </span>
                  </div>

                  <div className="col-span-3 flex flex-col items-end gap-1.5">
                    {canChangeRoles ? (
                      <RoleSelect userId={u.id} currentRole={u.role || "user"} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Super admin only</span>
                    )}
                    {canBan && <BanButton userId={u.id} name={displayName} />}
                    {u.is_banned && <UnbanButton userId={u.id} name={displayName} />}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <ShieldAlert size={32} className="mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-semibold">No accounts match.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try a different search, or clear the filters.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          {page > 1 ? (
            <Link href={buildHref(page - 1)} className="px-3 py-2 rounded-xl border border-border font-bold hover:bg-accent">
              ← Previous
            </Link>
          ) : <span />}
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={buildHref(page + 1)} className="px-3 py-2 rounded-xl border border-border font-bold hover:bg-accent">
              Next →
            </Link>
          ) : <span />}
        </div>
      )}
    </div>
  );
}