// Logic All Courses Fee Structure 2026 + the same calculation order as Odoo (otm.fee.structure.calculate).
// Used only when FEE_DEMO=1 so the UI can be previewed without an Odoo server.
import type { AdminData, Calculation, ChartRow, DiscountType, FeePart, Mode, Options } from "./types";

const rupee = (n: number) => Math.round(n + 1e-9);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const TYPES: Record<number, string> = { 1: "CA", 2: "CMA", 3: "ACCA", 4: "CIAP" };
const COURSES: Record<number, string> = {
  1: "CA Foundation", 2: "CA Foundation Plus Two", 3: "CA Foundation Plus One", 4: "CA Inter", 5: "CA FDN + Inter",
  6: "CMA CAT + Inter", 7: "CMA Inter", 8: "CMA USA", 9: "BCOM + ACCA", 10: "MBA + ACCA", 11: "CIAP",
};
interface S { id: number; c: number; t: number; m: Mode; course: number; addon: number; disc: number }
// course, type, mode, course fee (excl GST), add-on (excl GST), discount %
const STRUCTURES: S[] = [
  { id: 1, c: 1, t: 1, m: "offline", course: 55000, addon: 5000, disc: 10 },
  { id: 2, c: 2, t: 1, m: "online", course: 49500, addon: 0, disc: 49.4 },
  { id: 3, c: 3, t: 1, m: "online", course: 59500, addon: 0, disc: 41.17 },
  { id: 4, c: 4, t: 1, m: "offline", course: 90000, addon: 5000, disc: 10 },
  { id: 5, c: 5, t: 1, m: "offline", course: 120000, addon: 5000, disc: 10 },
  { id: 6, c: 6, t: 2, m: "offline", course: 90000, addon: 5000, disc: 10 },
  { id: 7, c: 7, t: 2, m: "offline", course: 80000, addon: 5000, disc: 10 },
  { id: 8, c: 8, t: 2, m: "offline", course: 95000, addon: 7000, disc: 10 },
  { id: 9, c: 8, t: 2, m: "online", course: 70000, addon: 0, disc: 0 },
  { id: 10, c: 9, t: 3, m: "offline", course: 120000, addon: 10000, disc: 25 },
  { id: 11, c: 10, t: 3, m: "online", course: 75000, addon: 0, disc: 0 },
  { id: 12, c: 11, t: 4, m: "offline", course: 102542.37, addon: 5000, disc: 0 },
];
const ADMISSION = 5000, GST = 18, LUMP = 5;

export function demoOptions(): Options {
  const courses = Object.entries(COURSES).map(([cid, name]) => {
    const rows = STRUCTURES.filter((s) => s.c === Number(cid));
    const typeIds = [...new Set(rows.map((s) => s.t))];
    return { id: Number(cid), name, types: typeIds.map((t) => ({ id: t, name: TYPES[t], modes: rows.filter((s) => s.t === t).map((s) => s.m) })) };
  });
  return { ok: true, courses };
}

function calc(s: S): Calculation {
  const part = (ex: number): FeePart => { const incl = rupee((ex * (100 + GST)) / 100); return { amount: r2(ex), gst: r2(incl - ex), total: incl }; };
  const course = part(s.course), addon = part(s.addon), admission = part(ADMISSION);
  const dAmount = Math.min(rupee((course.total * s.disc) / 100), course.total);
  const discounted = rupee(course.total - dAmount);
  const final = rupee(discounted + addon.total);
  const otFinal = rupee((discounted * (100 - LUMP)) / 100 + addon.total);
  return {
    structure_id: s.id, course: COURSES[s.c], course_type: TYPES[s.t], mode: s.m, gst_percent: GST,
    admission, course_fee: course, addon, total_with_addon: rupee(course.total + addon.total),
    discount: { type: "scholarship" as DiscountType, percentage: s.disc, amount: dAmount, discounted_fee: discounted },
    final, one_time: { percentage: LUMP, final: otFinal, saving: rupee(final - otFinal) },
  };
}

export function demoCalculate(body: Record<string, unknown>): { status: number; data: Record<string, unknown> } {
  const s = STRUCTURES.find((x) => x.c === Number(body.course_id) && x.t === Number(body.course_type_id) && x.m === body.mode);
  if (!s) return { status: 404, data: { ok: false, error: "No fee structure is set for this selection." } };
  return { status: 200, data: { ok: true, result: calc(s) } };
}

export function demoChart(): ChartRow[] {
  return STRUCTURES.map((s) => {
    const c = calc(s);
    return { id: s.id, course: c.course, course_type: c.course_type, mode: c.mode, admission: c.admission.total,
      course_fee: c.course_fee.amount, course_incl: c.course_fee.total, addon: c.addon.total, total_with_addon: c.total_with_addon,
      discount_type: c.discount.type, discount_percent: c.discount.percentage, discount_amount: c.discount.amount,
      discounted_fee: c.discount.discounted_fee, final: c.final, one_time_percent: c.one_time.percentage, one_time_final: c.one_time.final };
  });
}

export function demoAdminList(): AdminData {
  return {
    ok: true,
    courses: Object.entries(COURSES).map(([id, name]) => ({ id: Number(id), name, sequence: 10, active: true })),
    types: Object.entries(TYPES).map(([id, name]) => ({ id: Number(id), name, sequence: 10, active: true })),
    structures: STRUCTURES.map((s) => ({
      id: s.id, course_id: s.c, course: COURSES[s.c], course_type_id: s.t, course_type: TYPES[s.t], mode: s.m,
      admission_fee: ADMISSION, course_fee: s.course, material_fee: s.addon, gst_percent: GST,
      discount_type: "scholarship" as DiscountType, discount_percent: s.disc, onetime_discount_percent: LUMP,
      total: calc(s).total_with_addon, active: true,
    })),
  };
}
