from odoo import fields, models


class OtmFeeCourseType(models.Model):
    _name = "otm.fee.course.type"
    _description = "Fee Course Type"
    _order = "sequence, name"

    name = fields.Char(string="Course Type", required=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)

    _name_uniq = models.Constraint("unique(name)", "Course type name must be unique.")
