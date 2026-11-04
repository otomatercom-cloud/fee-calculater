# otm_fee_calculator (Odoo 19)

Fee master data + JSON API for the Next.js Fee Calculator frontend.

* Fee Calculator > Configuration: Courses, Course Types
* Fee Calculator > Fee Structures: one line per Course + Course Type + Mode
  (Admission Fee, Material Fee, Amount/Course Fee, GST %, One-time payment discount %)
* Fee Calculator > Scholarships & Discounts: name, category, percentage, applies on

Groups: *Fee Calculator / User* (calculator + read-only masters), *Fee Calculator / Manager* (edit masters).
Give every counsellor the User group. API routes live under `/otm_fee/api/*`.

License: OPL-1 (c) Otomater.
