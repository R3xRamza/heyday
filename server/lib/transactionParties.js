import { normalizeRepresenting } from './transactionValidation.js';

/** Team / vendor roles shown on every transaction */
export const PARTY_ROLES = [
  { key: 'listing_agent', label: 'listing agent', isTeam: true, email: 'meredith@theheydaygroup.com' },
  { key: 'office_administrator', label: 'office administrator', isTeam: true, email: 'tessa@theheydaygroup.com' },
  { key: 'transaction_coordinator', label: 'transaction coordinator', isTeam: true, email: 'adam@theheydaygroup.com' },
  { key: 'escrow_officer', label: 'escrow officer', isTeam: false },
];

const COUNTERPARTY_LABELS = {
  seller: 'seller',
  buyer: 'buyer',
  landlord: 'landlord',
  tenant: 'tenant',
};

/** External counterparty row(s) for a representing type */
export function counterpartyRoleDefs(representing) {
  const r = normalizeRepresenting(representing);
  if (r === 'seller_and_buyer') {
    return [
      { role: 'seller', label: 'seller' },
      { role: 'buyer', label: 'buyer' },
    ];
  }
  const label = COUNTERPARTY_LABELS[r] || 'seller';
  return [{ role: 'counterparty', label }];
}

export function isCounterpartyRole(role) {
  return role === 'counterparty' || role === 'seller' || role === 'buyer';
}

export const TEAM_DISPLAY_NAMES = {
  'meredith@theheydaygroup.com': 'Meredith Alderson',
  'tessa@theheydaygroup.com': 'Tessa Osborn',
  'adam@theheydaygroup.com': 'Adam Walding',
  'margaret@theheydaygroup.com': 'Margaret Analyst',
};

function externalNameFromTransaction(transaction) {
  return (transaction.client_name || transaction.owner_name || '').trim();
}

function buildTeamPartyRows(db) {
  const team = db.prepare("SELECT id, email, name FROM users WHERE email != 'admin@theheydaygroup.com'").all();
  const byEmail = Object.fromEntries(team.map((u) => [u.email, u]));

  return PARTY_ROLES.map((role, i) => {
    const user = role.email ? byEmail[role.email] : null;
    const defaultName = user ? (TEAM_DISPLAY_NAMES[user.email] || user.name) : '';
    return {
      role: role.key,
      name: defaultName,
      user_id: user?.id ?? null,
      sort_order: i,
    };
  });
}

function buildCounterpartyRows(transaction, existingParties = []) {
  const defs = counterpartyRoleDefs(transaction.representing);
  const fallback = externalNameFromTransaction(transaction);

  const findName = (role) => {
    const row = existingParties.find((p) => p.role === role);
    if (row?.name?.trim()) return row.name.trim();
    if (role === 'counterparty' || role === 'seller') {
      const legacy = existingParties.find((p) => p.role === 'counterparty' || p.role === 'seller');
      if (legacy?.name?.trim()) return legacy.name.trim();
    }
    return role === 'buyer' ? '' : fallback;
  };

  return defs.map((def, i) => ({
    role: def.role,
    name: findName(def.role),
    user_id: null,
    sort_order: PARTY_ROLES.length + i,
  }));
}

export function buildDefaultParties(db, transaction) {
  return [...buildTeamPartyRows(db), ...buildCounterpartyRows(transaction)];
}

function enrichPartyRow(row, transaction) {
  const teamDef = PARTY_ROLES.find((pr) => pr.key === row.role);
  if (teamDef) {
    return { ...row, label: teamDef.label, is_team: true };
  }

  const r = normalizeRepresenting(transaction.representing);
  const defs = counterpartyRoleDefs(transaction.representing);

  if (r === 'seller_and_buyer') {
    const def = defs.find((d) => d.role === row.role);
    if (def) return { ...row, label: def.label, is_team: false };
  }

  if (row.role === 'counterparty' || row.role === 'seller' || row.role === 'buyer') {
    const label = row.role === 'buyer' && r === 'seller_and_buyer'
      ? 'buyer'
      : defs[0]?.label || COUNTERPARTY_LABELS[r] || 'seller';
    return { ...row, label, is_team: false };
  }

  return { ...row, label: row.role, is_team: false };
}

export function getPartiesForTransaction(db, transactionId) {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!tx) return [];

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
    rows = db.prepare('SELECT * FROM transaction_parties WHERE transaction_id = ? ORDER BY sort_order, id').all(transactionId);
  }

  return rows.map((r) => enrichPartyRow(r, tx));
}

function syncTransactionClientName(db, transactionId, parties, representing) {
  const r = normalizeRepresenting(representing);
  let externalName = null;

  if (r === 'seller_and_buyer') {
    const seller = parties.find((p) => p.role === 'seller');
    const buyer = parties.find((p) => p.role === 'buyer');
    const parts = [seller?.name?.trim(), buyer?.name?.trim()].filter(Boolean);
    externalName = parts.length ? parts.join(' / ') : null;
  } else {
    const cp = parties.find((p) => p.role === 'counterparty' || p.role === 'seller');
    externalName = cp?.name?.trim() || null;
  }

  db.prepare('UPDATE transactions SET client_name = ?, owner_name = ? WHERE id = ?').run(
    externalName,
    externalName,
    transactionId,
  );
}

export function reshapePartiesForRepresenting(db, transactionId) {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!tx) return null;

  const existing = db.prepare(
    'SELECT * FROM transaction_parties WHERE transaction_id = ? ORDER BY sort_order, id',
  ).all(transactionId);

  const teamRows = existing.filter((p) => PARTY_ROLES.some((r) => r.key === p.role));
  const counterpartyRows = buildCounterpartyRows(tx, existing);
  const merged = [
    ...teamRows.map((p, i) => ({
      role: p.role,
      name: p.name,
      user_id: p.user_id,
      sort_order: i,
    })),
    ...counterpartyRows.map((p, i) => ({
      role: p.role,
      name: p.name,
      user_id: null,
      sort_order: PARTY_ROLES.length + i,
    })),
  ];

  return saveParties(db, transactionId, merged);
}

export function saveParties(db, transactionId, parties) {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!tx) return null;

  const del = db.prepare('DELETE FROM transaction_parties WHERE transaction_id = ?');
  const insert = db.prepare(`
    INSERT INTO transaction_parties (transaction_id, role, name, user_id, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    del.run(transactionId);
    parties.forEach((p, i) => {
      insert.run(transactionId, p.role, p.name?.trim() || '', p.user_id || null, i);
    });
  })();

  syncTransactionClientName(db, transactionId, parties, tx.representing);

  return getPartiesForTransaction(db, transactionId);
}

/** Update counterparty name(s) when transaction client_name / owner_name changes */
export function syncCounterpartyNamesFromTransaction(db, transactionId, externalName) {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!tx || !externalName) return;

  const r = normalizeRepresenting(tx.representing);
  if (r === 'seller_and_buyer') {
    const first = String(externalName).split('/')[0]?.trim();
    if (first) {
      db.prepare(`
        UPDATE transaction_parties SET name = ? WHERE transaction_id = ? AND role = 'seller'
      `).run(first, transactionId);
    }
    return;
  }

  db.prepare(`
    UPDATE transaction_parties SET name = ? WHERE transaction_id = ? AND role IN ('counterparty', 'seller')
  `).run(externalName, transactionId);
}
