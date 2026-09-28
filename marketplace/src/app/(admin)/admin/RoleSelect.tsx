'use client';

import { useTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserRole } from './actions';
import { Loader2, Lock } from 'lucide-react';
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

  const getRoleTheme = (role: string) => {
    switch (role) {
      case 'super_admin':
        return {
          border: 'border-purple-500/60 hover:border-purple-400',
          bg: 'bg-purple-950/80 text-purple-200 focus:ring-purple-500',
          spinner: 'text-purple-400',
        };
      case 'admin':
        return {
          border: 'border-blue-500/60 hover:border-blue-400',
          bg: 'bg-blue-950/80 text-blue-200 focus:ring-blue-500',
          spinner: 'text-blue-400',
        };
      case 'moderator':
        return {
          border: 'border-emerald-500/60 hover:border-emerald-400',
          bg: 'bg-emerald-950/80 text-emerald-100 focus:ring-emerald-500',
          spinner: 'text-emerald-400',
        };
      default:
        return {
          border: 'border-neutral-700 hover:border-neutral-600',
          bg: 'bg-neutral-900 text-neutral-300 focus:ring-neutral-500',
          spinner: 'text-neutral-400',
        };
    }
  };

  const theme = getRoleTheme(selectedRole);

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
        className={`border rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 cursor-pointer pr-8 transition-all appearance-none ${theme.border} ${theme.bg}`}
      >
        <option value="user" className="bg-neutral-900 text-neutral-200 font-normal">
          User (Buyer & Seller)
        </option>
        <option value="moderator" className="bg-emerald-950 text-emerald-100 font-bold">
          Moderator
        </option>
        <option value="admin" className="bg-blue-950 text-blue-100 font-bold">
          Admin
        </option>

        {(isRequesterSuperAdmin || selectedRole === 'super_admin') && (
          <option value="super_admin" className="bg-purple-950 text-purple-100 font-bold">
            Super Admin
          </option>
        )}
      </select>

      {(isProtected || isModerator) && !isPending && (
        <span className="absolute right-2.5 pointer-events-none text-neutral-400" title={isModerator ? "Moderators cannot alter roles" : "Protected Account"}>
          <Lock size={12} />
        </span>
      )}

      {isPending && (
        <span className="absolute right-2.5 pointer-events-none">
          <Loader2 size={12} className={`animate-spin ${theme.spinner}`} />
        </span>
      )}
    </div>
  );
}