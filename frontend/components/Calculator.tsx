"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { modeLabel, money, pct } from "@/lib/format";
import type { Calculation, Mode, Options } from "@/lib/types";

export default function Calculator() {
  const [opts, setOpts] = useState<Options | null>(null);
  const [courseId, setCourseId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [mode, setMode] = useState<Mode | "">("");
  const [scholarshipId, setScholarshipId] = useState("");
  const [result, setResult] = useState<Calculation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<Options>("/api/fee/options").then(setOpts).catch((e: Error) => setError(e.message));
  }, []);

  const course = opts?.courses.find((c) => String(c.id) === courseId);
  const ctype = course?.types.find((t) => String(t.id) === typeId);
  const scholarships = useMemo(
    () => (opts?.scholarships || []).filter((s) => !s.course_ids.length || (course && s.course_ids.includes(course.id))),
    [opts, course]
  );
  const chosen = scholarships.find((s) => String(s.id) === scholarshipId);

  function pickCourse(v: string) {
    setCourseId(v); setTypeId(""); setMode(""); setScholarshipId(""); setResult(null); setError("");
  }
  function pickType(v: string) {
    setTypeId(v); setMode(""); setResult(null); setError("");
    const t = course?.types.find((x) => String(x.id) === v);
    if (t && t.modes.length === 1) setMode(t.modes[0]);
  }

  async function run(schId: string) {
    if (!courseId || !typeId || !mode) return;
    setBusy(true); setError("");
    try {
      const d = await api<{ result: Calculation }>("/api/fee/calculate", {
        course_id: Number(courseId), course_type_id: Number(typeId), mode, scholarship_id: schId ? Number(schId) : null,
      });
      setResult(d.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not calculate.");
    } finally {
      setBusy(false);
    }
  }

  function pickScholarship(v: string) {
    setScholarshipId(v);
    if (result) void run(v);
  }

  function reset() {
    pickCourse("");
  }

  function summary(r: Calculation) {
    const lines = [
      `*Fee details – ${r.course} (${r.course_type}, ${modeLabel(r.mode)})*`,
      `Admission Fee: ${money(r.fees.admission)}`,
      `Material Fee: ${money(r.fees.material)}`,
      `Amount: ${money(r.fees.course)}`,
      `GST (${pct(r.gst_percent)}): ${money(r.standard.gst)}`,
      `*Total: ${money(r.standard.total)}*`,
    ];
    if (r.scholarship) {
      lines.push("", `${r.scholarship.name} (${pct(r.scholarship.percentage)}): -${money(r.scholarship.discount)}`,
        `*Payable after ${r.scholarship.kind}: ${money(r.after_scholarship.total)}*`);
    }
    if (r.one_time.percentage > 0) {
      lines.push("", `*One-time payment: ${money(r.one_time.total)}* (extra ${pct(r.one_time.percentage)} off course fee, you save ${money(r.one_time.saving)})`);
    }
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
            <button className="btn primary grow" disabled={!courseId || !typeId || !mode || busy} onClick={() => run(scholarshipId)}>
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
                <div><dt>Admission Fee</dt><dd>{money(result.fees.admission)}</dd></div>
                <div><dt>Material Fee</dt><dd>{money(result.fees.material)}</dd></div>
                <div><dt>Amount (Course Fee)</dt><dd>{money(result.fees.course)}</dd></div>
                <div className="sub"><dt>Fee before GST</dt><dd>{money(result.fees.subtotal)}</dd></div>
                <div><dt>GST ({pct(result.gst_percent)})</dt><dd>{money(result.standard.gst)}</dd></div>
                <div className="total"><dt>Total</dt><dd>{money(result.standard.total)}</dd></div>
              </dl>
            </>
          )}
        </section>

        {result && (
          <>
            <section className="card">
              <h3><span className="step">3</span> Scholarship / Discount</h3>
              <label>Select Scholarship or Discount
                <select value={scholarshipId} onChange={(e) => pickScholarship(e.target.value)} disabled={busy}>
                  <option value="">None</option>
                  {scholarships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              {result.scholarship && chosen ? (
                <>
                  <div className="info-grid">
                    <div><small>Type</small><b className="cap">{result.scholarship.kind}</b></div>
                    <div><small>Percentage</small><b>{pct(result.scholarship.percentage)}</b></div>
                    <div><small>Applied on</small><b>{result.scholarship.apply_on === "course_fee" ? "Course fee" : "Total fee"}</b></div>
                    <div><small>Discount</small><b className="good">−{money(result.scholarship.discount)}</b></div>
                  </div>
                  <dl className="lines">
                    <div><dt>Fee after discount</dt><dd>{money(result.after_scholarship.taxable)}</dd></div>
                    <div><dt>GST ({pct(result.gst_percent)})</dt><dd>{money(result.after_scholarship.gst)}</dd></div>
                    <div className="total"><dt>Payable</dt><dd>{money(result.after_scholarship.total)}</dd></div>
                  </dl>
                </>
              ) : (
                <p className="muted">{scholarships.length ? "Choose one to see the discount." : "No scholarship available for this course."}</p>
              )}
            </section>

            <section className="card onetime">
              <h3><span className="step">4</span> One-time Payment</h3>
              {result.one_time.percentage > 0 ? (
                <>
                  <p className="muted">Pay the full fee in one go and get an extra {pct(result.one_time.percentage)} off the course fee.</p>
                  <div className="big">{money(result.one_time.total)}</div>
                  <dl className="lines">
                    <div><dt>Extra discount</dt><dd className="good">−{money(result.one_time.discount)}</dd></div>
                    <div><dt>Fee after discount</dt><dd>{money(result.one_time.taxable)}</dd></div>
                    <div><dt>GST ({pct(result.gst_percent)})</dt><dd>{money(result.one_time.gst)}</dd></div>
                  </dl>
                  <div className="save">You save {money(result.one_time.saving)}{result.scholarship ? " on top of the scholarship" : ""}</div>
                </>
              ) : (
                <p className="muted">No one-time payment offer is set for this course.</p>
              )}
            </section>

            <div className="actions">
              <button className="btn ghost" onClick={() => copy(result)}>{copied ? "Copied ✓" : "Copy summary for WhatsApp"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
