"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import RelistButton from "@/components/RelistButton";

export default function OwnerBanner({ sellerId, productId, status, updatedAt }) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    async function checkOwnership() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id === sellerId) {
        setIsOwner(true);
      }
    }
    checkOwnership();
  }, [sellerId]);

  if (!isOwner) return null;

  const daysOld = updatedAt
    ? Math.floor((new Date() - new Date(updatedAt)) / (1000 * 60 * 60 * 24))
    : 0;

  const isAlmostExpired = status === "active" && daysOld >= 80;

  if (isAlmostExpired) {
    return (
      <div className="p-4 mb-6 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-2xl text-xs font-semibold flex items-center justify-between gap-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-2">
          <span className="uppercase text-[10px] font-bold px-2.5 py-1 bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-500/30 shrink-0">
            Expiring Soon
          </span>
          <span>
            This listing will expire in {Math.max(1, 90 - daysOld)} day{90 - daysOld === 1 ? "" : "s"} due to inactivity.
          </span>
        </div>
        <RelistButton productId={productId} />
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="p-4 mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-2xl text-xs font-semibold flex items-center justify-between gap-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-2">
          <span className="uppercase text-[10px] font-bold px-2.5 py-1 bg-rose-500/20 text-rose-800 dark:text-rose-300 rounded-md border border-rose-500/30 shrink-0">
            Expired
          </span>
          <span>This listing expired due to 90 days of inactivity.</span>
        </div>
        <RelistButton productId={productId} />
      </div>
    );
  }

  return null;
}