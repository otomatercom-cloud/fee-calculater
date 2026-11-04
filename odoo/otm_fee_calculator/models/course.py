from odoo import api, fields, models


class OtmFeeCourse(models.Model):
    _name = "otm.fee.course"
    _description = "Fee Course"
    _order = "sequence, name"

    name = fields.Char(string="Course Name", required=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    structure_ids = fields.One2many("otm.fee.structure", "course_id", string="Fee Structure Lines")
    extra_ids = fields.One2many("otm.fee.extra", "course_id", string="Exam / Registration Fee Lines")
    structure_count = fields.Integer(string="Structures", compute="_compute_structure_count")

    _name_uniq = models.Constraint("unique(name)", "Course name must be unique.")

    @api.depends("structure_ids")
    def _compute_structure_count(self):
        for rec in self:
            rec.structure_count = len(rec.structure_ids)
