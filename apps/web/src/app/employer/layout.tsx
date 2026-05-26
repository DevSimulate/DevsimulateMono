import Sidebar from "@/components/employer/Sidebar";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div style={{ marginLeft: "240px", flex: 1, minHeight: "100vh" }}>
        {children}
      </div>
    </div>
  );
}
