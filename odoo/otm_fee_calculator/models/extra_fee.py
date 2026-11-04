from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools import float_round


def _rupee(value):
    return float_round(value, precision_rounding=1.0, rounding_method="HALF-UP")


class OtmFeeExtra(models.Model):
    _name = "otm.fee.extra"
    _description = "Exam / Registration Fee (foreign currency)"
    _order = "course_id, sequence, id"

    name = fields.Char(string="Fee Name", required=True, help="e.g. CMA Registration Fee, Exam Registration Fee")
    course_id = fields.Many2one("otm.fee.course", string="Course", required=True, ondelete="cascade", index=True)
    currency_id = fields.Many2one("otm.fee.currency", string="Currency", required=True, ondelete="restrict")
    amount = fields.Float(string="Amount (in currency)", digits=(16, 2))
    logic_discount_percent = fields.Float(
        string="Logic Discount (%)", digits=(5, 2),
        help="Logic's discount on the market-rate amount. Leave 0 for no discount.",
    )
    logic_rate = fields.Float(
        string="Logic Special Rate (INR per 1)", digits=(12, 4),
        help="Optional. If Logic charges a fixed special rate for this fee, enter it here. "
             "It is used instead of the discount % above.",
    )
    note = fields.Char(string="Note")
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    inr_amount = fields.Float(string="Market Amount (INR)", compute="_compute_inr_amount", digits=(16, 2))
    logic_inr_amount = fields.Float(string="Logic Amount (INR)", compute="_compute_inr_amount", digits=(16, 2))

    @api.depends("amount", "logic_discount_percent", "logic_rate", "currency_id.current_rate")
    def _compute_inr_amount(self):
        for rec in self:
            rec.inr_amount = rec._inr_market()
            rec.logic_inr_amount = rec._inr_logic()

    def _inr_market(self):
        self.ensure_one()
        rate = self.currency_id.current_rate
        return _rupee(self.amount * rate) if rate else 0.0

    def _inr_logic(self):
        """Logic's price: special rate if set, else market amount less Logic's discount %."""
        self.ensure_one()
        if self.logic_rate:
            return _rupee(self.amount * self.logic_rate)
        market = self._inr_market()
        return _rupee(market * (100.0 - self.logic_discount_percent) / 100.0) if market else 0.0

    def _logic_applies(self):
        self.ensure_one()
        return bool(self.logic_rate or self.logic_discount_percent)

    @api.constrains("amount", "logic_discount_percent", "logic_rate")
    def _check_values(self):
        for rec in self:
            if rec.amount < 0 or rec.logic_rate < 0:
                raise ValidationError(self.env._("Amount and rate cannot be negative."))
            if not 0 <= rec.logic_discount_percent <= 100:
                raise ValidationError(self.env._("Logic discount must be between 0 and 100."))

    def calculate_all(self):
        """JSON-safe list for the calculator: market amount and Logic's price (discount / special rate)."""
        out = []
        for rec in self.sorted(lambda r: (r.sequence, r.id)):
            cur = rec.currency_id
            market = rec._inr_market()
            logic = rec._inr_logic()
            out.append({
                "id": rec.id,
                "name": rec.name,
                "currency": cur.name,
                "symbol": cur.symbol or cur.name,
                "amount": rec.amount,
                "current_rate": cur.current_rate,
                "market_set": bool(cur.current_rate),
                "inr_market": market,
                "logic_applies": rec._logic_applies(),
                "logic_discount_percent": rec.logic_discount_percent,
                "logic_rate": rec.logic_rate,
                "inr_logic": logic,
                "saving": _rupee(market - logic) if rec._logic_applies() and market else 0.0,
                "rate_updated": fields.Datetime.to_string(cur.rate_updated) if cur.rate_updated else False,
                "note": rec.note or "",
            })
        return out
