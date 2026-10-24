"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const PAGE_SIZE = 20;

function timeAgo(iso) {
    const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

const notifyChanged = () => window.dispatchEvent(new Event("notifications:changed"));

export default function NotificationsPage() {
    const router = useRouter();
    const [userId, setUserId] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [emailOn, setEmailOn] = useState(true);

    const fetchPage = useCallback(async (uid, before) => {
        let q = supabase
            .from("notifications")
            .select("id, title, body, link, created_at, read_at")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(PAGE_SIZE + 1);
        if (before) q = q.lt("created_at", before);

        const { data, error } = await q;
        if (error) {
            toast.error("Couldn't load notifications.");
            return [];
        }
        setHasMore(data.length > PAGE_SIZE);
        return data.slice(0, PAGE_SIZE);
    }, []);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace("/login");
                return;
            }
            setUserId(user.id);
            const [first, prefs] = await Promise.all([
                fetchPage(user.id),
                supabase
                    .from("notification_prefs")
                    .select("email_enabled")
                    .eq("user_id", user.id)
                    .maybeSingle(),
            ]);
            setItems(first);
            if (prefs.data) setEmailOn(prefs.data.email_enabled);
            setLoading(false);
        })();
    }, [fetchPage, router]);

    const loadMore = async () => {
        const last = items[items.length - 1];
        if (!last) return;
        setItems((prev) => [...prev]);
        const more = await fetchPage(userId, last.created_at);
        setItems((prev) => [...prev, ...more]);
    };

    const openItem = async (item) => {
        if (!item.read_at) {
            const now = new Date().toISOString();
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read_at: now } : i)));
            await supabase.from("notifications").update({ read_at: now }).eq("id", item.id);
            notifyChanged();
        }
        if (item.link?.startsWith("/")) router.push(item.link);
    };

    const markAllRead = async () => {
        const now = new Date().toISOString();
        setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: now })));
        const { error } = await supabase
            .from("notifications")
            .update({ read_at: now })
            .eq("user_id", userId)
            .is("read_at", null);
        if (error) toast.error("Couldn't mark all as read.");
        notifyChanged();
    };

    const toggleEmail = async () => {
        const next = !emailOn;
        setEmailOn(next);
        const { error } = await supabase
            .from("notification_prefs")
            .upsert(
                { user_id: userId, email_enabled: next, updated_at: new Date().toISOString() },
                { onConflict: "user_id" }
            );
        if (error) {
            setEmailOn(!next);
            toast.error("Couldn't save your email preference.");
        }
    };

    const hasUnread = items.some((i) => !i.read_at);

    return (
        <div className="max-w-2xl w-full mx-auto px-4 py-6 text-foreground">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-black flex items-center gap-2">
                    <Bell size={22} /> Notifications
                </h1>
                {hasUnread && (
                    <button
                        onClick={markAllRead}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-border hover:bg-muted transition-colors cursor-pointer"
                    >
                        <CheckCheck size={14} /> Mark all as read
                    </button>
                )}
            </div>

            <label className="flex items-center gap-2 mb-4 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={emailOn}
                    onChange={toggleEmail}
                    className="accent-emerald-700"
                />
                Email me about important updates (suspensions, approvals, removed listings)
            </label>

            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="animate-spin text-muted-foreground" size={28} />
                </div>
            ) : items.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-16">
                    You&apos;re all caught up. Nothing here yet.
                </p>
            ) : (
                <ul className="space-y-2">
                    {items.map((item) => (
                        <li key={item.id}>
                            <button
                                onClick={() => openItem(item)}
                                className={`w-full text-left p-4 rounded-2xl border transition-colors cursor-pointer ${item.read_at
                                    ? "border-border bg-card/40 hover:bg-muted/60"
                                    : "border-emerald-600/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    {!item.read_at && (
                                        <span className="mt-1.5 w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold truncate">{item.title}</p>
                                        {item.body && (
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
                                        )}
                                        <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(item.created_at)}</p>
                                    </div>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {hasMore && !loading && (
                <button
                    onClick={loadMore}
                    className="mx-auto mt-4 block text-xs font-bold px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors cursor-pointer"
                >
                    Load more
                </button>
            )}
        </div>
    );
}