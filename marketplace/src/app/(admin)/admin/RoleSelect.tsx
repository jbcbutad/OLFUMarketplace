'use client';

import { useTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserRole } from './actions';
import { Loader2, Lock, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

interface RoleSelectProps {
  userId: string;
  currentRole: string;
}

export default function RoleSelect({ userId, currentRole }: RoleSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentUserRole, setCurrentUserRole] = useState<string>("user");

  const normalizeRole = (role: string) => {
    if (!role) return 'user';
    const r = role.toLowerCase().trim();
    if (r === 'superadmin' || r === 'super_admin') return 'super_admin';
    if (r === 'admin') return 'admin';
    if (r === 'moderator') return 'moderator';
    return 'user';
  };

  const [selectedRole, setSelectedRole] = useState<string>(() => normalizeRole(currentRole));

  useEffect(() => {
    setSelectedRole(normalizeRole(currentRole));
  }, [currentRole]);

  useEffect(() => {
    let activeSessionUserId: string | null = null;

    async function fetchCurrentRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        activeSessionUserId = session.user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) setCurrentUserRole(profile.role);
      }
    }

    fetchCurrentRole();

    // Dynamically update requester permission state across all rows when self-role changes
    const handleRoleUpdate = (event: any) => {
      if (activeSessionUserId && event.detail.userId === activeSessionUserId) {
        setCurrentUserRole(event.detail.newRole);
      }
    };

    window.addEventListener("user-role-changed", handleRoleUpdate);
    return () => window.removeEventListener("user-role-changed", handleRoleUpdate);
  }, []);

  const isRequesterSuperAdmin = currentUserRole === "super_admin" || currentUserRole === "superadmin";
  const isTargetSuperAdmin = selectedRole === "super_admin";
  const isModerator = currentUserRole === "moderator";

  const isProtected = isTargetSuperAdmin && !isRequesterSuperAdmin;
  const isDisabled = isPending || isModerator || isProtected;

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isModerator) return;

    const newRole = e.target.value;
    setSelectedRole(newRole);

    startTransition(async () => {
      try {
        await updateUserRole(userId, newRole);
        toast.success("Role updated successfully", {
          description: `User role changed to ${newRole.replace('_', ' ')}.`,
        });

        // Broadcast change globally to update requester status and UI themes instantly
        window.dispatchEvent(new CustomEvent("user-role-changed", { detail: { userId, newRole } }));
        router.refresh();
      } catch (err: any) {
        setSelectedRole(normalizeRole(currentRole));
        toast.error("Permission Denied", {
          description: err.message || "Failed to update user role.",
        });
      }
    });
  };

  return (
    <div className="relative inline-flex items-center">
      <select
        value={selectedRole}
        onChange={handleRoleChange}
        disabled={isDisabled}
        aria-label="Change role"
        className="w-36 bg-background text-foreground border border-line rounded-xl pl-3 pr-8 py-1.5 text-xs font-bold appearance-none cursor-pointer transition hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="user" className="bg-surface text-foreground">User</option>
        <option value="moderator" className="bg-surface text-foreground">Moderator</option>
        <option value="admin" className="bg-surface text-foreground">Admin</option>

        {(isRequesterSuperAdmin || selectedRole === 'super_admin') && (
          <option value="super_admin" className="bg-surface text-foreground">Super Admin</option>
        )}
      </select>

      <span
        className="absolute right-2.5 pointer-events-none text-ink-soft"
        title={isModerator ? "Moderators cannot alter roles" : isProtected ? "Protected Account" : undefined}
      >
        {isPending ? (
          <Loader2 size={12} className="animate-spin text-brand" />
        ) : isProtected || isModerator ? (
          <Lock size={12} />
        ) : (
          <ChevronDown size={14} />
        )}
      </span>
    </div>
  );
}
