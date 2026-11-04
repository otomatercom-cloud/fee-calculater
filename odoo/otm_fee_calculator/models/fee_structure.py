from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools import float_round

MODE_SELECTION = [("offline", "Offline"), ("online", "Online")]


def _r(value):
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
    admission_fee = fields.Float(string="Admission Fee", digits=(16, 2))
    material_fee = fields.Float(string="Material Fee", digits=(16, 2))
    course_fee = fields.Float(string="Amount (Course Fee)", digits=(16, 2))
    gst_percent = fields.Float(string="GST (%)", digits=(5, 2), default=18.0)
    onetime_discount_percent = fields.Float(
        string="One-time Payment Discount (%)",
        digits=(5, 2),
        help="Extra discount on the Course Fee (Amount) when the student pays everything in one go.",
    )
    active = fields.Boolean(default=True)

    subtotal = fields.Float(string="Fee Before GST", compute="_compute_totals", digits=(16, 2))
    gst_amount = fields.Float(string="GST Amount", compute="_compute_totals", digits=(16, 2))
    total_fee = fields.Float(string="Total Fee", compute="_compute_totals", digits=(16, 2))

    _combo_uniq = models.Constraint(
        "unique(course_id, course_type_id, mode)",
        "A fee structure already exists for this course, type and mode.",
    )

    @api.depends("admission_fee", "material_fee", "course_fee", "gst_percent")
    def _compute_totals(self):
        for rec in self:
            sub = rec.admission_fee + rec.material_fee + rec.course_fee
            gst = _r(sub * rec.gst_percent / 100.0)
            rec.subtotal = _r(sub)
            rec.gst_amount = gst
            rec.total_fee = _r(sub + gst)

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

    @api.constrains("admission_fee", "material_fee", "course_fee", "gst_percent", "onetime_discount_percent")
    def _check_values(self):
        for rec in self:
            if min(rec.admission_fee, rec.material_fee, rec.course_fee) < 0:
                raise ValidationError(self.env._("Fees cannot be negative."))
            if not 0 <= rec.gst_percent <= 100 or not 0 <= rec.onetime_discount_percent <= 100:
                raise ValidationError(self.env._("GST and discount percentages must be between 0 and 100."))

    def calculate(self, scholarship=None):
        """Return the full fee breakdown (plain dict, JSON safe) for this structure.

        Order: standard fee -> scholarship/discount (before GST) -> GST on discounted
        value -> one-time payment (extra % on Course Fee) on top of the scholarship.
        """
        self.ensure_one()
        admission, material, course = self.admission_fee, self.material_fee, self.course_fee
        subtotal = _r(admission + material + course)
        gst_pct = self.gst_percent

        standard_gst = _r(subtotal * gst_pct / 100.0)
        standard = {"gst": standard_gst, "total": _r(subtotal + standard_gst)}

        sch_info = None
        sch_discount = 0.0
        if scholarship:
            base = course if scholarship.apply_on == "course_fee" else subtotal
            sch_discount = min(_r(base * scholarship.percentage / 100.0), base)
            sch_info = {
                "id": scholarship.id,
                "name": scholarship.name,
                "kind": scholarship.kind,
                "percentage": scholarship.percentage,
                "apply_on": scholarship.apply_on,
                "discount": sch_discount,
            }
        taxable = _r(subtotal - sch_discount)
        gst = _r(taxable * gst_pct / 100.0)
        after_scholarship = {"taxable": taxable, "gst": gst, "total": _r(taxable + gst)}

        ot_pct = self.onetime_discount_percent
        ot_discount = min(_r(course * ot_pct / 100.0), taxable)
        ot_taxable = _r(taxable - ot_discount)
        ot_gst = _r(ot_taxable * gst_pct / 100.0)
        ot_total = _r(ot_taxable + ot_gst)
        one_time = {
            "percentage": ot_pct,
            "discount": ot_discount,
            "taxable": ot_taxable,
            "gst": ot_gst,
            "total": ot_total,
            "saving": _r(after_scholarship["total"] - ot_total),
        }

        return {
            "structure_id": self.id,
            "course": self.course_id.name,
            "course_type": self.course_type_id.name,
            "mode": self.mode,
            "fees": {
                "admission": _r(admission),
                "material": _r(material),
                "course": _r(course),
                "subtotal": subtotal,
            },
            "gst_percent": gst_pct,
            "standard": standard,
            "scholarship": sch_info,
            "after_scholarship": after_scholarship,
            "one_time": one_time,
        }
