def migrate(cr, version):
    """Old material_fee held the sheet's add-on fee: move it to addon_fee.
    material_fee is then created fresh (0) by the ORM."""
    cr.execute("""SELECT column_name FROM information_schema.columns
                  WHERE table_name = 'otm_fee_structure'
                    AND column_name IN ('material_fee', 'addon_fee')""")
    cols = {r[0] for r in cr.fetchall()}
    if "material_fee" in cols and "addon_fee" not in cols:
        cr.execute("ALTER TABLE otm_fee_structure RENAME COLUMN material_fee TO addon_fee")
