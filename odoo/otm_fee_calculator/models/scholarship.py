from odoo import api, fields, models
from odoo.exceptions import ValidationError


class OtmFeeScholarship(models.Model):
    _name = "otm.fee.scholarship"
    _description = "Fee Scholarship / Discount"
    _order = "sequence, name"

    name = fields.Char(string="Scholarship / Discount Name", required=True)
    kind = fields.Selection(
        [("scholarship", "Scholarship"), ("discount", "Discount")],
        string="Category",
        required=True,
        default="scholarship",
    )
    percentage = fields.Float(string="Percentage (%)", required=True, digits=(5, 2))
    apply_on = fields.Selection(
        [
            ("course_fee", "Course Fee (Amount) only"),
            ("subtotal", "Admission + Material + Course Fee"),
        ],
        string="Applies On",
        required=True,
        default="course_fee",
    )
    course_ids = fields.Many2many(
        "otm.fee.course",
        "otm_fee_scholarship_course_rel",
        "scholarship_id",
        "course_id",
        string="Limited To Courses",
        help="Leave empty to make this scholarship / discount available for every course.",
    )
    note = fields.Text(string="Terms")
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)

    _name_uniq = models.Constraint("unique(name)", "Scholarship / discount name must be unique.")

    @api.constrains("percentage")
    def _check_percentage(self):
        for rec in self:
            if rec.percentage < 0 or rec.percentage > 100:
                raise ValidationError(self.env._("Percentage must be between 0 and 100."))
