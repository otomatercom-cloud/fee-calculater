export type Mode = "offline" | "online";

export interface CourseTypeOption { id: number; name: string; modes: Mode[] }
export interface CourseOption { id: number; name: string; types: CourseTypeOption[] }
export interface ScholarshipOption {
  id: number;
  name: string;
  kind: "scholarship" | "discount";
  percentage: number;
  apply_on: "course_fee" | "subtotal";
  course_ids: number[];
}
export interface Options { ok: true; courses: CourseOption[]; scholarships: ScholarshipOption[] }

export interface Calculation {
  structure_id: number;
  course: string;
  course_type: string;
  mode: Mode;
  fees: { admission: number; material: number; course: number; subtotal: number };
  gst_percent: number;
  standard: { gst: number; total: number };
  scholarship: {
    id: number; name: string; kind: "scholarship" | "discount";
    percentage: number; apply_on: "course_fee" | "subtotal"; discount: number;
  } | null;
  after_scholarship: { taxable: number; gst: number; total: number };
  one_time: { percentage: number; discount: number; taxable: number; gst: number; total: number; saving: number };
}

export interface ChartRow {
  id: number; course: string; course_type: string; mode: Mode;
  admission: number; material: number; course_fee: number;
  gst_percent: number; gst_amount: number; total: number;
}

export interface AdminCourse { id: number; name: string; sequence: number; active: boolean }
export interface AdminStructure {
  id: number; course_id: number; course: string; course_type_id: number; course_type: string; mode: Mode;
  admission_fee: number; material_fee: number; course_fee: number; gst_percent: number;
  onetime_discount_percent: number; total: number; active: boolean;
}
export interface AdminScholarship {
  id: number; name: string; kind: "scholarship" | "discount"; percentage: number; apply_on: "course_fee" | "subtotal";
  course_ids: number[]; note: string; sequence: number; active: boolean;
}
export interface AdminData {
  ok: true; courses: AdminCourse[]; types: AdminCourse[]; structures: AdminStructure[]; scholarships: AdminScholarship[];
}
