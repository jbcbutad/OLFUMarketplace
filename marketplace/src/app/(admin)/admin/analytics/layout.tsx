import { requireRole } from "@/lib/auth/requireRole";

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    await requireRole(["admin", "super_admin", "superadmin"]);
    return <>{children}</>;
}