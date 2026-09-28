import { createClient } from "@/lib/supabase/server";
import RoleSelect from "../RoleSelect";
import { Users, ShieldAlert, UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const supabase = await createClient();

  // Fetch current session / logged-in user
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;

  // Fetch all user profiles sorted by email, including avatar_url
  const { data: users, error } = await supabase
    .from("profiles")
    .select('id, full_name, email, role, avatar_url, "First_Name", "Last_Name"')
    .order("email", { ascending: true });

  if (error) {
    console.error("Error fetching users list:", error);
  }

  const resolveDisplayName = (u: any) => {
    const derived = `${u.First_Name || ""} ${u.Last_Name || ""}`.trim();
    return u.full_name || (derived.length > 0 ? derived : null) || u.email || "Unnamed Account";
  };

  // Sort users so the logged-in user appears first if they exist in the list
  const sortedUsers = users ? [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return 0;
  }) : [];

  const loggedInProfile = sortedUsers.find((u: any) => u.id === currentUserId);
  const loggedInDisplayName = loggedInProfile ? resolveDisplayName(loggedInProfile) : session?.user?.email || "Unknown User";
  const loggedInAvatarUrl = loggedInProfile?.avatar_url;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* HEADER & LOGGED-IN BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Users className="text-purple-400" size={28} /> User Directory
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage system permissions, roles, and administrative access across all accounts.
          </p>
        </div>

        {session?.user && (
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
        )}
      </div>

      <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-4 px-6 py-3.5 bg-muted/50 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-4">User</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-2">Current Role</div>
          <div className="col-span-2 text-right">Change Permission</div>
        </div>

        <div className="divide-y divide-border">
          {sortedUsers && sortedUsers.length > 0 ? (
            sortedUsers.map((u: any) => {
              const displayName = resolveDisplayName(u);
              const isMe = u.id === currentUserId;

              return (
                <div
                  key={u.id}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 items-center text-sm transition-colors ${
                    isMe ? "bg-accent/40 hover:bg-accent/60 font-medium" : "hover:bg-muted/30"
                  }`}
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
                      </span>
                    </div>
                  </div>

                  <div className="col-span-4 text-muted-foreground text-xs truncate">
                    {u.email || "No Email Provided"}
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                        u.role === "super_admin" || u.role === "superadmin"
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

                  <div className="col-span-2 flex justify-end">
                    <RoleSelect userId={u.id} currentRole={u.role || "user"} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <ShieldAlert size={32} className="mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-semibold">No profile records returned.</p>
              <p className="text-xs text-muted-foreground mt-1">
                If profiles exist in Supabase, verify RLS policies permit SELECT access on public.profiles.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}