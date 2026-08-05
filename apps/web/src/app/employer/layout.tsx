import Sidebar from "@/components/employer/Sidebar";
import EmployerAuthGuard from "@/components/employer/EmployerAuthGuard";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <EmployerAuthGuard>
      <div className="portal" style={{ minHeight: "100vh", display: "flex" }}>
        <Sidebar />
        {/* Width comes from the sidebar via --emp-sidebar-w so the two can never
            disagree; 240px is the pre-hydration default. */}
        <div style={{ marginLeft: "var(--emp-sidebar-w, 240px)", flex: 1, minHeight: "100vh", transition: "margin-left .18s ease" }}>
          {children}
        </div>
      </div>
    </EmployerAuthGuard>
  );
}
