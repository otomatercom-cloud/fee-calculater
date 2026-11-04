{
    "name": "Otomater Fee Calculator",
    "version": "19.0.1.0.0",
    "summary": "Course fee calculator - admission, material, course fee, GST, scholarship and one-time payment",
    "description": "Master data (courses, course types, fee structures, scholarships) plus a JSON API "
                   "used by the Next.js Fee Calculator frontend.",
    "author": "Otomater",
    "website": "https://otomater.com",
    "category": "Customizations",
    "license": "OPL-1",
    "depends": ["base"],
    "data": [
        "security/security.xml",
        "security/ir.model.access.csv",
        "views/course_type_views.xml",
        "views/course_views.xml",
        "views/fee_structure_views.xml",
        "views/scholarship_views.xml",
        "views/menus.xml",
    ],
    "demo": ["data/demo_data.xml"],
    "installable": True,
    "application": True,
}
