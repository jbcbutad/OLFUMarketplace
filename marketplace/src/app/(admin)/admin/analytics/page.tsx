'use client';

export const dynamic = 'force-dynamic';

import dynamicImport from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

const AnalyticsContent = dynamicImport(
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
    return (
        <Suspense fallback={
            <div className="border border-border rounded-2xl bg-card p-16 text-center flex flex-col items-center justify-center min-h-[300px] shadow-sm">
                <Loader2 size={32} className="animate-spin text-muted-foreground mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">Loading Analytics Dashboard...</p>
            </div>
        }>
            <AnalyticsContent />
        </Suspense>
    );
}