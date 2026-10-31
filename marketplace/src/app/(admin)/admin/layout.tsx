'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AdminFooter from '@/components/AdminFooter';
import AdminUserCard from './AdminUserCard';
import AdminNotificationBell from '@/components/AdminNotificationBell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden relative">
        {/* On phones this only reserves the slim 56px rail (w-14); the open sidebar
            floats over the page. From md up it reserves the full open/collapsed width. */}
        <div className={`transition-all duration-300 shrink-0 ${isSidebarOpen ? 'w-14 md:w-64' : 'w-14 md:w-16'}`}>
          <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        </div>

        <main className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto relative">
          <div className="flex justify-end items-center gap-3 mb-4">
            <AdminNotificationBell />
            <AdminUserCard />
          </div>
          {children}
        </main>
      </div>

      <AdminFooter />
    </div>
  );
}