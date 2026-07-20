import {
  COMMISSION_SETTINGS,
  round2,
} from './commissionPlans.js';

export const TEMPLATE_AGENT_KEYS = ['meredith', 'tessa', 'margaret', 'adam'];

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

/** Same eXp fees as Meredith, no team splits — seed for non-Meredith agents. */
export function defaultTemplateSettings(agentKey) {
  if (agentKey === 'meredith') {
    return { ...COMMISSION_SETTINGS };
  }
  return {
    ...COMMISSION_SETTINGS,
    tessaRate: 0,
    margaretRate: 0,
  };
}

export function normalizeTemplateSettings(raw = {}) {
  const base = COMMISSION_SETTINGS;
  const n = (v, fallback) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? x : fallback;
  };
  const rate = (v, fallback) => {
    const x = Number(v);
    if (!Number.isFinite(x) || x < 0) return fallback;
    // Accept either 0.04 or 4 (percent) for team / split rates under 1 vs over 1
    return x;
  };

  let splitRate = rate(raw.splitRate, base.splitRate);
  if (splitRate > 1) splitRate = splitRate / 100;

  let tessaRate = rate(raw.tessaRate, base.tessaRate);
  if (tessaRate > 1) tessaRate = tessaRate / 100;

  let margaretRate = rate(raw.margaretRate, base.margaretRate);
  if (margaretRate > 1) margaretRate = margaretRate / 100;

  return {
    capAmount: round2(n(raw.capAmount, base.capAmount)),
    splitRate: Math.min(1, splitRate),
    brokerReviewFee: round2(n(raw.brokerReviewFee, base.brokerReviewFee)),
    riskManagementFee: round2(n(raw.riskManagementFee, base.riskManagementFee)),
    riskManagementAnnualCap: round2(n(raw.riskManagementAnnualCap, base.riskManagementAnnualCap)),
    cappedTransactionFee: round2(n(raw.cappedTransactionFee, base.cappedTransactionFee)),
    cappedTransactionFeeReduced: round2(n(raw.cappedTransactionFeeReduced, base.cappedTransactionFeeReduced)),
    cappedFeesStepDownAt: round2(n(raw.cappedFeesStepDownAt, base.cappedFeesStepDownAt)),
    tessaRate: Math.min(1, tessaRate),
    margaretRate: Math.min(1, margaretRate),
  };
}

export function agentKeyFromEmail(email) {
  if (!email) return null;
  return EMAIL_TO_KEY[String(email).toLowerCase()] ?? null;
}

export function agentKeyFromUserId(db, userId) {
  if (userId == null || userId === '') return null;
  const row = db.prepare('SELECT email FROM users WHERE id = ?').get(Number(userId));
  return agentKeyFromEmail(row?.email);
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

  const insert = db.prepare(`
    INSERT OR IGNORE INTO revenue_split_templates (agent_key, settings_json)
    VALUES (?, ?)
  `);
  for (const key of TEMPLATE_AGENT_KEYS) {
    insert.run(key, JSON.stringify(defaultTemplateSettings(key)));
  }
}

export function getTemplateSettings(db, agentKey) {
  const key = TEMPLATE_AGENT_KEYS.includes(agentKey) ? agentKey : null;
  if (!key) return normalizeTemplateSettings(defaultTemplateSettings('tessa'));

  const row = db.prepare(
    'SELECT settings_json FROM revenue_split_templates WHERE agent_key = ?',
  ).get(key);

  if (!row?.settings_json) {
    return normalizeTemplateSettings(defaultTemplateSettings(key));
  }
  try {
    return normalizeTemplateSettings(JSON.parse(row.settings_json));
  } catch {
    return normalizeTemplateSettings(defaultTemplateSettings(key));
  }
}

export function getTemplateSettingsForAgentId(db, agentId) {
  const key = agentKeyFromUserId(db, agentId);
  if (!key) return normalizeTemplateSettings(defaultTemplateSettings('tessa'));
  return getTemplateSettings(db, key);
}

export function listTemplates(db) {
  return TEMPLATE_AGENT_KEYS.map((agent_key) => ({
    agent_key,
    label: TEMPLATE_AGENT_LABELS[agent_key],
    settings: getTemplateSettings(db, agent_key),
  }));
}

export function saveTemplateSettings(db, agentKey, rawSettings, updatedBy = null) {
  if (!TEMPLATE_AGENT_KEYS.includes(agentKey)) {
    throw new Error('Invalid agent_key');
  }
  const settings = normalizeTemplateSettings(rawSettings);
  db.prepare(`
    INSERT INTO revenue_split_templates (agent_key, settings_json, updated_at, updated_by)
    VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(agent_key) DO UPDATE SET
      settings_json = excluded.settings_json,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = excluded.updated_by
  `).run(agentKey, JSON.stringify(settings), updatedBy);
  return settings;
}
