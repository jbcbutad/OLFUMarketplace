'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AdminFooter from '@/components/AdminFooter';
import AdminUserCard from './AdminUserCard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden relative">
        <div className={`transition-all duration-300 shrink-0 ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
          <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        </div>

        <main className="flex-1 p-6 overflow-y-auto relative">
          <div className="flex justify-end mb-4">
            <AdminUserCard />
          </div>
          {children}
        </main>
      </div>

      <AdminFooter />
    </div>
  );
}