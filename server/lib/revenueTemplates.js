import {
  COMMISSION_SETTINGS,
  DEFAULT_FEE_LINES,
  normalizeCommissionSettings,
  round2,
} from './commissionPlans.js';

export const SEEDED_AGENT_KEYS = ['meredith', 'tessa', 'margaret', 'adam'];

export const TEMPLATE_AGENT_KEYS = SEEDED_AGENT_KEYS; // back-compat export

export const TEMPLATE_AGENT_LABELS = {
  meredith: 'Meredith',
  tessa: 'Tessa',
  margaret: 'Margaret',
  adam: 'Adam',
};

const EMAIL_TO_KEY = {
  'meredith@theheydaygroup.com': 'meredith',
  'tessa@theheydaygroup.com': 'tessa',
  'margaret@theheydaygroup.com': 'margaret',
  'adam@theheydaygroup.com': 'adam',
};

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Same eXp fees as Meredith; empty team splits for non-Meredith. */
export function defaultTemplateSettings(agentKey) {
  const base = {
    capAmount: COMMISSION_SETTINGS.capAmount,
    splitRate: COMMISSION_SETTINGS.splitRate,
    feeLines: DEFAULT_FEE_LINES.map((f) => ({ ...f })),
    teamSplits: [],
  };
  if (agentKey === 'meredith') {
    return normalizeCommissionSettings({
      ...base,
      teamSplits: COMMISSION_SETTINGS.teamSplits.map((s) => ({ ...s })),
    });
  }
  return normalizeCommissionSettings(base);
}

export function normalizeTemplateSettings(raw = {}) {
  return normalizeCommissionSettings(raw);
}

export function agentKeyFromEmail(email) {
  if (!email) return null;
  return EMAIL_TO_KEY[String(email).toLowerCase()] ?? null;
}

export function agentKeyFromUserId(db, userId) {
  if (userId == null || userId === '') return null;
  const id = Number(userId);
  const row = db.prepare('SELECT email FROM users WHERE id = ?').get(id);
  const fromEmail = agentKeyFromEmail(row?.email);
  if (fromEmail) return fromEmail;
  const byUser = db.prepare(
    'SELECT agent_key FROM revenue_split_templates WHERE user_id = ?',
  ).get(id);
  return byUser?.agent_key || null;
}

export function slugifyAgentKey(label) {
  const base = String(label || 'agent')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'agent';
  return base;
}

export function migrateRevenueSplitTemplates(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS revenue_split_templates (
      agent_key TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER
    );
  `);
  addColumnIfMissing(db, 'revenue_split_templates', 'label', 'TEXT');
  addColumnIfMissing(db, 'revenue_split_templates', 'user_id', 'INTEGER');
  addColumnIfMissing(db, 'revenue_split_templates', 'seeded', 'INTEGER NOT NULL DEFAULT 0');

  const insert = db.prepare(`
    INSERT OR IGNORE INTO revenue_split_templates (agent_key, settings_json, label, seeded)
    VALUES (?, ?, ?, 1)
  `);
  for (const key of SEEDED_AGENT_KEYS) {
    insert.run(key, JSON.stringify(defaultTemplateSettings(key)), TEMPLATE_AGENT_LABELS[key]);
  }

  // Mark seeded + labels
  for (const key of SEEDED_AGENT_KEYS) {
    db.prepare(`
      UPDATE revenue_split_templates
      SET seeded = 1, label = COALESCE(NULLIF(label, ''), ?)
      WHERE agent_key = ?
    `).run(TEMPLATE_AGENT_LABELS[key], key);
  }

  // Normalize legacy JSON shapes in place
  const rows = db.prepare('SELECT agent_key, settings_json FROM revenue_split_templates').all();
  const update = db.prepare(`
    UPDATE revenue_split_templates SET settings_json = ? WHERE agent_key = ?
  `);
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.settings_json);
      const normalized = normalizeTemplateSettings(parsed);
      update.run(JSON.stringify(normalized), row.agent_key);
    } catch {
      // leave as-is
    }
  }
}

function templateLabel(row) {
  if (row.label && String(row.label).trim()) return String(row.label).trim();
  return TEMPLATE_AGENT_LABELS[row.agent_key] || row.agent_key;
}

export function getTemplateSettings(db, agentKey) {
  if (!agentKey) return normalizeTemplateSettings(defaultTemplateSettings('tessa'));
  const row = db.prepare(
    'SELECT settings_json FROM revenue_split_templates WHERE agent_key = ?',
  ).get(agentKey);
  if (!row?.settings_json) {
    if (SEEDED_AGENT_KEYS.includes(agentKey)) {
      return normalizeTemplateSettings(defaultTemplateSettings(agentKey));
    }
    return normalizeTemplateSettings(defaultTemplateSettings('tessa'));
  }
  try {
    return normalizeTemplateSettings(JSON.parse(row.settings_json));
  } catch {
    return normalizeTemplateSettings(defaultTemplateSettings(
      SEEDED_AGENT_KEYS.includes(agentKey) ? agentKey : 'tessa',
    ));
  }
}

export function getTemplateSettingsForAgentId(db, agentId) {
  const key = agentKeyFromUserId(db, agentId);
  if (!key) return normalizeTemplateSettings(defaultTemplateSettings('tessa'));
  return getTemplateSettings(db, key);
}

export function getTemplateMeta(db, agentKey) {
  const row = db.prepare(`
    SELECT agent_key, label, user_id, seeded FROM revenue_split_templates WHERE agent_key = ?
  `).get(agentKey);
  if (!row) {
    return {
      agent_key: agentKey,
      label: TEMPLATE_AGENT_LABELS[agentKey] || agentKey,
      user_id: null,
      seeded: SEEDED_AGENT_KEYS.includes(agentKey),
    };
  }
  return {
    agent_key: row.agent_key,
    label: templateLabel(row),
    user_id: row.user_id,
    seeded: Boolean(row.seeded) || SEEDED_AGENT_KEYS.includes(row.agent_key),
  };
}

export function listTemplates(db) {
  const rows = db.prepare(`
    SELECT agent_key, label, user_id, seeded, settings_json
    FROM revenue_split_templates
    ORDER BY
      CASE agent_key
        WHEN 'meredith' THEN 0
        WHEN 'tessa' THEN 1
        WHEN 'margaret' THEN 2
        WHEN 'adam' THEN 3
        ELSE 4
      END,
      label COLLATE NOCASE ASC,
      agent_key ASC
  `).all();

  return rows.map((row) => {
    let settings;
    try {
      settings = normalizeTemplateSettings(JSON.parse(row.settings_json));
    } catch {
      settings = normalizeTemplateSettings(defaultTemplateSettings(row.agent_key));
    }
    return {
      agent_key: row.agent_key,
      label: templateLabel(row),
      user_id: row.user_id,
      seeded: Boolean(row.seeded) || SEEDED_AGENT_KEYS.includes(row.agent_key),
      settings,
    };
  });
}

export function saveTemplateSettings(db, agentKey, rawSettings, updatedBy = null) {
  const existing = db.prepare(
    'SELECT agent_key FROM revenue_split_templates WHERE agent_key = ?',
  ).get(agentKey);
  if (!existing) {
    throw new Error('Unknown agent_key');
  }
  const settings = normalizeTemplateSettings(rawSettings);
  const teamSum = settings.teamSplits.reduce((s, t) => s + t.rate, 0);
  if (teamSum > 1.0001) {
    throw new Error('Team split rates cannot total more than 100%');
  }
  db.prepare(`
    UPDATE revenue_split_templates
    SET settings_json = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
    WHERE agent_key = ?
  `).run(JSON.stringify(settings), updatedBy, agentKey);
  return settings;
}

export function createAgentTemplate(db, { userId = null, label = null, agentKey = null } = {}, updatedBy = null) {
  let key = agentKey ? slugifyAgentKey(agentKey) : null;
  let resolvedLabel = label ? String(label).trim() : null;
  let resolvedUserId = userId != null && userId !== '' ? Number(userId) : null;

  if (resolvedUserId) {
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(resolvedUserId);
    if (!user) throw new Error('Invalid user_id');
    const existingKey = agentKeyFromUserId(db, resolvedUserId);
    if (existingKey) throw new Error('That team member already has a template');
    resolvedLabel = resolvedLabel || user.name || user.email;
    key = key || slugifyAgentKey(resolvedLabel);
  }

  if (!key) {
    if (!resolvedLabel) throw new Error('label or user_id is required');
    key = slugifyAgentKey(resolvedLabel);
  }
  if (!resolvedLabel) resolvedLabel = key;

  // Ensure unique key
  let unique = key;
  let n = 2;
  while (db.prepare('SELECT 1 FROM revenue_split_templates WHERE agent_key = ?').get(unique)) {
    unique = `${key}_${n}`;
    n += 1;
  }

  const settings = defaultTemplateSettings(
    SEEDED_AGENT_KEYS.includes(unique) ? unique : 'tessa',
  );

  db.prepare(`
    INSERT INTO revenue_split_templates (agent_key, settings_json, label, user_id, seeded, updated_by)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(unique, JSON.stringify(settings), resolvedLabel, resolvedUserId, updatedBy);

  return {
    agent_key: unique,
    label: resolvedLabel,
    user_id: resolvedUserId,
    seeded: false,
    settings,
  };
}

export function deleteAgentTemplate(db, agentKey) {
  const row = db.prepare(
    'SELECT agent_key, seeded FROM revenue_split_templates WHERE agent_key = ?',
  ).get(agentKey);
  if (!row) throw new Error('Not found');
  if (row.seeded || SEEDED_AGENT_KEYS.includes(row.agent_key)) {
    throw new Error('Seeded templates cannot be deleted');
  }
  db.prepare('DELETE FROM revenue_split_templates WHERE agent_key = ?').run(agentKey);
  return { ok: true };
}

export function teamSplitRatesSumOk(settings) {
  const s = normalizeTemplateSettings(settings);
  const sum = s.teamSplits.reduce((acc, t) => acc + t.rate, 0);
  return sum <= 1.0001;
}

export { round2 };
