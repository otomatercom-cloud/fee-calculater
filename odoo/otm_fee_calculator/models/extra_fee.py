from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools import float_round

RATE_BASIS = [("current", "Current rate"), ("logic", "Logic rate")]


class OtmFeeExtra(models.Model):
    _name = "otm.fee.extra"
    _description = "Exam / Registration Fee (foreign currency)"
    _order = "course_id, sequence, id"

    name = fields.Char(string="Fee Name", required=True, help="e.g. CMA Registration Fee, Exam Registration Fee")
    course_id = fields.Many2one("otm.fee.course", string="Course", required=True, ondelete="cascade", index=True)
    currency_id = fields.Many2one("otm.fee.currency", string="Currency", required=True, ondelete="restrict")
    amount = fields.Float(string="Amount (in currency)", digits=(16, 2))
    rate_basis = fields.Selection(RATE_BASIS, string="(unused)", default="current")
    note = fields.Char(string="Note")
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    inr_amount = fields.Float(string="Amount in INR (Logic rate)", compute="_compute_inr_amount", digits=(16, 2))

    @api.depends("amount", "currency_id.current_rate", "currency_id.logic_rate")
    def _compute_inr_amount(self):
        for rec in self:
            rec.inr_amount = rec._inr("logic")

    def _inr(self, basis="logic"):
        self.ensure_one()
        cur = self.currency_id
        rate = cur.logic_rate if basis == "logic" else cur.current_rate
        return float_round(self.amount * rate, precision_rounding=1.0, rounding_method="HALF-UP") if rate else 0.0

    @api.constrains("amount")
    def _check_amount(self):
        for rec in self:
            if rec.amount < 0:
                raise ValidationError(self.env._("Amount cannot be negative."))

    def calculate_all(self):
        """JSON-safe list for the calculator: market (current) rate AND Logic's special rate."""
        out = []
        for rec in self.sorted(lambda r: (r.sequence, r.id)):
            cur = rec.currency_id
            out.append({
                "id": rec.id,
                "name": rec.name,
                "currency": cur.name,
                "symbol": cur.symbol or cur.name,
                "amount": rec.amount,
                "current_rate": cur.current_rate,
                "logic_rate": cur.logic_rate,
                "inr_current": rec._inr("current"),
                "inr_logic": rec._inr("logic"),
                "rate_updated": fields.Datetime.to_string(cur.rate_updated) if cur.rate_updated else False,
                "note": rec.note or "",
            })
        return out
