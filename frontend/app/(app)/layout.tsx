import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="content">{children}</main>
    </div>
  );
}
