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
    rate_basis = fields.Selection(
        RATE_BASIS, string="Convert Using", required=True, default="current",
        help="Current rate = the day's rate set in the currency master. Logic rate = Logic's own rate.",
    )
    note = fields.Char(string="Note")
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    inr_amount = fields.Float(string="Amount in INR", compute="_compute_inr_amount", digits=(16, 2))

    @api.depends("amount", "rate_basis", "currency_id.current_rate", "currency_id.logic_rate")
    def _compute_inr_amount(self):
        for rec in self:
            rec.inr_amount = rec._inr()

    def _rate(self):
        self.ensure_one()
        cur = self.currency_id
        return cur.logic_rate if self.rate_basis == "logic" else cur.current_rate

    def _inr(self):
        self.ensure_one()
        rate = self._rate()
        return float_round(self.amount * rate, precision_rounding=1.0, rounding_method="HALF-UP") if rate else 0.0

    @api.constrains("amount")
    def _check_amount(self):
        for rec in self:
            if rec.amount < 0:
                raise ValidationError(self.env._("Amount cannot be negative."))

    def calculate_all(self):
        """JSON-safe list for the calculator (used by otm.fee.structure.calculate)."""
        labels = dict(RATE_BASIS)
        out = []
        for rec in self.sorted(lambda r: (r.sequence, r.id)):
            cur = rec.currency_id
            rate = rec._rate()
            out.append({
                "id": rec.id,
                "name": rec.name,
                "currency": cur.name,
                "symbol": cur.symbol or cur.name,
                "amount": rec.amount,
                "rate_basis": rec.rate_basis,
                "rate_label": labels[rec.rate_basis],
                "rate": rate,
                "rate_set": bool(rate),
                "inr": rec._inr(),
                "rate_updated": fields.Datetime.to_string(cur.rate_updated) if cur.rate_updated else False,
                "note": rec.note or "",
            })
        return out
