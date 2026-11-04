# Fee Calculator (Otomater)

* `odoo/otm_fee_calculator/` – Odoo 19 module. Copy `otm_fee_calculator` into your addons path, Update Apps List, install.
* `frontend/`               – Next.js UI (login, calculator, fee chart). See `frontend/README.md`.

Setup order: install module -> give counsellors the group *Fee Calculator / User* -> add Courses, Course Types,
Fee Structures, Scholarships in Odoo -> run frontend with ODOO_URL / ODOO_DB set.

## Roles
* **Admin** = Odoo group *Fee Calculator / Manager*: adds/edits courses, course types, fee structures (admission, material, amount, GST, one-time %), scholarships & discounts - in Odoo or in the frontend **Manage Fees** page.
* **Admission officer** = Odoo group *Fee Calculator / User*: frontend Calculator + Fee Chart only (view and calculate). The API blocks every change from this group.
