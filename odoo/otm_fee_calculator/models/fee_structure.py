from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools import float_round

MODE_SELECTION = [("offline", "Offline"), ("online", "Online")]
DISCOUNT_TYPES = [("scholarship", "Scholarship"), ("discount", "Discount")]


def _rupee(value):
    """Whole rupees, half-up (matches the 2026 fee sheet)."""
    return float_round(value, precision_rounding=1.0, rounding_method="HALF-UP")


def _r2(value):
    return float_round(value, precision_digits=2)


class OtmFeeStructure(models.Model):
    _name = "otm.fee.structure"
    _description = "Fee Structure (Course + Type + Mode)"
    _rec_name = "course_id"
    _order = "course_id, course_type_id, mode"

    course_id = fields.Many2one("otm.fee.course", string="Course", required=True, ondelete="cascade", index=True)
    course_type_id = fields.Many2one(
        "otm.fee.course.type", string="Course Type", required=True, ondelete="restrict", index=True
    )
    mode = fields.Selection(MODE_SELECTION, string="Mode", required=True, default="offline")
    admission_fee = fields.Float(string="Admission Fee (excl. GST)", digits=(16, 2))
    course_fee = fields.Float(string="Course Fee / Amount (excl. GST)", digits=(16, 2))
    material_fee = fields.Float(string="Material / Add-on Fee (excl. GST)", digits=(16, 2))
    gst_percent = fields.Float(string="GST (%)", digits=(5, 2), default=18.0)
    discount_type = fields.Selection(DISCOUNT_TYPES, string="Discount Category", default="scholarship")
    discount_percent = fields.Float(
        string="Scholarship / Discount (%)",
        digits=(7, 4),
        help="Applied on the course fee including GST (add-on fee is not discounted).",
    )
    onetime_discount_percent = fields.Float(
        string="Lump Sum Discount (%)",
        digits=(5, 2),
        default=5.0,
        help="Extra % off the discounted course fee when the student pays everything in one go.",
    )
    active = fields.Boolean(default=True)

    course_fee_incl = fields.Float(string="Course Fee incl. GST", compute="_compute_totals", digits=(16, 2))
    total_fee = fields.Float(string="Total incl. GST (with add-on)", compute="_compute_totals", digits=(16, 2))

    _combo_uniq = models.Constraint(
        "unique(course_id, course_type_id, mode)",
        "A fee structure already exists for this course, type and mode.",
    )

    @api.depends("course_fee", "material_fee", "gst_percent")
    def _compute_totals(self):
        for rec in self:
            course = _rupee(rec.course_fee * (100.0 + rec.gst_percent) / 100.0)
            addon = _rupee(rec.material_fee * (100.0 + rec.gst_percent) / 100.0)
            rec.course_fee_incl = course
            rec.total_fee = _rupee(course + addon)

    @api.depends("course_id.name", "course_type_id.name", "mode")
    def _compute_display_name(self):
        labels = dict(MODE_SELECTION)
        for rec in self:
            if rec.course_id:
                rec.display_name = "%s / %s / %s" % (
                    rec.course_id.name,
                    rec.course_type_id.name or "",
                    labels.get(rec.mode, ""),
                )
            else:
                rec.display_name = False

    @api.constrains(
        "admission_fee", "course_fee", "material_fee", "gst_percent", "discount_percent", "onetime_discount_percent"
    )
    def _check_values(self):
        for rec in self:
            if min(rec.admission_fee, rec.material_fee, rec.course_fee) < 0:
                raise ValidationError(self.env._("Fees cannot be negative."))
            if not all(0 <= p <= 100 for p in (rec.gst_percent, rec.discount_percent, rec.onetime_discount_percent)):
                raise ValidationError(self.env._("GST and discount percentages must be between 0 and 100."))

    def calculate(self):
        """Fee breakdown (JSON-safe dict) in the same order as the Logic 2026 fee sheet.

        course incl. GST -> scholarship/discount on the course fee incl. GST -> add add-on fee (incl. GST)
        -> lump sum: extra % off the discounted course fee, add-on added back untouched.
        The admission fee is shown separately and is not part of the totals.
        """
        self.ensure_one()
        gst = self.gst_percent

        def part(excl):
            incl = _rupee(excl * (100.0 + gst) / 100.0)
            return {"amount": _r2(excl), "gst": _r2(incl - excl), "total": incl}

        admission = part(self.admission_fee)
        course = part(self.course_fee)
        addon = part(self.material_fee)
        total_with_addon = _rupee(course["total"] + addon["total"])

        d_pct = self.discount_percent
        d_amount = min(_rupee(course["total"] * d_pct / 100.0), course["total"])
        discounted = _rupee(course["total"] - d_amount)
        final = _rupee(discounted + addon["total"])

        ot_pct = self.onetime_discount_percent
        ot_final = _rupee(discounted * (100.0 - ot_pct) / 100.0 + addon["total"])

        return {
            "structure_id": self.id,
            "course": self.course_id.name,
            "course_type": self.course_type_id.name,
            "mode": self.mode,
            "gst_percent": gst,
            "admission": admission,
            "course_fee": course,
            "addon": addon,
            "total_with_addon": total_with_addon,
            "discount": {
                "type": self.discount_type or "scholarship",
                "percentage": d_pct,
                "amount": d_amount,
                "discounted_fee": discounted,
            },
            "final": final,
            "one_time": {
                "percentage": ot_pct,
                "final": ot_final,
                "saving": _rupee(final - ot_final),
            },
        }
