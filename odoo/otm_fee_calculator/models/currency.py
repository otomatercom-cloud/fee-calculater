from odoo import api, fields, models
from odoo.exceptions import ValidationError


class OtmFeeCurrency(models.Model):
    _name = "otm.fee.currency"
    _description = "Fee Currency Rate"
    _order = "sequence, name"

    name = fields.Char(string="Currency Code", required=True, help="e.g. USD, GBP")
    symbol = fields.Char(string="Symbol", help="e.g. $, £")
    current_rate = fields.Float(
        string="Current Rate (INR per 1)", digits=(12, 4),
        help="Today's rate set by the admin. Update it whenever the rate changes.",
    )
    logic_rate = fields.Float(
        string="Logic Rate (INR per 1)", digits=(12, 4),
        help="Rate Logic charges the student for fees set to 'Logic rate'.",
    )
    rate_updated = fields.Datetime(string="Rates Updated On", readonly=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)

    _name_uniq = models.Constraint("unique(name)", "Currency code must be unique.")

    @api.constrains("current_rate", "logic_rate")
    def _check_rates(self):
        for rec in self:
            if rec.current_rate < 0 or rec.logic_rate < 0:
                raise ValidationError(self.env._("Rates cannot be negative."))

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("current_rate") or vals.get("logic_rate"):
                vals["rate_updated"] = fields.Datetime.now()
        return super().create(vals_list)

    def write(self, vals):
        if "current_rate" in vals or "logic_rate" in vals:
            vals = dict(vals, rate_updated=fields.Datetime.now())
        return super().write(vals)

    @api.model
    def _seed_currencies(self):
        """Create USD / GBP once with rates unset (admin must enter real rates)."""
        for seq, (code, symbol) in enumerate((("USD", "$"), ("GBP", "£")), start=1):
            if not self.with_context(active_test=False).search_count([("name", "=", code)]):
                self.create({"name": code, "symbol": symbol, "sequence": seq})
