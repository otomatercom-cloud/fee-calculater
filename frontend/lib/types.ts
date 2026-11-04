export type Mode = "offline" | "online";
export type DiscountType = "scholarship" | "discount";

export interface CourseTypeOption { id: number; name: string; modes: Mode[] }
export interface CourseOption { id: number; name: string; types: CourseTypeOption[] }
export interface Options { ok: true; courses: CourseOption[] }

export interface FeePart { amount: number; gst: number; total: number }
export interface ExtraFee {
  id: number; name: string; currency: string; symbol: string; amount: number;
  current_rate: number; logic_rate: number; inr_current: number; inr_logic: number;
  rate_updated: string | false; note: string;
}
export interface Calculation {
  structure_id: number;
  course: string;
  course_type: string;
  mode: Mode;
  gst_percent: number;
  admission: FeePart;
  course_fee: FeePart;
  addon: FeePart;
  material: FeePart;
  total_with_addon: number;
  discount: { type: DiscountType; percentage: number; amount: number; discounted_fee: number };
  final: number;
  extra_fees: ExtraFee[];
  one_time: { percentage: number; final: number; saving: number };
}

export interface ChartRow {
  id: number; course: string; course_type: string; mode: Mode;
  admission: number; course_fee: number; course_incl: number; addon: number; material: number; total_with_addon: number;
  discount_type: DiscountType; discount_percent: number; discount_amount: number; discounted_fee: number;
  final: number; one_time_percent: number; one_time_final: number;
}

export interface AdminCourse { id: number; name: string; sequence: number; active: boolean }
export interface AdminStructure {
  id: number; course_id: number; course: string; course_type_id: number; course_type: string; mode: Mode;
  admission_fee: number; course_fee: number; material_fee: number; addon_fee: number; gst_percent: number;
  discount_type: DiscountType; discount_percent: number; onetime_discount_percent: number; total: number; active: boolean;
}
export interface AdminExtra {
  id: number; name: string; course_id: number; course: string; currency_id: number; currency: string;
  amount: number; note: string; inr: number; inr_current: number; sequence: number; active: boolean;
}
export interface AdminCurrency {
  id: number; name: string; symbol: string; current_rate: number; logic_rate: number; auto_fetch: boolean; rate_source: string; sequence: number; active: boolean;
  rate_updated: string | false;
}
export interface AdminData {
  ok: true; courses: AdminCourse[]; types: AdminCourse[]; structures: AdminStructure[];
  extras: AdminExtra[]; currencies: AdminCurrency[];
}
