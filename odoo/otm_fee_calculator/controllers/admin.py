import logging

import psycopg2

from odoo import http
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.http import request

from .main import USER_GROUP, _body, _json, _to_int

_logger = logging.getLogger(__name__)

MANAGER_GROUP = "otm_fee_calculator.group_fee_manager"

MODELS = {
    "course": "otm.fee.course",
    "type": "otm.fee.course.type",
    "structure": "otm.fee.structure",
    "scholarship": "otm.fee.scholarship",
}

# field -> (kind, extra)   kinds: str int float bool m2o sel m2m
FIELDS = {
    "course": {"name": ("str", None), "sequence": ("int", None), "active": ("bool", None)},
    "type": {"name": ("str", None), "sequence": ("int", None), "active": ("bool", None)},
    "structure": {
        "course_id": ("m2o", "otm.fee.course"),
        "course_type_id": ("m2o", "otm.fee.course.type"),
        "mode": ("sel", ("offline", "online")),
        "admission_fee": ("float", None),
        "material_fee": ("float", None),
        "course_fee": ("float", None),
        "gst_percent": ("float", None),
        "onetime_discount_percent": ("float", None),
        "active": ("bool", None),
    },
    "scholarship": {
        "name": ("str", None),
        "kind": ("sel", ("scholarship", "discount")),
        "percentage": ("float", None),
        "apply_on": ("sel", ("course_fee", "subtotal")),
        "course_ids": ("m2m", "otm.fee.course"),
        "note": ("str", None),
        "sequence": ("int", None),
        "active": ("bool", None),
    },
}
REQUIRED = {
    "course": ("name",),
    "type": ("name",),
    "structure": ("course_id", "course_type_id", "mode"),
    "scholarship": ("name", "kind", "percentage", "apply_on"),
}


class FieldError(Exception):
    pass


def _coerce(label, kind, extra, value):
    if kind == "str":
        return str(value or "").strip()
    if kind == "bool":
        return bool(value)
    if kind == "int":
        try:
            return int(float(value or 0))
        except (TypeError, ValueError):
            raise FieldError("%s must be a whole number." % label)
    if kind == "float":
        try:
            number = float(value if value not in (None, "") else 0)
        except (TypeError, ValueError):
            raise FieldError("%s must be a number." % label)
        if number != number or number in (float("inf"), float("-inf")):
            raise FieldError("%s must be a number." % label)
        return number
    if kind == "sel":
        if value not in extra:
            raise FieldError("Select a valid %s." % label)
        return value
    if kind == "m2o":
        rid = _to_int(value)
        if not rid or not request.env[extra].with_context(active_test=False).browse(rid).exists():
            raise FieldError("Select a valid %s." % label)
        return rid
    if kind == "m2m":
        ids = [i for i in (_to_int(v) for v in (value or [])) if i]
        return [(6, 0, ids)]
    raise FieldError("Unsupported field %s." % label)


def _guard_manager():
    user = request.env.user
    if user._is_public():
        return _json({"ok": False, "code": "session", "error": "Session expired. Please sign in again."}, 401)
    if not user.has_group(USER_GROUP) or not user.has_group(MANAGER_GROUP):
        return _json({"ok": False, "code": "forbidden", "error": "Only the Fee Calculator admin can change fees."}, 403)
    return None


def _all(key):
    return request.env[MODELS[key]].with_context(active_test=False).search([])


class OtmFeeCalculatorAdminApi(http.Controller):

    @http.route("/otm_fee/api/admin/list", type="http", auth="public", methods=["POST"], csrf=False)
    def admin_list(self, **kw):
        err = _guard_manager()
        if err:
            return err
        return _json({
            "ok": True,
            "courses": [{"id": c.id, "name": c.name, "sequence": c.sequence, "active": c.active} for c in _all("course")],
            "types": [{"id": t.id, "name": t.name, "sequence": t.sequence, "active": t.active} for t in _all("type")],
            "structures": [
                {
                    "id": s.id, "course_id": s.course_id.id, "course": s.course_id.name,
                    "course_type_id": s.course_type_id.id, "course_type": s.course_type_id.name,
                    "mode": s.mode, "admission_fee": s.admission_fee, "material_fee": s.material_fee,
                    "course_fee": s.course_fee, "gst_percent": s.gst_percent,
                    "onetime_discount_percent": s.onetime_discount_percent,
                    "total": s.total_fee, "active": s.active,
                }
                for s in _all("structure")
            ],
            "scholarships": [
                {
                    "id": s.id, "name": s.name, "kind": s.kind, "percentage": s.percentage,
                    "apply_on": s.apply_on, "course_ids": s.course_ids.ids, "note": s.note or "",
                    "sequence": s.sequence, "active": s.active,
                }
                for s in _all("scholarship")
            ],
        })

    @http.route("/otm_fee/api/admin/save", type="http", auth="public", methods=["POST"], csrf=False)
    def admin_save(self, **kw):
        err = _guard_manager()
        if err:
            return err
        data = _body()
        key = data.get("model")
        values = data.get("values")
        if key not in MODELS or not isinstance(values, dict):
            return _json({"ok": False, "error": "Invalid request."}, 400)
        record_id = _to_int(data.get("id"))
        spec = FIELDS[key]
        env = request.env
        vals = {}
        try:
            for fname, (kind, extra) in spec.items():
                if fname in values:
                    vals[fname] = _coerce(fname.replace("_", " ").replace(" id", "").title(), kind, extra, values[fname])
            if not record_id:
                for fname in REQUIRED[key]:
                    if fname not in vals or vals[fname] in ("", False, None):
                        raise FieldError("%s is required." % fname.replace("_", " ").replace(" id", "").title())
            model = env[MODELS[key]].with_context(active_test=False)
            with env.cr.savepoint():
                if record_id:
                    rec = model.browse(record_id)
                    if not rec.exists():
                        return _json({"ok": False, "error": "Record not found."}, 404)
                    rec.write(vals)
                else:
                    rec = model.create(vals)
                env.flush_all()  # run SQL constraints inside the savepoint
        except FieldError as exc:
            return _json({"ok": False, "error": str(exc)}, 400)
        except (ValidationError, UserError) as exc:
            return _json({"ok": False, "error": exc.args[0] if exc.args else "Could not save."}, 400)
        except AccessError:
            return _json({"ok": False, "error": "You are not allowed to change this."}, 403)
        except psycopg2.IntegrityError as exc:
            _logger.info("Fee admin save integrity error: %s", exc)
            return _json({"ok": False, "error": "This entry already exists (duplicate), or it is still in use."}, 400)
        return _json({"ok": True, "id": rec.id})
