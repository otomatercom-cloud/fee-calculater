"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { modeLabel, money, pct } from "@/lib/format";
import type { ChartRow } from "@/lib/types";

export default function FeeChart() {
  const [rows, setRows] = useState<ChartRow[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"all" | "offline" | "online">("all");

  useEffect(() => {
    api<{ rows: ChartRow[] }>("/api/fee/chart").then((d) => setRows(d.rows)).catch((e: Error) => setError(e.message));
  }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter(
      (r) => (mode === "all" || r.mode === mode) && (!t || `${r.course} ${r.course_type}`.toLowerCase().includes(t))
    );
  }, [rows, q, mode]);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Fee Chart</h1><p className="muted">All fee structures before scholarship / discount.</p></div>
        <div className="filters">
          <input className="search" placeholder="Search course or type" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="seg small">
            {(["all", "offline", "online"] as const).map((m) => (
              <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{m === "all" ? "All" : modeLabel(m)}</button>
            ))}
          </div>
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
      <div className="card table-card">
        <table>
          <thead>
            <tr><th>Course</th><th>Type</th><th>Mode</th><th className="num">Admission</th><th className="num">Material</th><th className="num">Amount</th><th className="num">GST</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {!rows && !error && <tr><td colSpan={8} className="empty">Loading…</td></tr>}
            {rows && !shown.length && <tr><td colSpan={8} className="empty">No fee structures found.</td></tr>}
            {shown.map((r) => (
              <tr key={r.id}>
                <td><b>{r.course}</b></td><td>{r.course_type}</td>
                <td><span className={`chip ${r.mode}`}>{modeLabel(r.mode)}</span></td>
                <td className="num">{money(r.admission)}</td><td className="num">{money(r.material)}</td><td className="num">{money(r.course_fee)}</td>
                <td className="num">{money(r.gst_amount)} <small className="muted">({pct(r.gst_percent)})</small></td>
                <td className="num strong">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
