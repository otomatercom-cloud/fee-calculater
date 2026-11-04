import logging

import requests

from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)

RATE_API = "https://open.er-api.com/v6/latest/%s"


class OtmFeeCurrency(models.Model):
    _name = "otm.fee.currency"
    _description = "Fee Currency Rate"
    _order = "sequence, name"

    name = fields.Char(string="Currency Code", required=True, help="e.g. USD, GBP")
    symbol = fields.Char(string="Symbol", help="e.g. $, £")
    current_rate = fields.Float(
        string="Market Rate (INR per 1)", digits=(12, 4),
        help="Today's rate set by the admin. Update it whenever the rate changes.",
    )
    auto_fetch = fields.Boolean(
        string="Auto-fetch Current Rate", default=True,
        help="Market rate is fetched automatically every day.",
    )
    rate_source = fields.Char(string="Last Fetch Status", readonly=True)
    rate_updated = fields.Datetime(string="Rate Updated On", readonly=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)

    _name_uniq = models.Constraint("unique(name)", "Currency code must be unique.")

    @api.constrains("current_rate")
    def _check_rates(self):
        for rec in self:
            if rec.current_rate < 0:
                raise ValidationError(self.env._("Rates cannot be negative."))

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("current_rate"):
                vals["rate_updated"] = fields.Datetime.now()
        return super().create(vals_list)

    def write(self, vals):
        if "current_rate" in vals:
            vals = dict(vals, rate_updated=fields.Datetime.now())
        return super().write(vals)

    @api.model
    def _seed_currencies(self):
        """Create USD / GBP once with rates unset (admin must enter real rates)."""
        for seq, (code, symbol) in enumerate((("USD", "$"), ("GBP", "£")), start=1):
            if not self.with_context(active_test=False).search_count([("name", "=", code)]):
                self.create({"name": code, "symbol": symbol, "sequence": seq})

    def action_fetch_rate(self):
        """Fetch today's market rate (INR per 1 unit) and store it as Current Rate."""
        errors = []
        for rec in self:
            try:
                res = requests.get(RATE_API % rec.name.upper(), timeout=15)
                res.raise_for_status()
                data = res.json()
                rate = float((data.get("rates") or {}).get("INR") or 0)
                if data.get("result") != "success" or rate <= 0:
                    raise ValueError("no INR rate in response")
                rec.write({
                    "current_rate": round(rate, 4),
                    "rate_source": "Auto-fetched %s" % fields.Datetime.now().strftime("%Y-%m-%d %H:%M"),
                })
            except Exception as exc:  # network / API problems must never break the app
                _logger.warning("Fee currency %s rate fetch failed: %s", rec.name, exc)
                rec.sudo().write({"rate_source": "Fetch failed: %s" % str(exc)[:120]})
                errors.append("%s: %s" % (rec.name, exc))
        return errors

    def action_fetch_rate_button(self):
        errors = self.action_fetch_rate()
        if errors:
            raise UserError(self.env._("Could not fetch the rate.\n%s", "\n".join(errors)))
        return True

    @api.model
    def _cron_fetch_rates(self):
        self.search([("auto_fetch", "=", True)]).action_fetch_rate()
