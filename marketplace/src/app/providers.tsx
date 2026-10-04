'use client';

import { ThemeProvider } from 'next-themes';
import { ConfirmProvider } from '@/components/ConfirmProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ThemeProvider>
  );
}