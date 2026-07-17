/** Server-side canonical buyer status / preapproval mapping (mirrors client utils). */

const CANONICAL_STATUS = new Set(['active', 'under_contract', 'option_period', 'closed', 'on_hold']);
const CANONICAL_PRE = new Set(['y', 'n', 'cash']);

export function normalizeBuyerStatus(raw) {
  if (raw == null || raw === '') return 'active';
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  if (CANONICAL_STATUS.has(lower)) return lower;
  if (lower.includes('under contract')) return 'under_contract';
  if (lower.includes('leaseback')) return 'under_contract';
  if (lower.includes('option')) return 'option_period';
  if (/\bclosed\b/.test(lower) || lower === 'close') return 'closed';
  if (lower.includes('on hold') || lower.includes('paused') || lower.includes('unresponsive')) {
    return 'on_hold';
  }
  if (/(^|\s)hold(\s|$)/.test(lower)) return 'on_hold';
  if (lower.includes('tour')) return 'option_period';
  if (lower.includes('active')) return 'active';
  return 'active';
}

export function normalizePreapproval(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  if (CANONICAL_PRE.has(lower)) return lower;
  if (lower.includes('cash')) return 'cash';
  if (/^(y|yes)\b/.test(lower) || lower === 'y' || lower.startsWith('yes')) return 'y';
  if (/^(n|no)\b/.test(lower) || lower === 'n' || lower === 'x' || lower.includes('not yet') || lower.startsWith('no')) {
    return 'n';
  }
  return null;
}

/** One-time-ish: rewrite freeform status/preapproval to canonical values. */
export function normalizeBuyerOpportunityRows(db) {
  const rows = db.prepare('SELECT id, status, preapproval FROM opportunity_buyers').all();
  const update = db.prepare(
    'UPDATE opportunity_buyers SET status = ?, preapproval = ? WHERE id = ?',
  );
  let n = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const status = normalizeBuyerStatus(row.status);
      const mappedPre = normalizePreapproval(row.preapproval);
      const preapproval = mappedPre != null
        ? mappedPre
        : (row.preapproval == null || String(row.preapproval).trim() === '' ? null : row.preapproval);
      // Only write when status changes, or preapproval maps to canonical
      const statusChanged = status !== row.status;
      const preChanged = mappedPre != null && mappedPre !== row.preapproval;
      if (statusChanged || preChanged) {
        update.run(
          status,
          preChanged ? mappedPre : row.preapproval,
          row.id,
        );
        n += 1;
      }
    }
  });
  tx();
  if (n > 0) {
    console.log(`[opportunities] Normalized ${n} buyer status/preapproval row(s)`);
  }
}
