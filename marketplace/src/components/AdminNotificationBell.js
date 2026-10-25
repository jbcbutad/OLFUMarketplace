"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import { useUnreadNotifications } from "@/lib/useNotifications";

export default function AdminNotificationBell() {
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    }, []);

    const count = useUnreadNotifications(userId);
    return userId ? <NotificationBell count={count} /> : null;
}