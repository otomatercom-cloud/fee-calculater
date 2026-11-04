"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { modeLabel, money, pct } from "@/lib/format";
import type { Calculation, Mode, Options } from "@/lib/types";

const rupee = (n: number) => Math.round(n + 1e-9);
// Same order as Odoo: discount on course fee incl. GST only; add-on/material not discounted; lump sum on discounted course fee.
function adjust(r: Calculation, p: number) {
  const extras = r.addon.total + r.material.total;
  const amount = Math.min(rupee((r.course_fee.total * p) / 100), r.course_fee.total);
  const discounted = rupee(r.course_fee.total - amount);
  const final = rupee(discounted + extras);
  const lump = rupee((discounted * (100 - r.one_time.percentage)) / 100 + extras);
  return { amount, discounted, final, lump, saving: rupee(final - lump) };
}

export default function Calculator() {
  const [opts, setOpts] = useState<Options | null>(null);
  const [courseId, setCourseId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [mode, setMode] = useState<Mode | "">("");
  const [result, setResult] = useState<Calculation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [discPct, setDiscPct] = useState("0");
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
      setDiscPct(String(d.result.discount.percentage));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not calculate.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    pickCourse("");
  }

  const pctNum = Math.min(100, Math.max(0, Number(discPct) || 0));
  const D = result ? adjust(result, pctNum) : null;

  function summary(r: Calculation) {
    const D = adjust(r, pctNum);
    const lines = [
      `*Fee details – ${r.course} (${r.course_type}, ${modeLabel(r.mode)})*`,
      `Admission Fee (incl. GST): ${money(r.admission.total)}`,
      `Course Fee: ${money(r.course_fee.amount)} + GST ${pct(r.gst_percent)} = ${money(r.course_fee.total)}`,
    ];
    if (r.addon.total) lines.push(`Add-on Fee (incl. GST): ${money(r.addon.total)}`);
    if (r.material.total) lines.push(`Material Fee (incl. GST): ${money(r.material.total)}`);
    lines.push(`*Total: ${money(r.total_with_addon)}*`);
    if (open.disc && pctNum > 0) {
      lines.push("", `${r.discount.type === "discount" ? "Discount" : "Scholarship"} ${pct(pctNum)}: -${money(D.amount)}`,
        `*Final fee: ${money(D.final)}*`);
    }
    if (open.lump && r.one_time.percentage > 0) {
      lines.push("", `*Lump sum payment: ${money(D.lump)}* (extra ${pct(r.one_time.percentage)} off, you save ${money(D.saving)})`);
    }
    r.extra_fees.forEach((e, i) => {
      if (!open["x" + i]) return;
      lines.push("", `*${e.name}: ${e.symbol}${e.amount}*`,
        ...(e.logic_applies
          ? [`Market amount (₹${e.current_rate} per ${e.currency}): ${money(e.inr_market)}`,
             `*Logic price${e.logic_rate ? ` (special rate ₹${e.logic_rate})` : ` (${pct(e.logic_discount_percent)} discount)`}: ${money(e.inr_logic)}* - you save ${money(e.saving)}`]
          : [`*Amount (₹${e.current_rate} per ${e.currency}): ${e.market_set ? money(e.inr_market) : "rate not set"}*`]));
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
              <div className="toggle-row">
                <button type="button" aria-pressed={!!open.disc} className={`tgl ${open.disc ? "on" : ""}`} onClick={() => toggle("disc")}>{open.disc ? "−" : "+"} Scholarship / Discount</button>
                <button type="button" aria-pressed={!!open.lump} className={`tgl ${open.lump ? "on" : ""}`} onClick={() => toggle("lump")}>{open.lump ? "−" : "+"} One-time Payment</button>
                {result.extra_fees.map((e, i) => (
                  <button key={e.id} type="button" aria-pressed={!!open["x" + i]} className={`tgl ${open["x" + i] ? "on" : ""}`} onClick={() => toggle("x" + i)}>{open["x" + i] ? "−" : "+"} {e.name} ({e.currency})</button>
                ))}
              </div>
            </>
          )}
        </section>

        {result && (
          <>
            <div className="panels">
            {open.disc && (
              <section className="card">
                <h3>Scholarship / Discount</h3>
                <label className="pct-edit">Percentage (%)
                  <div className="pct-row">
                    <input type="number" inputMode="decimal" min="0" max="100" step="any" value={discPct} onChange={(e) => setDiscPct(e.target.value)} />
                    {pctNum !== result.discount.percentage && (
                      <button type="button" className="link-btn" onClick={() => setDiscPct(String(result.discount.percentage))}>Reset to {pct(result.discount.percentage)}</button>
                    )}
                  </div>
                </label>
                <div className="info-grid">
                  <div><small>Type</small><b className="cap">{result.discount.type}</b></div>
                  <div><small>Percentage</small><b>{pct(pctNum)}</b></div>
                  <div><small>Discount</small><b className="good">−{money(D!.amount)}</b></div>
                  <div><small>Course fee after discount</small><b>{money(D!.discounted)}</b></div>
                </div>
                <dl className="lines">
                  {result.addon.total > 0 && <div><dt>Add-on fee (no discount)</dt><dd>{money(result.addon.total)}</dd></div>}
                  {result.material.total > 0 && <div><dt>Material fee (no discount)</dt><dd>{money(result.material.total)}</dd></div>}
                  <div className="total"><dt>Final fee</dt><dd>{money(D!.final)}</dd></div>
                </dl>
              </section>
            )}

            {open.lump && (
              <section className="card onetime">
                <h3>One-time (Lump Sum) Payment</h3>
                {result.one_time.percentage > 0 ? (
                  <>
                    <p className="muted">Pay the full fee in one go and get an extra {pct(result.one_time.percentage)} off the {pctNum > 0 ? "discounted " : ""}course fee.</p>
                    <div className="big">{money(D!.lump)}</div>
                    <div className="save">You save {money(D!.saving)}{result.addon.total + result.material.total > 0 ? " (add-on / material fee included in the amount)" : ""}</div>
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
                  {e.logic_applies ? (
                    <>
                      <div><dt>Market amount{e.current_rate ? ` (₹${e.current_rate} per ${e.currency})` : ""}</dt><dd>{e.market_set ? money(e.inr_market) : "rate not set"}</dd></div>
                      <div className="total"><dt>Logic price{e.logic_rate ? ` (special rate ₹${e.logic_rate})` : ` (${pct(e.logic_discount_percent)} discount)`}</dt><dd>{e.inr_logic || e.logic_rate ? money(e.inr_logic) : "Rate not set"}</dd></div>
                    </>
                  ) : (
                    <div className="total"><dt>Amount{e.current_rate ? ` (₹${e.current_rate} per ${e.currency})` : ""}</dt><dd>{e.market_set ? money(e.inr_market) : "Rate not set"}</dd></div>
                  )}
                </dl>
                {e.logic_applies && e.saving > 0 && <div className="save">Logic saves you {money(e.saving)}</div>}
                <p className="muted note">
                  Paid separately - not included in the course total.
                  {e.rate_updated ? ` Market rate updated ${e.rate_updated.slice(0, 10)}.` : ""}{e.note ? ` ${e.note}` : ""}
                </p>
              </section>
            ))}

            </div>

            <div className="actions">
              <button className="btn ghost" onClick={() => copy(result)}>{copied ? "Copied ✓" : "Copy summary for WhatsApp"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
