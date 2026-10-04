'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ui, btn } from './ui';
import { UserCheck, LogOut, Store, Loader2 } from 'lucide-react';

const ROLE_LABELS = {
    super_admin: 'Super Admin',
    superadmin: 'Super Admin',
    admin: 'Admin',
    moderator: 'Moderator',
};

export default function AdminUserCard() {
    const router = useRouter();
    const [me, setMe] = useState(null);
    const [signingOut, setSigningOut] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, full_name, avatar_url, "First_Name", "Last_Name"')
                .eq('id', user.id)
                .maybeSingle();

            const derived = `${profile?.First_Name || ''} ${profile?.Last_Name || ''}`.trim();
            if (active) {
                setMe({
                    name: profile?.full_name || (derived.length > 0 ? derived : null) || user.email || 'User',
                    avatar: profile?.avatar_url || null,
                    role: ROLE_LABELS[profile?.role] || 'Staff',
                });
            }
        })();
        return () => { active = false; };
    }, []);

    const handleLogout = async () => {
        setSigningOut(true);
        await supabase.auth.signOut();
        router.replace('/');
        router.refresh();
    };

    if (!me) return null;

    return (
        <div className={`${ui.card} flex flex-wrap items-center gap-3 px-4 py-2.5`}>
            <div className="w-8 h-8 rounded-full bg-tint border border-line flex items-center justify-center font-bold text-xs text-foreground shrink-0 overflow-hidden">
                {me.avatar ? (
                    <img src={me.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    me.name.charAt(0).toUpperCase()
                )}
            </div>

            <div className="text-left overflow-hidden mr-auto">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1">
                    <UserCheck size={12} className="text-brand" /> {me.role} Active
                </p>
                <p className="text-xs font-bold text-foreground truncate max-w-[160px]">{me.name}</p>
            </div>

            <Link href="/marketplace" className={btn('outline', 'sm')}>
                <Store size={14} /> Marketplace
            </Link>
            <button onClick={handleLogout} disabled={signingOut} className={btn('dangerOutline', 'sm')}>
                {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Log out
            </button>
        </div>
    );
}