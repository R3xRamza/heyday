/** Stages that belong in Vendors hub / trash — never in CRM Contacts list. */
export function isExcludedCrmStage(stage) {
  const s = String(stage || '').trim().toLowerCase();
  return s === 'vendors' || s === 'trash';
}

/** SQL fragment for contacts list queries (alias `c`). */
export const CRM_LIST_STAGE_SQL = `(c.stage IS NULL OR LOWER(TRIM(c.stage)) NOT IN ('vendors', 'trash'))`;
