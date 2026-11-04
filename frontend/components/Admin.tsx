"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { modeLabel, money, pct } from "@/lib/format";
import type { AdminData } from "@/lib/types";

type Tab = "structure" | "scholarship" | "course" | "type";
type Val = string | number | boolean | number[];
type Row = Record<string, Val> & { id: number; active: boolean };
interface Opt { value: string; label: string }
interface FieldDef {
  key: string; label: string; type: "text" | "number" | "select" | "multi" | "textarea";
  options?: (d: AdminData) => Opt[]; hint?: string;
}

const MODE_OPTS: Opt[] = [{ value: "offline", label: "Offline" }, { value: "online", label: "Online" }];

const TABS: { key: Tab; label: string; add: string }[] = [
  { key: "structure", label: "Fee Structures", add: "Add Fee Structure" },
  { key: "scholarship", label: "Scholarships & Discounts", add: "Add Scholarship / Discount" },
  { key: "course", label: "Courses", add: "Add Course" },
  { key: "type", label: "Course Types", add: "Add Course Type" },
];

const FIELDS: Record<Tab, FieldDef[]> = {
  structure: [
    { key: "course_id", label: "Course Name", type: "select", options: (d) => d.courses.filter((c) => c.active).map((c) => ({ value: String(c.id), label: c.name })) },
    { key: "course_type_id", label: "Course Type", type: "select", options: (d) => d.types.filter((c) => c.active).map((c) => ({ value: String(c.id), label: c.name })) },
    { key: "mode", label: "Mode", type: "select", options: () => MODE_OPTS },
    { key: "admission_fee", label: "Admission Fee (₹)", type: "number" },
    { key: "material_fee", label: "Material Fee (₹)", type: "number" },
    { key: "course_fee", label: "Amount / Course Fee (₹)", type: "number" },
    { key: "gst_percent", label: "GST (%)", type: "number" },
    { key: "onetime_discount_percent", label: "One-time Payment Discount (%)", type: "number", hint: "Extra % off the course fee when paid in one go." },
  ],
  scholarship: [
    { key: "name", label: "Name", type: "text" },
    { key: "kind", label: "Category", type: "select", options: () => [{ value: "scholarship", label: "Scholarship" }, { value: "discount", label: "Discount" }] },
    { key: "percentage", label: "Percentage (%)", type: "number" },
    { key: "apply_on", label: "Applies On", type: "select", options: () => [{ value: "course_fee", label: "Course fee (Amount) only" }, { value: "subtotal", label: "Admission + Material + Course fee" }] },
    { key: "course_ids", label: "Limit to courses", type: "multi", options: (d) => d.courses.filter((c) => c.active).map((c) => ({ value: String(c.id), label: c.name })), hint: "Leave all unticked for every course." },
    { key: "note", label: "Terms (optional)", type: "textarea" },
  ],
  course: [{ key: "name", label: "Course Name", type: "text" }],
  type: [{ key: "name", label: "Course Type", type: "text" }],
};

const DEFAULTS: Record<Tab, Record<string, Val>> = {
  structure: { course_id: "", course_type_id: "", mode: "offline", admission_fee: 0, material_fee: 0, course_fee: 0, gst_percent: 18, onetime_discount_percent: 0 },
  scholarship: { name: "", kind: "scholarship", percentage: 0, apply_on: "course_fee", course_ids: [], note: "" },
  course: { name: "" },
  type: { name: "" },
};

export default function Admin() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<Tab>("structure");
  const [editing, setEditing] = useState<{ id: number; form: Record<string, Val> } | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<AdminData>("/api/fee/admin_list"));
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "forbidden") setForbidden(true);
      else setError(err.message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const rows: Row[] = !data ? [] : (
    tab === "structure" ? data.structures : tab === "scholarship" ? data.scholarships : tab === "course" ? data.courses : data.types
  ) as unknown as Row[];
  const shown = rows.filter((r) => showArchived || r.active);

  function openNew() {
    setFormError("");
    setEditing({ id: 0, form: { ...DEFAULTS[tab] } });
  }
  function openEdit(r: Row) {
    setFormError("");
    const form: Record<string, Val> = {};
    FIELDS[tab].forEach((f) => { const v = r[f.key]; form[f.key] = f.type === "select" ? String(v ?? "") : (v ?? (f.type === "multi" ? [] : "")); });
    setEditing({ id: r.id, form });
  }

  async function save(model: Tab, id: number, values: Record<string, Val>) {
    setBusy(true); setFormError("");
    try {
      await api("/api/fee/admin_save", { model, id: id || null, values });
      setEditing(null);
      await load();
      return true;
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(r: Row) {
    const ok = await save(tab, r.id, { active: !r.active });
    if (!ok) setError("Could not change status.");
  }

  if (forbidden) {
    return <div className="page"><div className="alert">Only the Fee Calculator admin can manage fees. Admission officers can view and calculate only.</div></div>;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Manage Fees</h1><p className="muted">Admin only. Admission officers can only view and calculate.</p></div>
        <button className="btn primary" onClick={openNew} disabled={!data}>+ {TABS.find((t) => t.key === tab)?.add}</button>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="tabs">
        {TABS.map((t) => <button key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>{t.label}</button>)}
        <label className="check inline"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
      </div>

      <div className="card table-card">
        <table>
          <thead>{head(tab)}</thead>
          <tbody>
            {!data && !error && <tr><td colSpan={9} className="empty">Loading…</td></tr>}
            {data && !shown.length && <tr><td colSpan={9} className="empty">Nothing here yet. Tap the Add button.</td></tr>}
            {shown.map((r) => (
              <tr key={r.id} className={r.active ? "" : "archived"}>
                {cells(tab, r, data)}
                <td className="num">
                  <button className="link-btn" onClick={() => openEdit(r)}>Edit</button>
                  <button className="link-btn danger" onClick={() => toggleArchive(r)}>{r.active ? "Archive" : "Restore"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && data && (
        <div className="modal-back" onClick={() => !busy && setEditing(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void save(tab, editing.id, editing.form); }}>
            <h2>{editing.id ? "Edit" : "Add"} {TABS.find((t) => t.key === tab)?.label.replace(/s$/, "")}</h2>
            {FIELDS[tab].map((f) => {
              const v = editing.form[f.key];
              const set = (nv: Val) => setEditing({ ...editing, form: { ...editing.form, [f.key]: nv } });
              const opts = f.options ? f.options(data) : [];
              return (
                <div className="field" key={f.key}>
                  <span className="lbl">{f.label}</span>
                  {f.type === "text" && <input value={String(v ?? "")} onChange={(e) => set(e.target.value)} />}
                  {f.type === "number" && <input type="number" inputMode="decimal" min="0" step="any" value={String(v ?? "")} onChange={(e) => set(e.target.value)} />}
                  {f.type === "textarea" && <textarea value={String(v ?? "")} onChange={(e) => set(e.target.value)} rows={3} />}
                  {f.type === "select" && (
                    <select value={String(v ?? "")} onChange={(e) => set(e.target.value)}>
                      <option value="">Select…</option>
                      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                  {f.type === "multi" && (
                    <div className="multi">
                      {opts.map((o) => {
                        const list = (v as number[]) || [];
                        const on = list.includes(Number(o.value));
                        return (
                          <label key={o.value} className="check">
                            <input type="checkbox" checked={on} onChange={() => set(on ? list.filter((x) => x !== Number(o.value)) : [...list, Number(o.value)])} /> {o.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {f.hint && <small className="muted">{f.hint}</small>}
                </div>
              );
            })}
            {formError && <div className="alert">{formError}</div>}
            <div className="row-btns">
              <button className="btn primary grow" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function head(tab: Tab) {
  if (tab === "structure") return <tr><th>Course</th><th>Type</th><th>Mode</th><th className="num">Admission</th><th className="num">Material</th><th className="num">Amount</th><th className="num">GST</th><th className="num">One-time</th><th className="num">Actions</th></tr>;
  if (tab === "scholarship") return <tr><th>Name</th><th>Category</th><th className="num">Percentage</th><th>Applies on</th><th>Courses</th><th className="num">Actions</th></tr>;
  return <tr><th>Name</th><th className="num">Actions</th></tr>;
}

function cells(tab: Tab, r: Row, d: AdminData | null) {
  const x = r as unknown as Record<string, never>;
  if (tab === "structure")
    return (<>
      <td><b>{String(x.course)}</b></td><td>{String(x.course_type)}</td>
      <td><span className={`chip ${x.mode}`}>{modeLabel(String(x.mode))}</span></td>
      <td className="num">{money(Number(x.admission_fee))}</td><td className="num">{money(Number(x.material_fee))}</td><td className="num">{money(Number(x.course_fee))}</td>
      <td className="num">{pct(Number(x.gst_percent))}</td><td className="num">{pct(Number(x.onetime_discount_percent))}</td>
    </>);
  if (tab === "scholarship") {
    const names = (x.course_ids as number[]).map((id) => d?.courses.find((c) => c.id === id)?.name).filter(Boolean).join(", ");
    return (<>
      <td><b>{String(x.name)}</b></td><td className="cap">{String(x.kind)}</td><td className="num">{pct(Number(x.percentage))}</td>
      <td>{x.apply_on === ("course_fee" as never) ? "Course fee" : "Total fee"}</td><td>{names || "All courses"}</td>
    </>);
  }
  return <td><b>{String(x.name)}</b></td>;
}
