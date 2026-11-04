"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const NAV = [
  { href: "/", label: "Calculator", icon: "🧮" },
  { href: "/fee-chart", label: "Fee Chart", icon: "📋" },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [name, setName] = useState("");

  useEffect(() => {
    api<{ name: string }>("/api/fee/me").then((d) => setName(d.name)).catch(() => undefined);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <aside className="sidebar">
        <div className="side-brand"><span className="brand-mark sm">₹</span><b>Fee Calculator</b></div>
        <nav>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`nav-item ${path === n.href ? "active" : ""}`}>
              <span>{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <div className="avatar">{(name || "U").charAt(0).toUpperCase()}</div>
          <div className="who"><b>{name || "…"}</b><button className="link" onClick={logout}>Sign out</button></div>
        </div>
      </aside>
      <header className="topbar">
        <div className="side-brand"><span className="brand-mark sm">₹</span><b>Fee Calculator</b></div>
        <button className="link light" onClick={logout}>Sign out</button>
      </header>
      <nav className="bottom-nav">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`bn-item ${path === n.href ? "active" : ""}`}>
            <span>{n.icon}</span>{n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
