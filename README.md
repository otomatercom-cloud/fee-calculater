# Fee Calculator (Otomater)

* `odoo/otm_fee_calculator/` – Odoo 19 module. Copy `otm_fee_calculator` into your addons path, Update Apps List, install.
* `frontend/`               – Next.js UI (login, calculator, fee chart). See `frontend/README.md`.

Setup order: install module -> give counsellors the group *Fee Calculator / User* -> add Courses, Course Types,
Fee Structures, Scholarships in Odoo -> run frontend with ODOO_URL / ODOO_DB set.

## Roles
* **Admin** = Odoo group *Fee Calculator / Manager*: adds/edits courses, course types, fee structures (admission, add-on, material, amount, GST, one-time %), exam/registration fees in foreign currency and currency rates, scholarships & discounts - in Odoo or in the frontend **Manage Fees** page.
* **Admission officer** = Odoo group *Fee Calculator / User*: frontend Calculator + Fee Chart only (view and calculate). The API blocks every change from this group.

## Fee data
The "Logic All Courses Fee Structure 2026" sheet is loaded once on install or first upgrade (12 course lines; the old sample data is removed). All amounts are stored
excluding GST (18%); admin edits them later in Odoo or in the frontend **Manage Fees** page.
Calculation: Course fee + GST -> scholarship/discount % on that -> add-on + material fee (incl. GST) added -> lump sum 5% on the
discounted course fee (add-on not reduced). Admission fee (incl. GST) is shown separately.

## v19.0.1.1.0 additions
* Add-on fee and Material fee are separate; each is hidden in the calculator when 0.
* Scholarship/Discount, One-time Payment and each exam/registration fee open only when its button is clicked.
* Odoo -> Fee Calculator -> Configuration -> **Currency Rates** (Current rate + Logic rate per currency; USD/GBP created with rates blank - enter real rates) and **Exam / Registration Fees** (per course: name, currency, amount, convert using Current or Logic rate). These are shown separately and are NOT added to the course total.
* Upgrade: replace the module folder, restart Odoo, Apps -> Upgrade. Old "material" values move to Add-on automatically.

## Dollar rates
* **Market rate** = common rate, auto-fetched daily by an Odoo scheduled action (open.er-api.com, no key; the Odoo server needs internet). "Fetch Now" in Odoo or "Fetch live rate" in Manage Fees -> Currency Rates fetches instantly. Untick *Auto-fetch* to enter it by hand.
* **Logic rate** = Logic's special rate, always entered by the admin.
* The calculator shows both amounts for every exam/registration fee.
