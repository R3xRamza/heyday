/** Escape a single CSV cell (RFC 4180). */
export function csvEscape(value) {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '';
    return String(value);
  }
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Convert an array of row objects to CSV text.
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} [columns] column order; defaults to keys of first row
 */
export function rowsToCsv(rows, columns) {
  const cols = columns?.length
    ? columns
    : (rows[0] ? Object.keys(rows[0]) : []);
  const header = cols.map(csvEscape).join(',');
  if (!rows.length) return `${header}\n`;
  const lines = rows.map((row) => cols.map((c) => csvEscape(row[c])).join(','));
  return `${header}\n${lines.join('\n')}\n`;
}
