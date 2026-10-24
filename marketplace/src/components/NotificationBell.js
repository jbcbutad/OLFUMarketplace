"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

export default function NotificationBell({ count = 0 }) {
    return (
        <Link
            href="/notifications"
            className="hidden sm:inline-flex p-2.5 rounded-full bg-white dark:bg-neutral-900 border border-black dark:border-white hover:bg-neutral-200 dark:hover:bg-neutral-800 text-foreground transition-all relative cursor-pointer"
            title="Notifications"
            aria-label={count ? `${count} unread notifications` : "Notifications"}
        >
            <Bell size={20} className="text-foreground" />
            {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                    {count > 9 ? "9+" : count}
                </span>
            )}
        </Link>
    );
}