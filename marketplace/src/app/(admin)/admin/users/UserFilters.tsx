"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";
import { ui } from "../ui";

type Props = {
    q: string;
    role: string;
    status: string;
    sort: string;
    type: string;
    hasFilters: boolean;
};

export default function UserFilters({ q, role, status, sort, type, hasFilters }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [text, setText] = useState(q);
    const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // keep the box in sync when filters are cleared or changed from elsewhere
    useEffect(() => {
        if (q === "") setText("");
    }, [q]);
    useEffect(() => () => clearTimeout(debounce.current), []);

    const inputCls = `${ui.input} text-xs font-semibold`;

    const push = (next: { q?: string; role?: string; status?: string; sort?: string }) => {
        const v = { q, role, status, sort, ...next };
        const params = new URLSearchParams();
        if (v.q) params.set("q", v.q);
        if (v.sort !== "name_asc") params.set("sort", v.sort);
        if (v.role !== "all") params.set("role", v.role);
        if (v.status !== "all") params.set("status", v.status);
        if (type !== "all") params.set("type", type);
        const s = params.toString();
        startTransition(() => {
            router.replace(s ? `/admin/users?${s}` : "/admin/users", { scroll: false });
        });
    };

    const onSearchChange = (value: string) => {
        setText(value);
        clearTimeout(debounce.current);
        debounce.current = setTimeout(() => push({ q: value.trim() }), 350);
    };

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                clearTimeout(debounce.current);
                push({ q: text.trim() });
            }}
            className="flex flex-wrap items-center gap-2 lg:ml-auto"
        >
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                    value={text}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search name or email"
                    className={`${inputCls} pl-8 w-60`}
                />
            </div>
            <select value={role} onChange={(e) => push({ role: e.target.value })} className={inputCls}>
                <option value="all">All roles</option>
                <option value="super_admin">Super admin</option>
                <option value="admin">Admin</option>
                <option value="moderator">Moderator</option>
                <option value="user">User</option>
            </select>
            <select value={status} onChange={(e) => push({ status: e.target.value })} className={inputCls}>
                <option value="all">All accounts</option>
                <option value="banned">Banned only</option>
            </select>
            <select value={sort} onChange={(e) => push({ sort: e.target.value })} className={inputCls}>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
            </select>
            {isPending && <Loader2 size={14} className="animate-spin text-ink-soft" />}
            {hasFilters && (
                <Link href="/admin/users" className="text-xs font-semibold text-ink-soft hover:text-brand-deep hover:underline">
                    Clear
                </Link>
            )}
        </form>
    );
}