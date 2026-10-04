'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
    ScrollText,
    Loader2,
    RefreshCw,
    Download,
    ChevronDown,
    Search,
    ShieldAlert,
    ExternalLink,
} from 'lucide-react';
import { ui, btn } from '../ui';

const PAGE_SIZE = 50;

const GROUPS = [
    { value: 'all', label: 'All activity' },
    { value: 'user', label: 'Users (roles, bans)' },
    { value: 'listing', label: 'Listings' },
    { value: 'report', label: 'Reports' },
    { value: 'moderation', label: 'AI moderation' },
    { value: 'org', label: 'Organizations' },
    { value: 'system', label: 'System errors' },
];

const SEVERITY_STYLES = {
    info: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    error: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

export default function AuditLogsPage() {
    const [role, setRole] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [hasMore, setHasMore] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    const [live, setLive] = useState(true);
    const [liveStatus, setLiveStatus] = useState('connecting');

    const [severity, setSeverity] = useState('all');
    const [group, setGroup] = useState('all');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const isSuper = role === 'super_admin' || role === 'superadmin';

    const update = (setter, value) => {
        setter(value);
        setLimit(PAGE_SIZE);
    };

    // Who is viewing? (the database also blocks non-super-admins, this is just the UI gate)
    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setRole('none');
                return;
            }
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .maybeSingle();
            setRole(profile?.role || 'none');
        })();
    }, []);

    // Debounce the search box
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(search);
            setLimit(PAGE_SIZE);
        }, 350);
        return () => clearTimeout(t);
    }, [search]);

    const fetchLogs = useCallback(async () => {
        let q = supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .limit(limit + 1);

        if (severity !== 'all') q = q.eq('severity', severity);
        if (group !== 'all') q = q.like('action', `${group}.%`);
        if (from) q = q.gte('created_at', new Date(`${from}T00:00:00`).toISOString());
        if (to) q = q.lte('created_at', new Date(`${to}T23:59:59`).toISOString());

        const s = debouncedSearch.trim().replace(/[%*,()]/g, '');
        if (s) {
            q = q.or(
                `summary.ilike.%${s}%,actor_email.ilike.%${s}%,action.ilike.%${s}%,target_id.ilike.%${s}%`
            );
        }

        const { data, error: err } = await q;
        if (err) {
            setError(err.message);
            setLoading(false);
            return;
        }
        setError('');
        setHasMore((data || []).length > limit);
        setLogs((data || []).slice(0, limit));
        setLoading(false);
    }, [limit, severity, group, debouncedSearch, from, to]);

    useEffect(() => {
        if (isSuper) fetchLogs();
    }, [isSuper, fetchLogs]);

    // Live updates: refetch (debounced) whenever a new log row is inserted
    const fetchRef = useRef(fetchLogs);
    const timerRef = useRef(null);
    useEffect(() => {
        fetchRef.current = fetchLogs;
    }, [fetchLogs]);

    useEffect(() => {
        if (!isSuper || !live) {
            setLiveStatus('off');
            return;
        }
        const channel = supabase
            .channel('audit-logs-live')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'audit_logs' },
                () => {
                    clearTimeout(timerRef.current);
                    timerRef.current = setTimeout(() => fetchRef.current(), 400);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setLiveStatus('live');
                else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) setLiveStatus('error');
                else setLiveStatus('connecting');
            });

        return () => {
            clearTimeout(timerRef.current);
            supabase.removeChannel(channel);
        };
    }, [isSuper, live]);

    const exportCsv = () => {
        const esc = (v) => {
            let s = String(v ?? '');
            if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
            return `"${s.replace(/"/g, '""')}"`;
        };
        const header = ['time', 'severity', 'action', 'actor_email', 'actor_role', 'target_type', 'target_id', 'summary', 'details'];
        const rows = logs.map((l) =>
            [l.created_at, l.severity, l.action, l.actor_email, l.actor_role, l.target_type, l.target_id, l.summary, JSON.stringify(l.details)]
                .map(esc)
                .join(',')
        );
        const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (role === null) {
        return (
            <div className="min-h-[300px] flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-ink-soft" />
            </div>
        );
    }

    if (!isSuper) {
        return (
            <div className="max-w-xl mx-auto p-10 text-center space-y-2">
                <ShieldAlert size={40} className="mx-auto text-rose-500" />
                <h1 className="text-xl font-bold text-foreground">Superadmins only</h1>
                <p className="text-sm text-ink-soft">The audit trail is restricted to super admin accounts.</p>
            </div>
        );
    }

    const liveLabel = { live: 'Live', connecting: 'Connecting…', error: 'Live unavailable', off: 'Paused' }[liveStatus];
    const liveDot = { live: 'bg-emerald-500 animate-pulse', connecting: 'bg-amber-500', error: 'bg-rose-500', off: 'bg-neutral-400' }[liveStatus];

    const inputClass =
        `${ui.input} text-xs font-semibold`;

    return (
        <div className={ui.page}>
            {/* HEADER */}
            <div className={ui.headerBar}>
                <div>
                    <h1 className={ui.title}>
                        <ScrollText className={ui.titleIcon} size={28} /> Audit Trail
                    </h1>
                    <p className={ui.subtitle}>
                        Append-only record of admin actions, moderation events and system problems.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setLive((v) => !v)}
                        className={btn("outline", "sm")}
                        title="Toggle live updates"
                    >
                        <span className={`w-2 h-2 rounded-full ${liveDot}`} /> {liveLabel}
                    </button>
                    <button
                        type="button"
                        onClick={fetchLogs}
                        className={btn("outline", "sm")}
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button
                        type="button"
                        onClick={exportCsv}
                        disabled={logs.length === 0}
                        className={btn("primary", "sm")}
                    >
                        <Download size={14} /> Export CSV
                    </button>
                </div>
            </div>

            {/* FILTERS */}
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="relative md:col-span-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                    <input
                        type="text"
                        placeholder="Search summary, actor, action, target id…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={`${inputClass} w-full pl-9`}
                    />
                </div>

                <select value={group} onChange={(e) => update(setGroup, e.target.value)} className={inputClass}>
                    {GROUPS.map((g) => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                </select>

                <select value={severity} onChange={(e) => update(setSeverity, e.target.value)} className={inputClass}>
                    <option value="all">All severities</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                </select>

                <input type="date" value={from} onChange={(e) => update(setFrom, e.target.value)} className={inputClass} title="From date" />
                <input type="date" value={to} onChange={(e) => update(setTo, e.target.value)} className={inputClass} title="To date" />
            </div>

            {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-600 dark:text-rose-400">
                    Could not load logs: {error}
                </div>
            )}

            {/* LOG LIST */}
            {loading ? (
                <div className="border border-line rounded-2xl bg-surface p-16 text-center flex flex-col items-center justify-center min-h-[300px]">
                    <Loader2 size={32} className="animate-spin text-ink-soft mb-3" />
                    <p className="text-sm font-semibold text-ink-soft">Loading audit trail...</p>
                </div>
            ) : logs.length === 0 ? (
                <div className="border border-line rounded-2xl bg-surface p-16 text-center min-h-[250px] flex items-center justify-center">
                    <p className="text-sm font-semibold text-ink-soft">No log entries match these filters.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {logs.map((log) => {
                        const open = expandedId === log.id;
                        return (
                            <div key={log.id} className="bg-surface border border-line rounded-xl shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(open ? null : log.id)}
                                    className="w-full text-left p-4 flex flex-col md:flex-row md:items-center gap-3 cursor-pointer"
                                >
                                    <div className="md:w-44 shrink-0 text-xs text-ink-soft font-medium">
                                        {new Date(log.created_at).toLocaleString()}
                                    </div>
                                    <span
                                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border w-fit shrink-0 ${SEVERITY_STYLES[log.severity] || SEVERITY_STYLES.info}`}
                                    >
                                        {log.severity}
                                    </span>
                                    <code className="text-xs font-bold text-foreground md:w-56 shrink-0 truncate">{log.action}</code>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-foreground truncate">{log.summary || '—'}</p>
                                        <p className="text-[11px] text-ink-soft truncate">
                                            {log.actor_email || 'system'}
                                            {log.actor_role ? ` · ${log.actor_role}` : ''}
                                        </p>
                                    </div>
                                    <ChevronDown
                                        size={16}
                                        className={`shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {open && (
                                    <div className="px-4 pb-4 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-ink-soft">
                                            <p>Actor ID: <span className="font-mono text-foreground">{log.actor_id || '—'}</span></p>
                                            <p>Target: <span className="font-mono text-foreground">{log.target_type || '—'} {log.target_id || ''}</span></p>
                                        </div>
                                        <pre className="text-[11px] leading-relaxed bg-tint border border-line rounded-xl p-3 overflow-x-auto text-foreground">
                                            {JSON.stringify(log.details, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {hasMore && (
                        <button
                            type="button"
                            onClick={() => setLimit((l) => l + PAGE_SIZE)}
                            className={`${btn("outline", "sm")} w-full py-3`}
                        >
                            Load more
                        </button>
                    )}
                </div>
            )}

            {/* INFRASTRUCTURE LOGS */}
            <div className="text-xs text-ink-soft flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
                <span>Need raw infrastructure logs?</span>
                <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-brand hover:underline">
                    Supabase dashboard → Logs <ExternalLink size={11} />
                </a>
                <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-brand hover:underline">
                    Vercel dashboard → Logs <ExternalLink size={11} />
                </a>
            </div>
        </div>
    );
}