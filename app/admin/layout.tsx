import AuthGuard from "@/src/components/AuthGuard";
import AdminSidebar from "@/src/components/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <div className="min-h-screen bg-[#F5F5F5]">
        <AdminSidebar />
        {/* Desktop: offset by sidebar width. Mobile: full width (sidebar is overlay) */}
        <div className="lg:pl-60">
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
