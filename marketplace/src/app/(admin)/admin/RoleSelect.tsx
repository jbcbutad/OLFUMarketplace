'use client';

import { useTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserRole } from './actions';
import { Loader2, Lock, ChevronDown, UserCog, X } from 'lucide-react';
import { toast } from 'sonner';
import { btn } from './ui'; // if the build can't find it, use '../ui'

interface RoleSelectProps {
  userId: string;
  currentRole: string;
  viewerRole: string;
  viewerId: string;
  name?: string; // optional: pass name={displayName} from page.tsx to show it in the popup
}

const LABELS: Record<string, string> = {
  user: 'User',
  moderator: 'Moderator',
  admin: 'Admin',
  super_admin: 'Super Admin',
};
const labelOf = (r: string) => LABELS[r] ?? r;

export default function RoleSelect({ userId, currentRole, viewerRole, viewerId, name }: RoleSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentUserRole, setCurrentUserRole] = useState<string>(viewerRole);
  const [nextRole, setNextRole] = useState<string | null>(null); // role waiting for confirmation
  const [error, setError] = useState<string | null>(null);

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
    setCurrentUserRole(viewerRole);
  }, [viewerRole]);

  useEffect(() => {
    const handleRoleUpdate = (event: any) => {
      if (event.detail?.userId === viewerId) {
        setCurrentUserRole(event.detail.newRole);
      }
    };
    window.addEventListener('user-role-changed', handleRoleUpdate);
    return () => window.removeEventListener('user-role-changed', handleRoleUpdate);
  }, [viewerId]);

  const isRequesterSuperAdmin = currentUserRole === 'super_admin' || currentUserRole === 'superadmin';
  const isTargetSuperAdmin = selectedRole === 'super_admin';
  const isModerator = currentUserRole === 'moderator';

  const isProtected = isTargetSuperAdmin && !isRequesterSuperAdmin;
  const isDisabled = isPending || isModerator || isProtected;

  const close = () => {
    if (isPending) return;
    setNextRole(null);
    setError(null);
  };

  useEffect(() => {
    if (!nextRole) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nextRole, isPending]);

  // The dropdown stays on the old role until the popup is confirmed
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isModerator) return;
    const value = e.target.value;
    if (value !== selectedRole) setNextRole(value);
  };

  const submit = () => {
    if (!nextRole) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateUserRole(userId, nextRole);
        setSelectedRole(nextRole);
        toast.success('Role updated successfully', {
          description: `${name || 'User'} is now ${labelOf(nextRole)}.`,
        });

        // Broadcast change globally to update requester status and UI themes instantly
        window.dispatchEvent(new CustomEvent('user-role-changed', { detail: { userId, newRole: nextRole } }));
        setNextRole(null);
        router.refresh();
      } catch (err: any) {
        setError(err?.message || 'Failed to update user role.');
      }
    });
  };

  const isSuper = nextRole === 'super_admin';
  const who = name || 'this user';

  return (
    <>
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
          title={isModerator ? 'Moderators cannot alter roles' : isProtected ? 'Protected Account' : undefined}
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

      {nextRole && (
        <div
          className="fixed inset-0 bg-black/60 z-[9999] backdrop-blur-sm flex items-center justify-center p-4 text-left"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-surface text-foreground border border-line rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-tint text-brand-deep border border-line shrink-0">
                <UserCog size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold leading-tight">Change role?</h3>
                <p className="text-sm text-ink-soft mt-1">
                  Change {who} from <strong className="text-foreground">{labelOf(selectedRole)}</strong> to{' '}
                  <strong className="text-foreground">{labelOf(nextRole)}</strong>?
                </p>
                {isSuper && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Super admins have full access, including changing other people&apos;s roles.
                  </p>
                )}
              </div>
              <button onClick={close} className={btn('ghost', 'sm')} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {error && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={close} disabled={isPending} className={btn('outline')}>
                Cancel
              </button>
              <button onClick={submit} disabled={isPending} className={btn(isSuper ? 'danger' : 'primary')}>
                {isPending ? 'Saving...' : 'Confirm change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}