import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import AdminFooter from "@/components/AdminFooter";

export default function MainLayout({ children }) {
  return (
    <div className="marketplace-surface flex flex-col h-screen w-full overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto text-foreground flex flex-col justify-between">
          <div className="flex-1">{children}</div>
          <AdminFooter />
        </main>
      </div>
    </div>
  );
}