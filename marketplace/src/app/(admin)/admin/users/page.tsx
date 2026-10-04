import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import RoleSelect from "../RoleSelect";
import UnbanButton from "./UnbanButton";
import BanButton from "./BanButton";
import { ui, btn, pillTone, roleStyle, roleLabel } from "../ui";
import { Users, ShieldAlert, UserCheck, Search, Ban, Lock } from "lucide-react";

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

  const inputCls = `${ui.input} text-xs font-semibold`;
  const hasFilters = q || roleFilter !== "all" || statusFilter !== "all" || typeFilter !== "all";

  return (
    <div className={ui.page}>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={ui.title}>
            <Users className={ui.titleIcon} size={28} /> User Directory
          </h1>
          <p className={ui.subtitle}>
            Manage roles, bans, and administrative access across all accounts.
          </p>
        </div>

        <div className={`${ui.card} flex items-center gap-3 px-4 py-2.5`}>
          <div className="w-9 h-9 rounded-full bg-tint border border-line flex items-center justify-center font-bold text-xs text-brand-deep shrink-0 overflow-hidden">
            {loggedInAvatarUrl ? (
              <img src={loggedInAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              loggedInDisplayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="text-left overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1">
              <UserCheck size={12} className="text-brand" /> Signed in as
            </p>
            <p className="text-xs font-bold text-foreground truncate max-w-[200px]">{loggedInDisplayName}</p>
          </div>
        </div>
      </div>

      {/* FILTER BAR: account type tabs + search (plain GET form, no client JS) */}
      <div className={`${ui.card} p-4 flex flex-col lg:flex-row lg:items-center gap-3`}>
        <div className="inline-flex p-1 rounded-xl bg-tint border border-line self-start">
          {[
            { key: "all", label: "All" },
            { key: "student", label: "Students" },
            { key: "faculty", label: "Faculty" },
          ].map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${typeFilter === t.key
                ? "bg-brand text-on-brand shadow-sm"
                : "text-ink-soft hover:text-brand-deep"
                }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <form method="get" action="/admin/users" className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <input type="hidden" name="type" value={typeFilter} />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name or email"
              className={`${inputCls} pl-8 w-60`}
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
          <button type="submit" className={btn("primary", "sm")}>
            Apply
          </button>
          {hasFilters && (
            <Link href="/admin/users" className="text-xs font-semibold text-ink-soft hover:text-brand-deep hover:underline">
              Clear
            </Link>
          )}
        </form>
      </div>


      {/* TABLE */}
      <div className={`${ui.card} overflow-hidden`}>
        <div className={`hidden md:grid grid-cols-12 gap-4 px-5 py-3 ${ui.tableHead}`}>
          <div className="col-span-4 flex items-center gap-2">
            <span>User</span>
            <span className="text-[10px] font-semibold text-ink-soft bg-background border border-line rounded-full px-2 py-0.5">
              {count ?? 0} {count === 1 ? "account" : "accounts"}
            </span>
          </div>

          <div className="col-span-2">Role</div>

          <div className="col-span-2">Status</div>

          <div className="col-span-4 text-right">Actions</div>
        </div>

        <div className="divide-y divide-line">
          {users && users.length > 0 ? (
            users.map((u: any) => {
              const displayName = resolveDisplayName(u);
              const isMe = u.id === currentUserId;
              const targetIsStaff = STAFF_ROLES.includes(u.role || "");
              const type = emailType(u.email);
              // Matches the database rule: only super admins can ban staff accounts
              const canBan = !isMe && !u.is_banned && (!targetIsStaff || canChangeRoles);

              return (
                <div
                  key={u.id}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-5 py-4 items-center text-sm transition-colors ${isMe ? "bg-tint/70" : "hover:bg-tint/50"}`}
                >
                  {/* User */}
                  <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-tint border border-line flex items-center justify-center font-bold text-sm text-brand-deep shrink-0 overflow-hidden">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-foreground truncate">{displayName}</span>
                        {isMe && <span className={`${ui.pill} ${pillTone.you}`}>You</span>}
                        {type === "student" && <span className={`${ui.pill} ${pillTone.student}`}>Student</span>}
                        {type === "faculty" && <span className={`${ui.pill} ${pillTone.faculty}`}>Faculty</span>}
                      </div>
                      <p className="text-xs text-ink-soft truncate">{u.email || "No email provided"}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="md:col-span-2">
                    <span className={`${ui.pill} ${roleStyle(u.role)} !text-[11px] !px-2.5 !py-1 !rounded-lg`}>
                      {roleLabel(u.role)}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="md:col-span-2 min-w-0">
                    {u.is_banned ? (
                      <>
                        <span className={`${ui.pill} ${pillTone.banned} !text-[11px] !px-2.5 !py-1 !rounded-lg`}>
                          <Ban size={11} /> Banned
                        </span>
                        {banReasons[u.id] && (
                          <p
                            className="text-[11px] text-red-600 dark:text-red-400 mt-1 line-clamp-2"
                            title={banReasons[u.id]}
                          >
                            {banReasons[u.id]}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className={`${ui.pill} ${pillTone.active} !text-[11px] !px-2.5 !py-1 !rounded-lg`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                      </span>
                    )}
                  </div>

                  {/* Actions: role dropdown, then ban/unban, always in one row */}
                  <div className="md:col-span-4 flex items-center md:justify-end gap-2">
                    {canChangeRoles ? (
                      <RoleSelect userId={u.id} currentRole={u.role || "user"} />
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                        <Lock size={12} /> Roles: super admin only
                      </span>
                    )}

                    {canBan ? (
                      <BanButton userId={u.id} name={displayName} />
                    ) : u.is_banned ? (
                      <UnbanButton userId={u.id} name={displayName} />
                    ) : !isMe && targetIsStaff ? (
                      <span
                        className="p-2 text-ink-soft"
                        title="Only super admins can ban staff accounts"
                      >
                        <Lock size={14} />
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-ink-soft">
              <ShieldAlert size={32} className="mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-foreground">No accounts match.</p>
              <p className="text-xs mt-1">Try a different search, or clear the filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          {page > 1 ? (
            <Link href={buildHref(page - 1)} className={btn("outline", "sm")}>
              ← Previous
            </Link>
          ) : <span />}
          <span className="text-ink-soft">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={buildHref(page + 1)} className={btn("outline", "sm")}>
              Next →
            </Link>
          ) : <span />}
        </div>
      )}
    </div>
  );
}
