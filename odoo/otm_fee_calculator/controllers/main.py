import json
import logging

from odoo import http
from odoo.exceptions import AccessDenied
from odoo.http import request, root

_logger = logging.getLogger(__name__)

USER_GROUP = "otm_fee_calculator.group_fee_user"


def _to_int(value):
    """Browser values are often strings (select.value) - never trust the type."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return False


def _json(payload, status=200):
    return request.make_response(
        json.dumps(payload),
        headers=[("Content-Type", "application/json"), ("Cache-Control", "no-store")],
        status=status,
    )


def _body():
    try:
        data = json.loads(request.httprequest.get_data(as_text=True) or "{}")
        return data if isinstance(data, dict) else {}
    except ValueError:
        return {}


def _guard():
    """Returns an error response, or None when the caller is a signed-in fee user.

    Routes are auth='public' on purpose: auth='user' would answer an expired session
    with an HTML redirect, which a Next.js proxy cannot tell from a real response.
    """
    user = request.env.user
    if user._is_public():
        return _json({"ok": False, "code": "session", "error": "Session expired. Please sign in again."}, 401)
    if not user.has_group(USER_GROUP):
        return _json({"ok": False, "code": "forbidden", "error": "You do not have access to the Fee Calculator."}, 403)
    return None


class OtmFeeCalculatorApi(http.Controller):

    @http.route("/otm_fee/api/login", type="http", auth="public", methods=["POST"], csrf=False)
    def login(self, **kw):
        data = _body()
        login = (data.get("login") or "").strip()
        password = data.get("password") or ""
        if not login or not password:
            return _json({"ok": False, "error": "Enter your login and password."}, 400)
        try:
            request.session.authenticate(request.env, {"type": "password", "login": login, "password": password})
        except AccessDenied:
            return _json({"ok": False, "error": "Wrong login or password."}, 401)
        except Exception:  # noqa: BLE001 - never leak internals to the login form
            _logger.exception("Fee calculator login failed")
            return _json({"ok": False, "error": "Could not sign in. Please try again."}, 500)
        uid = request.session.uid
        if not uid:
            return _json({"ok": False, "error": "Wrong login or password."}, 401)
        user = request.env["res.users"].sudo().browse(uid)
        if not user.has_group(USER_GROUP):
            return _json({"ok": False, "error": "This user has no Fee Calculator access."}, 403)
        # Odoo rotates the sid AFTER the controller returns - rotate now so the sid we hand
        # to the Next.js server is the real, final one.
        if request.session.should_rotate:
            root.session_store.rotate(request.session, request.env)
        return _json({"ok": True, "session_id": request.session.sid, "name": user.name})

    @http.route("/otm_fee/api/me", type="http", auth="public", methods=["POST"], csrf=False)
    def me(self, **kw):
        err = _guard()
        if err:
            return err
        user = request.env.user
        return _json({
            "ok": True,
            "name": user.name,
            "is_manager": user.has_group("otm_fee_calculator.group_fee_manager"),
        })

    @http.route("/otm_fee/api/options", type="http", auth="public", methods=["POST"], csrf=False)
    def options(self, **kw):
        err = _guard()
        if err:
            return err
        structures = request.env["otm.fee.structure"].search([])
        courses = {}
        for s in structures:
            course = courses.setdefault(s.course_id.id, {"id": s.course_id.id, "name": s.course_id.name, "types": {}})
            ctype = course["types"].setdefault(
                s.course_type_id.id, {"id": s.course_type_id.id, "name": s.course_type_id.name, "modes": []}
            )
            ctype["modes"].append(s.mode)
        course_list = []
        for course in sorted(courses.values(), key=lambda c: c["name"].lower()):
            course["types"] = sorted(course["types"].values(), key=lambda t: t["name"].lower())
            course_list.append(course)
        return _json({"ok": True, "courses": course_list})

    @http.route("/otm_fee/api/calculate", type="http", auth="public", methods=["POST"], csrf=False)
    def calculate(self, **kw):
        err = _guard()
        if err:
            return err
        data = _body()
        course_id = _to_int(data.get("course_id"))
        type_id = _to_int(data.get("course_type_id"))
        mode = data.get("mode")
        if not (course_id and type_id and mode in ("offline", "online")):
            return _json({"ok": False, "error": "Select course, course type and mode."}, 400)
        structure = request.env["otm.fee.structure"].search(
            [("course_id", "=", course_id), ("course_type_id", "=", type_id), ("mode", "=", mode)], limit=1
        )
        if not structure:
            return _json({"ok": False, "error": "No fee structure is set for this selection."}, 404)
        return _json({"ok": True, "result": structure.calculate()})

    @http.route("/otm_fee/api/chart", type="http", auth="public", methods=["POST"], csrf=False)
    def chart(self, **kw):
        err = _guard()
        if err:
            return err
        rows = []
        for s in request.env["otm.fee.structure"].search([]):
            c = s.calculate()
            rows.append({
                "id": s.id,
                "course": c["course"],
                "course_type": c["course_type"],
                "mode": c["mode"],
                "admission": c["admission"]["total"],
                "course_fee": c["course_fee"]["amount"],
                "course_incl": c["course_fee"]["total"],
                "addon": c["addon"]["total"],
                "material": c["material"]["total"],
                "total_with_addon": c["total_with_addon"],
                "discount_type": c["discount"]["type"],
                "discount_percent": c["discount"]["percentage"],
                "discount_amount": c["discount"]["amount"],
                "discounted_fee": c["discount"]["discounted_fee"],
                "final": c["final"],
                "one_time_percent": c["one_time"]["percentage"],
                "one_time_final": c["one_time"]["final"],
            })
        return _json({"ok": True, "rows": rows})
