import Sidebar from "@/components/employer/Sidebar";
import EmployerAuthGuard from "@/components/employer/EmployerAuthGuard";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <EmployerAuthGuard>
      <div className="portal" style={{ minHeight: "100vh", display: "flex" }}>
        <Sidebar />
        <div style={{ marginLeft: "240px", flex: 1, minHeight: "100vh" }}>
          {children}
        </div>
      </div>
    </EmployerAuthGuard>
  );
}
