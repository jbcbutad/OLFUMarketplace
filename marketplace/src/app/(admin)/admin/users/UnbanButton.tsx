"use client";

import { useConfirm } from "@/components/ConfirmProvider";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { unbanUserAction } from "../reports/actions";
import { btn } from "../ui";

export default function UnbanButton({ userId, name }: { userId: string; name: string }) {
    const router = useRouter();
    const askConfirm = useConfirm();
    const [pending, startTransition] = useTransition();

    const handleUnban = async () => {
        const ok = await askConfirm({
            title: `Unban ${name}?`,
            message: "They will be able to sign in, post and message again.",
            confirmText: "Unban",
            tone: "safe",
        });
        if (!ok) return;
        startTransition(async () => {
            const res = await unbanUserAction(userId);
            if (res.error) toast.error(res.error);
            else {
                toast.success(`${name} was unbanned`);
                router.refresh();
            }
        });
    };

    return (
        <button onClick={handleUnban} disabled={pending} className={btn("safeOutline", "sm")} title={`Unban ${name}`}>
            <RotateCcw size={13} /> {pending ? "Unbanning..." : "Unban"}
        </button>
    );
}
