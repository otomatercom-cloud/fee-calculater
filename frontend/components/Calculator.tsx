"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { modeLabel, money, pct } from "@/lib/format";
import type { Calculation, Mode, Options } from "@/lib/types";

export default function Calculator() {
  const [opts, setOpts] = useState<Options | null>(null);
  const [courseId, setCourseId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [mode, setMode] = useState<Mode | "">("");
  const [result, setResult] = useState<Calculation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  useEffect(() => {
    api<Options>("/api/fee/options").then(setOpts).catch((e: Error) => setError(e.message));
  }, []);

  const course = opts?.courses.find((c) => String(c.id) === courseId);
  const ctype = course?.types.find((t) => String(t.id) === typeId);
  function pickCourse(v: string) {
    setResult(null); setError(""); setCourseId(v); setMode("");
    const c = opts?.courses.find((x) => String(x.id) === v);
    // auto-select when there is only one choice
    if (c && c.types.length === 1) {
      setTypeId(String(c.types[0].id));
      if (c.types[0].modes.length === 1) setMode(c.types[0].modes[0]);
    } else setTypeId("");
  }
  function pickType(v: string) {
    setTypeId(v); setMode(""); setResult(null); setError("");
    const t = course?.types.find((x) => String(x.id) === v);
    if (t && t.modes.length === 1) setMode(t.modes[0]);
  }

  async function run() {
    if (!courseId || !typeId || !mode) return;
    setBusy(true); setError("");
    try {
      const d = await api<{ result: Calculation }>("/api/fee/calculate", {
        course_id: Number(courseId), course_type_id: Number(typeId), mode,
      });
      setResult(d.result);
      setOpen({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not calculate.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    pickCourse("");
  }

  function summary(r: Calculation) {
    const lines = [
      `*Fee details – ${r.course} (${r.course_type}, ${modeLabel(r.mode)})*`,
      `Admission Fee (incl. GST): ${money(r.admission.total)}`,
      `Course Fee: ${money(r.course_fee.amount)} + GST ${pct(r.gst_percent)} = ${money(r.course_fee.total)}`,
    ];
    if (r.addon.total) lines.push(`Add-on Fee (incl. GST): ${money(r.addon.total)}`);
    if (r.material.total) lines.push(`Material Fee (incl. GST): ${money(r.material.total)}`);
    lines.push(`*Total: ${money(r.total_with_addon)}*`);
    if (open.disc && r.discount.percentage > 0) {
      lines.push("", `${r.discount.type === "discount" ? "Discount" : "Scholarship"} ${pct(r.discount.percentage)}: -${money(r.discount.amount)}`,
        `*Final fee: ${money(r.final)}*`);
    }
    if (open.lump && r.one_time.percentage > 0) {
      lines.push("", `*Lump sum payment: ${money(r.one_time.final)}* (extra ${pct(r.one_time.percentage)} off, you save ${money(r.one_time.saving)})`);
    }
    r.extra_fees.forEach((e, i) => {
      if (!open["x" + i]) return;
      lines.push("", `${e.name}: ${e.symbol}${e.amount} × ₹${e.rate} (${e.rate_label}) = ${e.rate_set ? money(e.inr) : "rate not set"}`);
    });
    return lines.join("\n");
  }

  async function copy(r: Calculation) {
    try {
      await navigator.clipboard.writeText(summary(r));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy. Please select and copy manually.");
    }
  }

  const noData = opts && !opts.courses.length;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Fee Calculator</h1><p className="muted">Select the course, then tap Calculate.</p></div>
      </div>

      {error && <div className="alert">{error}</div>}
      {noData && <div className="alert info">No fee structures yet. Add them in Odoo → Fee Calculator → Fee Structures.</div>}

      <div className="grid">
        <section className="card">
          <h3><span className="step">1</span> Course</h3>
          <label>Course Name
            <select value={courseId} onChange={(e) => pickCourse(e.target.value)} disabled={!opts}>
              <option value="">{opts ? "Select course" : "Loading…"}</option>
              {opts?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Course Type
            <select value={typeId} onChange={(e) => pickType(e.target.value)} disabled={!course}>
              <option value="">Select course type</option>
              {course?.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <div className="field">
            <span className="lbl">Mode</span>
            <div className="seg">
              {(["offline", "online"] as const).map((m) => {
                const enabled = !!ctype?.modes.includes(m);
                return (
                  <button key={m} type="button" disabled={!enabled} className={mode === m ? "on" : ""}
                    onClick={() => { setMode(m); setResult(null); setError(""); }}>
                    {modeLabel(m)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="row-btns">
            <button className="btn primary grow" disabled={!courseId || !typeId || !mode || busy} onClick={run}>
              {busy ? "Calculating…" : "Calculate Fee"}
            </button>
            <button className="btn ghost" onClick={reset} type="button">Reset</button>
          </div>
        </section>

        <section className="card">
          <h3><span className="step">2</span> Course Fee</h3>
          {!result ? (
            <div className="placeholder">Fee breakdown will appear here.</div>
          ) : (
            <>
              <div className="tags">
                <span className="chip">{result.course}</span><span className="chip">{result.course_type}</span>
                <span className={`chip ${result.mode}`}>{modeLabel(result.mode)}</span>
              </div>
              <dl className="lines">
                <div><dt>Admission Fee (incl. GST)</dt><dd>{money(result.admission.total)}</dd></div>
                <div><dt>Course Fee / Amount</dt><dd>{money(result.course_fee.amount)}</dd></div>
                <div><dt>GST ({pct(result.gst_percent)})</dt><dd>{money(result.course_fee.gst)}</dd></div>
                <div className="sub"><dt>Course Fee incl. GST</dt><dd>{money(result.course_fee.total)}</dd></div>
                {result.addon.total > 0 && <div><dt>Add-on Fee (incl. GST)</dt><dd>{money(result.addon.total)}</dd></div>}
                {result.material.total > 0 && <div><dt>Material Fee (incl. GST)</dt><dd>{money(result.material.total)}</dd></div>}
                <div className="total"><dt>Total (incl. tax)</dt><dd>{money(result.total_with_addon)}</dd></div>
              </dl>
              <p className="muted note">Admission fee is paid separately and is not included in the total.</p>
            </>
          )}
        </section>

        {result && (
          <>
            <div className="card toggles">
              <h3>More details</h3>
              <div className="toggle-row">
                <button type="button" className={`tgl ${open.disc ? "on" : ""}`} onClick={() => toggle("disc")}>Scholarship / Discount</button>
                <button type="button" className={`tgl ${open.lump ? "on" : ""}`} onClick={() => toggle("lump")}>One-time Payment</button>
                {result.extra_fees.map((e, i) => (
                  <button key={e.id} type="button" className={`tgl ${open["x" + i] ? "on" : ""}`} onClick={() => toggle("x" + i)}>{e.name} ({e.currency})</button>
                ))}
              </div>
            </div>

            {open.disc && (
              <section className="card">
                <h3>Scholarship / Discount</h3>
                {result.discount.percentage > 0 ? (
                  <>
                    <div className="info-grid">
                      <div><small>Type</small><b className="cap">{result.discount.type}</b></div>
                      <div><small>Percentage</small><b>{pct(result.discount.percentage)}</b></div>
                      <div><small>Discount</small><b className="good">−{money(result.discount.amount)}</b></div>
                      <div><small>Course fee after discount</small><b>{money(result.discount.discounted_fee)}</b></div>
                    </div>
                    <dl className="lines">
                      {result.addon.total > 0 && <div><dt>Add-on fee (no discount)</dt><dd>{money(result.addon.total)}</dd></div>}
                      {result.material.total > 0 && <div><dt>Material fee (no discount)</dt><dd>{money(result.material.total)}</dd></div>}
                      <div className="total"><dt>Final fee</dt><dd>{money(result.final)}</dd></div>
                    </dl>
                  </>
                ) : (
                  <p className="muted">No scholarship or discount is available for this course.</p>
                )}
              </section>
            )}

            {open.lump && (
              <section className="card onetime">
                <h3>One-time (Lump Sum) Payment</h3>
                {result.one_time.percentage > 0 ? (
                  <>
                    <p className="muted">Pay the full fee in one go and get an extra {pct(result.one_time.percentage)} off the {result.discount.percentage > 0 ? "discounted " : ""}course fee.</p>
                    <div className="big">{money(result.one_time.final)}</div>
                    <div className="save">You save {money(result.one_time.saving)}{result.addon.total + result.material.total > 0 ? " (add-on / material fee included in the amount)" : ""}</div>
                  </>
                ) : (
                  <p className="muted">No lump sum offer is set for this course.</p>
                )}
              </section>
            )}

            {result.extra_fees.map((e, i) => open["x" + i] && (
              <section className="card" key={e.id}>
                <h3>{e.name}</h3>
                <dl className="lines">
                  <div><dt>Fee ({e.currency})</dt><dd>{e.symbol}{e.amount.toLocaleString("en-IN")}</dd></div>
                  <div><dt>{e.rate_label}</dt><dd>{e.rate_set ? `₹${e.rate} per ${e.currency}` : "not set"}</dd></div>
                  <div className="total"><dt>Amount in ₹</dt><dd>{e.rate_set ? money(e.inr) : "Rate not set"}</dd></div>
                </dl>
                <p className="muted note">
                  {e.rate_set ? "Paid separately - not included in the course total." : "Ask the admin to set the rate in Fee Calculator → Currency Rates."}
                  {e.rate_updated ? ` Rate updated ${e.rate_updated.slice(0, 10)}.` : ""}{e.note ? ` ${e.note}` : ""}
                </p>
              </section>
            ))}

            <div className="actions">
              <button className="btn ghost" onClick={() => copy(result)}>{copied ? "Copied ✓" : "Copy summary for WhatsApp"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
