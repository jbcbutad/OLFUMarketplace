'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamically import the dashboard with Server-Side Rendering (SSR) completely disabled
const AnalyticsContent = dynamic(
    () => import('./AnalyticsContent'),
    {
        ssr: false,
        loading: () => (
            <div className="border border-border rounded-2xl bg-card p-16 text-center flex flex-col items-center justify-center min-h-[300px] shadow-sm">
                <Loader2 size={32} className="animate-spin text-muted-foreground mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">Loading Analytics Dashboard...</p>
            </div>
        )
    }
);

export default function Page() {
    return <AnalyticsContent />;
}