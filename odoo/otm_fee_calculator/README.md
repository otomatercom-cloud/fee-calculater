# otm_fee_calculator (Odoo 19)

Fee master data + JSON API for the Next.js Fee Calculator frontend.

* Fee Calculator > Configuration: Courses, Course Types
* Fee Calculator > Fee Structures: one line per Course + Course Type + Mode
  (Admission Fee, Course Fee, Material/Add-on Fee - all excl. GST - GST %, Scholarship/Discount %, Lump sum %).
  The 2026 fee sheet is loaded on first install.

Groups: *Fee Calculator / User* (calculator + read-only masters), *Fee Calculator / Manager* (edit masters).
Give every counsellor the User group. API routes live under `/otm_fee/api/*`.

License: OPL-1 (c) Otomater.
