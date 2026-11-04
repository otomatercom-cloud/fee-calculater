{
    "name": "Otomater Fee Calculator",
    "version": "19.0.1.0.0",
    "summary": "Course fee calculator - admission, add-on, course fee, GST, scholarship and lump sum payment",
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
        "data/fee_data_2026.xml",
        "views/course_type_views.xml",
        "views/course_views.xml",
        "views/fee_structure_views.xml",
        "views/menus.xml",
    ],
    "installable": True,
    "application": True,
}
