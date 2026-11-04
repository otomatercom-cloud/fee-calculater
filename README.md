# Fee Calculator (Otomater)

* `odoo/otm_fee_calculator/` – Odoo 19 module. Copy `otm_fee_calculator` into your addons path, Update Apps List, install.
* `frontend/`               – Next.js UI (login, calculator, fee chart). See `frontend/README.md`.

Setup order: install module -> give counsellors the group *Fee Calculator / User* -> add Courses, Course Types,
Fee Structures, Scholarships in Odoo -> run frontend with ODOO_URL / ODOO_DB set.

## Roles
* **Admin** = Odoo group *Fee Calculator / Manager*: adds/edits courses, course types, fee structures (admission, material, amount, GST, one-time %), scholarships & discounts - in Odoo or in the frontend **Manage Fees** page.
* **Admission officer** = Odoo group *Fee Calculator / User*: frontend Calculator + Fee Chart only (view and calculate). The API blocks every change from this group.

## Fee data
The "Logic All Courses Fee Structure 2026" sheet is loaded once on install or first upgrade (12 course lines; the old sample data is removed). All amounts are stored
excluding GST (18%); admin edits them later in Odoo or in the frontend **Manage Fees** page.
Calculation: Course fee + GST -> scholarship/discount % on that -> add-on fee (incl. GST) added -> lump sum 5% on the
discounted course fee (add-on not reduced). Admission fee (incl. GST) is shown separately.
