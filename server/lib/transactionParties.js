import {
  fixedRolesForSaleType,
  normalizePartyRole,
  normalizeSaleType,
  labelForPartyRole,
  isCustomPartyRole,
  customRoleLabel,
  SALE_TYPE_RENT_LEASE,
  validateParties,
} from './partyRoles.js';

export {
  validateParties,
  requiredPartyRoles,
  normalizePartyRole,
  normalizeSaleType,
  isTraditionalSale,
  labelForPartyRole,
  fixedRolesForSaleType,
  customRoleKey,
  isCustomPartyRole,
} from './partyRoles.js';

/** @deprecated — use fixedRolesForSaleType; kept for any leftover imports */
export const PARTY_ROLES = [
  { key: 'agent', label: 'Agent', isTeam: true },
  { key: 'escrow_officer', label: 'Title', isTeam: false },
  { key: 'cooperating_agent', label: 'Cooperating Agent', isTeam: false },
  { key: 'client', label: 'Client', isTeam: false },
  { key: 'lender', label: 'Lender', isTeam: false },
];

export function isCounterpartyRole(role) {
  const n = normalizePartyRole(role);
  return n === 'client' || role === 'counterparty' || role === 'seller' || role === 'buyer';
}

export const TEAM_DISPLAY_NAMES = {
  'meredith@theheydaygroup.com': 'Meredith Alderson',
  'tessa@theheydaygroup.com': 'Tessa Osborn',
  'adam@theheydaygroup.com': 'Adam Walding',
  'margaret@theheydaygroup.com': 'Margaret Analyst',
};

function agentDisplayName(db, transaction) {
  if (!transaction?.agent_id) return '';
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(transaction.agent_id);
  if (!user) return '';
  return TEAM_DISPLAY_NAMES[user.email] || user.name || '';
}

function externalNameFromTransaction(transaction) {
  return (transaction.client_name || transaction.owner_name || '').trim();
}

/** One-time role key cleanup for a transaction's party rows. */
export function migrateLegacyPartyRoles(db, transactionId) {
  const rows = db.prepare(
    'SELECT * FROM transaction_parties WHERE transaction_id = ? ORDER BY sort_order, id',
  ).all(transactionId);

  const byRole = Object.fromEntries(rows.map((r) => [r.role, r]));
  const updates = [];

  const ensureCanonical = (legacyRoles, canonical) => {
    const existingCanonical = byRole[canonical];
    for (const legacy of legacyRoles) {
      const row = byRole[legacy];
      if (!row) continue;
      if (!existingCanonical) {
        updates.push({ type: 'rename', id: row.id, role: canonical, name: row.name, user_id: row.user_id });
        byRole[canonical] = { ...row, role: canonical };
        delete byRole[legacy];
      } else {
        if (!String(existingCanonical.name || '').trim() && String(row.name || '').trim()) {
          updates.push({ type: 'patch_name', id: existingCanonical.id, name: row.name });
          existingCanonical.name = row.name;
        }
        updates.push({ type: 'delete', id: row.id });
        delete byRole[legacy];
      }
    }
  };

  ensureCanonical(['listing_agent'], 'agent');
  ensureCanonical(['counterparty', 'seller', 'buyer'], 'client');

  if (updates.length === 0) return;

  const rename = db.prepare('UPDATE transaction_parties SET role = ? WHERE id = ?');
  const patchName = db.prepare('UPDATE transaction_parties SET name = ? WHERE id = ?');
  const del = db.prepare('DELETE FROM transaction_parties WHERE id = ?');

  db.transaction(() => {
    for (const u of updates) {
      if (u.type === 'rename') rename.run(u.role, u.id);
      else if (u.type === 'patch_name') patchName.run(u.name, u.id);
      else if (u.type === 'delete') del.run(u.id);
    }
  })();
}

function buildDefaultParties(db, transaction) {
  const fixed = fixedRolesForSaleType(transaction.sale_type, transaction.representing);
  const agentName = agentDisplayName(db, transaction);
  const clientName = externalNameFromTransaction(transaction);

  return fixed.map((def, i) => {
    let name = '';
    let user_id = null;
    if (def.role === 'agent') {
      name = agentName;
      user_id = transaction.agent_id ?? null;
    }
    if (def.role === 'client') {
      name = clientName;
    }
    return {
      role: def.role,
      name,
      user_id,
      sort_order: i,
    };
  });
}

function enrichPartyRow(row, transaction, db) {
  const role = row.role;
  const normalized = normalizePartyRole(role);
  const fixed = fixedRolesForSaleType(transaction.sale_type, transaction.representing);
  const fixedDef = fixed.find((d) => d.role === normalized);
  const saleType = normalizeSaleType(transaction.sale_type, transaction.representing);

  let name = row.name || '';
  let user_id = row.user_id;
  if (normalized === 'agent') {
    name = agentDisplayName(db, transaction) || name;
    user_id = transaction.agent_id ?? user_id;
  }

  const isFixedVisible = Boolean(fixedDef);
  const isHiddenTraditionalOnRent = saleType === SALE_TYPE_RENT_LEASE
    && ['escrow_officer', 'cooperating_agent', 'lender'].includes(normalized);

  return {
    ...row,
    role,
    name,
    user_id,
    label: fixedDef?.label || labelForPartyRole(role),
    is_team: normalized === 'agent' || Boolean(fixedDef?.isTeam),
    is_fixed: isFixedVisible,
    hidden: isHiddenTraditionalOnRent,
  };
}

/**
 * Ordered parties for UI: visible fixed slots for sale type, then extras.
 * Seeds defaults when the transaction has no party rows.
 */
export function getPartiesForTransaction(db, transactionId) {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!tx) return [];

  migrateLegacyPartyRoles(db, transactionId);

  let rows = db.prepare(`
    SELECT * FROM transaction_parties WHERE transaction_id = ? ORDER BY sort_order, id
  `).all(transactionId);

  if (rows.length === 0) {
    const defaults = buildDefaultParties(db, tx);
    const insert = db.prepare(`
      INSERT INTO transaction_parties (transaction_id, role, name, user_id, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
      defaults.forEach((p) => {
        insert.run(transactionId, p.role, p.name, p.user_id, p.sort_order);
      });
    })();
    rows = db.prepare(
      'SELECT * FROM transaction_parties WHERE transaction_id = ? ORDER BY sort_order, id',
    ).all(transactionId);
  }

  // Ensure fixed slots exist (don't wipe extras)
  const fixed = fixedRolesForSaleType(tx.sale_type, tx.representing);
  const byNorm = {};
  for (const r of rows) {
    byNorm[normalizePartyRole(r.role)] = r;
  }
  const insertMissing = db.prepare(`
    INSERT OR IGNORE INTO transaction_parties (transaction_id, role, name, user_id, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);
  let added = false;
  fixed.forEach((def, i) => {
    if (!byNorm[def.role]) {
      let name = '';
      let user_id = null;
      if (def.role === 'agent') {
        name = agentDisplayName(db, tx);
        user_id = tx.agent_id ?? null;
      }
      if (def.role === 'client') name = externalNameFromTransaction(tx);
      insertMissing.run(transactionId, def.role, name, user_id, i);
      added = true;
    }
  });
  if (added) {
    rows = db.prepare(
      'SELECT * FROM transaction_parties WHERE transaction_id = ? ORDER BY sort_order, id',
    ).all(transactionId);
  }

  // Sync agent name from agent_id
  const agentName = agentDisplayName(db, tx);
  if (tx.agent_id && agentName) {
    db.prepare(`
      UPDATE transaction_parties SET name = ?, user_id = ? WHERE transaction_id = ? AND role = 'agent'
    `).run(agentName, tx.agent_id, transactionId);
    rows = db.prepare(
      'SELECT * FROM transaction_parties WHERE transaction_id = ? ORDER BY sort_order, id',
    ).all(transactionId);
  }

  const enriched = rows.map((r) => enrichPartyRow(r, tx, db));
  const fixedKeys = new Set(fixed.map((d) => d.role));

  const fixedRows = fixed.map((def, i) => {
    const row = enriched.find((p) => normalizePartyRole(p.role) === def.role)
      || {
        role: def.role,
        name: def.role === 'agent' ? agentName : (def.role === 'client' ? externalNameFromTransaction(tx) : ''),
        user_id: def.role === 'agent' ? tx.agent_id : null,
        label: def.label,
        is_team: def.isTeam,
        is_fixed: true,
        sort_order: i,
      };
    return {
      ...row,
      role: def.role,
      label: def.label,
      is_team: Boolean(def.isTeam),
      is_fixed: true,
      sort_order: i,
      hidden: false,
    };
  });

  const extras = enriched
    .filter((p) => {
      const n = normalizePartyRole(p.role);
      if (fixedKeys.has(n)) return false;
      if (p.hidden) return false;
      return true;
    })
    .map((p, i) => ({
      ...p,
      is_fixed: false,
      sort_order: fixedRows.length + i,
      label: isCustomPartyRole(p.role) ? customRoleLabel(p.role) : labelForPartyRole(p.role),
    }));

  return [...fixedRows, ...extras];
}

function syncTransactionClientName(db, transactionId, parties) {
  const cp = (parties || []).find((p) => normalizePartyRole(p.role) === 'client');
  const externalName = cp?.name?.trim() || null;
  db.prepare('UPDATE transactions SET client_name = ?, owner_name = ? WHERE id = ?').run(
    externalName,
    externalName,
    transactionId,
  );
}

/** Keep extras; ensure fixed slots for current sale type. */
export function reshapePartiesForRepresenting(db, transactionId) {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!tx) return null;

  const existing = db.prepare(
    'SELECT * FROM transaction_parties WHERE transaction_id = ? ORDER BY sort_order, id',
  ).all(transactionId);

  const fixed = fixedRolesForSaleType(tx.sale_type, tx.representing);
  const byNorm = {};
  for (const p of existing) {
    byNorm[normalizePartyRole(p.role)] = p;
  }

  const merged = [];
  fixed.forEach((def, i) => {
    const prev = byNorm[def.role];
    let name = prev?.name || '';
    let user_id = prev?.user_id || null;
    if (def.role === 'agent') {
      name = agentDisplayName(db, tx) || name;
      user_id = tx.agent_id ?? user_id;
    }
    if (def.role === 'client' && !String(name).trim()) {
      name = externalNameFromTransaction(tx);
    }
    merged.push({ role: def.role, name, user_id, sort_order: i });
    delete byNorm[def.role];
  });

  // Preserve remaining (including traditional slots hidden on rent, customs, OA/TC)
  Object.values(byNorm).forEach((p, i) => {
    merged.push({
      role: p.role,
      name: p.name,
      user_id: p.user_id,
      sort_order: fixed.length + i,
    });
  });

  return saveParties(db, transactionId, merged, { skipValidation: true });
}

/**
 * @param {{ skipValidation?: boolean }} [opts]
 */
export function saveParties(db, transactionId, parties, opts = {}) {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!tx) return null;

  // Normalize roles on write
  let nextAgentId = tx.agent_id;
  const normalized = (parties || []).map((p, i) => {
    let role = p.role;
    if (role === 'listing_agent') role = 'agent';
    if (role === 'counterparty' || role === 'seller' || role === 'buyer') role = 'client';
    let name = p.name?.trim() || '';
    let user_id = p.user_id || null;
    if (normalizePartyRole(role) === 'agent') {
      if (p.user_id != null && p.user_id !== '') {
        user_id = Number(p.user_id);
        const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(user_id);
        if (user) {
          name = TEAM_DISPLAY_NAMES[user.email] || user.name || name;
          nextAgentId = user.id;
        }
      } else {
        name = agentDisplayName(db, tx) || name;
        user_id = tx.agent_id ?? null;
      }
    }
    return { role, name, user_id, sort_order: i };
  });

  // Dedupe by role (UNIQUE constraint)
  const seen = new Set();
  const deduped = [];
  for (const p of normalized) {
    if (seen.has(p.role)) continue;
    seen.add(p.role);
    deduped.push(p);
  }

  if (!opts.skipValidation) {
    const intent = (tx.close_date || tx.stage === 'pending') ? 'pending' : (tx.workflow_status === 'active' ? 'active' : null);
    if (intent) {
      const v = validateParties(deduped, tx.sale_type, tx.representing, intent);
      if (!v.ok) {
        const err = new Error(v.message);
        err.status = 400;
        err.missing = v.missing;
        throw err;
      }
    }
  }

  const del = db.prepare('DELETE FROM transaction_parties WHERE transaction_id = ?');
  const insert = db.prepare(`
    INSERT INTO transaction_parties (transaction_id, role, name, user_id, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    del.run(transactionId);
    deduped.forEach((p, i) => {
      insert.run(transactionId, p.role, p.name, p.user_id, i);
    });
    if (nextAgentId != null && Number(nextAgentId) !== Number(tx.agent_id)) {
      db.prepare('UPDATE transactions SET agent_id = ? WHERE id = ?').run(nextAgentId, transactionId);
    }
  })();

  syncTransactionClientName(db, transactionId, deduped);

  return getPartiesForTransaction(db, transactionId);
}

/** Update client party name when transaction client_name / owner_name changes */
export function syncCounterpartyNamesFromTransaction(db, transactionId, externalName) {
  if (!externalName) return;
  migrateLegacyPartyRoles(db, transactionId);
  const existing = db.prepare(
    "SELECT id FROM transaction_parties WHERE transaction_id = ? AND role = 'client'",
  ).get(transactionId);
  if (existing) {
    db.prepare('UPDATE transaction_parties SET name = ? WHERE id = ?').run(externalName, existing.id);
  } else {
    db.prepare(`
      INSERT INTO transaction_parties (transaction_id, role, name, user_id, sort_order)
      VALUES (?, 'client', ?, NULL, 3)
    `).run(transactionId, externalName);
  }
}

export function assertPartiesForIntent(db, transactionId, intent) {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!tx) return { ok: false, message: 'Not found' };
  const parties = getPartiesForTransaction(db, transactionId);
  return validateParties(parties, tx.sale_type, tx.representing, intent);
}
