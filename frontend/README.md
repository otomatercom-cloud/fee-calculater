# Fee Calculator – Next.js frontend

Works with the Odoo 19 module `otm_fee_calculator` (Odoo holds all data and does the calculation; this app is only the UI).

## Run

```bash
cp .env.example .env.local        # set ODOO_URL and ODOO_DB
npm install
npm run dev                       # http://localhost:3000
```

Preview without Odoo: set `FEE_DEMO=1` in `.env.local`, login `admin` / `admin`.

Production: `npm run build && npm start`. After any update that changes `package.json`, run `npm install` again.

## How it talks to Odoo
Browser -> Next.js `/api/*` -> Odoo `/otm_fee/api/*`. The Odoo session id is kept in an httpOnly cookie,
so Odoo credentials / session never reach browser JavaScript.
