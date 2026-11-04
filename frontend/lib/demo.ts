// Sample data + the same calculation order as the Odoo model (otm.fee.structure.calculate).
// Only used when FEE_DEMO=1 so the UI can be previewed without an Odoo server.
import type { Calculation, ChartRow, Mode, Options, ScholarshipOption } from "./types";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const TYPES = { 1: "Regular Batch", 2: "Weekend Batch", 3: "Crash Course" } as Record<number, string>;
const COURSES = { 1: "CMA USA", 2: "ACCA", 3: "CPA USA" } as Record<number, string>;

interface S { id: number; c: number; t: number; m: Mode; a: number; mt: number; f: number; ot: number }
const STRUCTURES: S[] = [
  { id: 1, c: 1, t: 1, m: "offline", a: 5000, mt: 8000, f: 85000, ot: 5 },
  { id: 2, c: 1, t: 1, m: "online", a: 3000, mt: 5000, f: 65000, ot: 5 },
  { id: 3, c: 1, t: 2, m: "offline", a: 5000, mt: 8000, f: 90000, ot: 4 },
  { id: 4, c: 2, t: 1, m: "offline", a: 6000, mt: 10000, f: 120000, ot: 5 },
  { id: 5, c: 2, t: 1, m: "online", a: 4000, mt: 7000, f: 95000, ot: 5 },
  { id: 6, c: 3, t: 1, m: "offline", a: 5000, mt: 9000, f: 110000, ot: 6 },
  { id: 7, c: 3, t: 3, m: "online", a: 3000, mt: 6000, f: 70000, ot: 3 },
];
const GST = 18;
const SCHOLARSHIPS: ScholarshipOption[] = [
  { id: 1, name: "Merit Scholarship", kind: "scholarship", percentage: 10, apply_on: "course_fee", course_ids: [] },
  { id: 2, name: "Sibling Discount", kind: "discount", percentage: 5, apply_on: "course_fee", course_ids: [] },
  { id: 3, name: "Early Bird Discount", kind: "discount", percentage: 7.5, apply_on: "subtotal", course_ids: [1, 2] },
];

export function demoOptions(): Options {
  const courses = Object.entries(COURSES).map(([cid, name]) => {
    const rows = STRUCTURES.filter((s) => s.c === Number(cid));
    const typeIds = [...new Set(rows.map((s) => s.t))];
    return {
      id: Number(cid), name,
      types: typeIds.map((t) => ({ id: t, name: TYPES[t], modes: rows.filter((s) => s.t === t).map((s) => s.m) })),
    };
  });
  return { ok: true, courses, scholarships: SCHOLARSHIPS };
}

export function demoChart(): ChartRow[] {
  return STRUCTURES.map((s) => {
    const sub = s.a + s.mt + s.f;
    const gst = r2((sub * GST) / 100);
    return { id: s.id, course: COURSES[s.c], course_type: TYPES[s.t], mode: s.m, admission: s.a, material: s.mt,
      course_fee: s.f, gst_percent: GST, gst_amount: gst, total: r2(sub + gst) };
  });
}

export function demoCalculate(body: Record<string, unknown>): { status: number; data: Record<string, unknown> } {
  const s = STRUCTURES.find((x) => x.c === Number(body.course_id) && x.t === Number(body.course_type_id) && x.m === body.mode);
  if (!s) return { status: 404, data: { ok: false, error: "No fee structure is set for this selection." } };
  const sch = SCHOLARSHIPS.find((x) => x.id === Number(body.scholarship_id)) ?? null;
  if (sch && sch.course_ids.length && !sch.course_ids.includes(s.c))
    return { status: 400, data: { ok: false, error: "This scholarship is not available for the selected course." } };
  const subtotal = r2(s.a + s.mt + s.f);
  const stdGst = r2((subtotal * GST) / 100);
  let discount = 0;
  if (sch) {
    const base = sch.apply_on === "course_fee" ? s.f : subtotal;
    discount = Math.min(r2((base * sch.percentage) / 100), base);
  }
  const taxable = r2(subtotal - discount);
  const gst = r2((taxable * GST) / 100);
  const otDiscount = Math.min(r2((s.f * s.ot) / 100), taxable);
  const otTaxable = r2(taxable - otDiscount);
  const otGst = r2((otTaxable * GST) / 100);
  const otTotal = r2(otTaxable + otGst);
  const result: Calculation = {
    structure_id: s.id, course: COURSES[s.c], course_type: TYPES[s.t], mode: s.m,
    fees: { admission: s.a, material: s.mt, course: s.f, subtotal },
    gst_percent: GST,
    standard: { gst: stdGst, total: r2(subtotal + stdGst) },
    scholarship: sch ? { id: sch.id, name: sch.name, kind: sch.kind, percentage: sch.percentage, apply_on: sch.apply_on, discount } : null,
    after_scholarship: { taxable, gst, total: r2(taxable + gst) },
    one_time: { percentage: s.ot, discount: otDiscount, taxable: otTaxable, gst: otGst, total: otTotal, saving: r2(taxable + gst - otTotal) },
  };
  return { status: 200, data: { ok: true, result } };
}

export function demoAdminList() {
  const structures = STRUCTURES.map((s) => {
    const sub = s.a + s.mt + s.f;
    return { id: s.id, course_id: s.c, course: COURSES[s.c], course_type_id: s.t, course_type: TYPES[s.t], mode: s.m,
      admission_fee: s.a, material_fee: s.mt, course_fee: s.f, gst_percent: GST, onetime_discount_percent: s.ot,
      total: r2(sub + (sub * GST) / 100), active: true };
  });
  return {
    ok: true,
    courses: Object.entries(COURSES).map(([id, name]) => ({ id: Number(id), name, sequence: 10, active: true })),
    types: Object.entries(TYPES).map(([id, name]) => ({ id: Number(id), name, sequence: 10, active: true })),
    structures,
    scholarships: SCHOLARSHIPS.map((s) => ({ ...s, note: "", sequence: 10, active: true })),
  };
}
