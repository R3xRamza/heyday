import { Router } from 'express';
import db from '../db.js';
import {
  parseAgentScope,
  agentScopeUserId,
  transactionAgentScopeClause,
} from '../lib/agentScope.js';
import {
  normalizeBuyerStatus,
  normalizePreapproval,
} from '../lib/buyerOpportunityNormalize.js';

const router = Router();

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function resolveCreateAgentId(req, res) {
  const scope = parseAgentScope(req.query);
  if (scope !== 'all') {
    const id = agentScopeUserId(scope);
    if (!id) {
      res.status(400).json({ error: 'Could not resolve agent for scope' });
      return null;
    }
    return id;
  }
  const fromBody = req.body?.agent_id != null ? Number(req.body.agent_id) : null;
  if (fromBody) {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(fromBody);
    if (!user) {
      res.status(400).json({ error: 'Invalid agent_id' });
      return null;
    }
    return fromBody;
  }
  // Default All → Meredith
  const meredith = agentScopeUserId('meredith');
  if (!meredith) {
    res.status(400).json({ error: 'agent_id is required when scope is All' });
    return null;
  }
  return meredith;
}

function assertRowInScope(req, res, row) {
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return false;
  }
  const scope = parseAgentScope(req.query);
  if (scope === 'all') return true;
  const userId = agentScopeUserId(scope);
  if (!userId || row.agent_id !== userId) {
    res.status(404).json({ error: 'Not found' });
    return false;
  }
  return true;
}

function buyerSearchClause(q) {
  if (!q) return { sql: '', params: [] };
  const like = `%${q}%`;
  return {
    sql: ` AND (
      COALESCE(status,'') LIKE ? OR COALESCE(buyer_name,'') LIKE ?
      OR COALESCE(price,'') LIKE ? OR COALESCE(location,'') LIKE ?
      OR COALESCE(timing,'') LIKE ? OR COALESCE(notes,'') LIKE ?
      OR COALESCE(lender,'') LIKE ? OR COALESCE(showings,'') LIKE ?
      OR COALESCE(search_setup,'') LIKE ?
    )`,
    params: [like, like, like, like, like, like, like, like, like],
  };
}

function sellerSearchClause(q) {
  if (!q) return { sql: '', params: [] };
  const like = `%${q}%`;
  return {
    sql: ` AND (
      COALESCE(status,'') LIKE ? OR COALESCE(property_address,'') LIKE ?
      OR COALESCE(seller_name,'') LIKE ? OR COALESCE(timing,'') LIKE ?
      OR COALESCE(price_range,'') LIKE ? OR COALESCE(neighborhood,'') LIKE ?
      OR COALESCE(notes,'') LIKE ?
    )`,
    params: [like, like, like, like, like, like, like],
  };
}

// ── Buyers ──────────────────────────────────────────────────────────────

router.get('/buyers', (req, res) => {
  const agentScope = parseAgentScope(req.query);
  const { sql: scopeSql, params: scopeParams } = transactionAgentScopeClause(agentScope, '');
  const q = String(req.query.q || '').trim();
  const { sql: searchSql, params: searchParams } = buyerSearchClause(q);
  const status = String(req.query.status || '').trim();
  const statusSql = status ? ' AND status = ?' : '';
  const statusParams = status ? [status] : [];

  const rows = db.prepare(`
    SELECT * FROM opportunity_buyers
    WHERE 1=1 ${scopeSql} ${searchSql} ${statusSql}
    ORDER BY datetime(updated_at) DESC, id DESC
  `).all(...scopeParams, ...searchParams, ...statusParams);

  res.json({ buyers: rows });
});

router.post('/buyers', (req, res) => {
  const agentId = resolveCreateAgentId(req, res);
  if (agentId == null) return;

  const buyerName = trimOrNull(req.body.buyer_name);
  if (!buyerName) return res.status(400).json({ error: 'buyer_name is required' });

  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) AS m FROM opportunity_buyers WHERE agent_id = ?',
  ).get(agentId);

  const result = db.prepare(`
    INSERT INTO opportunity_buyers (
      agent_id, status, buyer_name, price, location, timing,
      buyer_rep_signed, buyer_rep_dropbox, notes, lender, preapproval,
      showings, search_setup, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agentId,
    normalizeBuyerStatus(req.body.status),
    buyerName,
    trimOrNull(req.body.price),
    trimOrNull(req.body.location),
    trimOrNull(req.body.timing),
    trimOrNull(req.body.buyer_rep_signed),
    trimOrNull(req.body.buyer_rep_dropbox),
    trimOrNull(req.body.notes),
    trimOrNull(req.body.lender),
    normalizePreapproval(req.body.preapproval) ?? trimOrNull(req.body.preapproval),
    trimOrNull(req.body.showings),
    trimOrNull(req.body.search_setup),
    maxOrder.m + 1,
  );

  const buyer = db.prepare('SELECT * FROM opportunity_buyers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ buyer });
});

router.patch('/buyers/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM opportunity_buyers WHERE id = ?').get(req.params.id);
  if (!assertRowInScope(req, res, existing)) return;

  const buyerName = req.body.buyer_name != null
    ? trimOrNull(req.body.buyer_name)
    : existing.buyer_name;
  if (!buyerName) return res.status(400).json({ error: 'buyer_name is required' });

  const pick = (key) => (Object.prototype.hasOwnProperty.call(req.body, key)
    ? trimOrNull(req.body[key])
    : existing[key]);

  const status = Object.prototype.hasOwnProperty.call(req.body, 'status')
    ? normalizeBuyerStatus(req.body.status)
    : normalizeBuyerStatus(existing.status);

  let preapproval = existing.preapproval;
  if (Object.prototype.hasOwnProperty.call(req.body, 'preapproval')) {
    const mapped = normalizePreapproval(req.body.preapproval);
    preapproval = mapped != null ? mapped : trimOrNull(req.body.preapproval);
  }

  db.prepare(`
    UPDATE opportunity_buyers SET
      status = ?, buyer_name = ?, price = ?, location = ?, timing = ?,
      buyer_rep_signed = ?, buyer_rep_dropbox = ?, notes = ?, lender = ?,
      preapproval = ?, showings = ?, search_setup = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status,
    buyerName,
    pick('price'),
    pick('location'),
    pick('timing'),
    pick('buyer_rep_signed'),
    pick('buyer_rep_dropbox'),
    pick('notes'),
    pick('lender'),
    preapproval,
    pick('showings'),
    pick('search_setup'),
    existing.id,
  );

  const buyer = db.prepare('SELECT * FROM opportunity_buyers WHERE id = ?').get(existing.id);
  res.json({ buyer });
});

router.delete('/buyers/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM opportunity_buyers WHERE id = ?').get(req.params.id);
  if (!assertRowInScope(req, res, existing)) return;
  db.prepare('DELETE FROM opportunity_buyers WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

// ── Sellers ─────────────────────────────────────────────────────────────

router.get('/sellers', (req, res) => {
  const agentScope = parseAgentScope(req.query);
  const { sql: scopeSql, params: scopeParams } = transactionAgentScopeClause(agentScope, '');
  const q = String(req.query.q || '').trim();
  const { sql: searchSql, params: searchParams } = sellerSearchClause(q);
  const status = String(req.query.status || '').trim();
  const statusSql = status ? ' AND status = ?' : '';
  const statusParams = status ? [status] : [];

  const rows = db.prepare(`
    SELECT * FROM opportunity_sellers
    WHERE 1=1 ${scopeSql} ${searchSql} ${statusSql}
    ORDER BY
      CASE lower(COALESCE(status, ''))
        WHEN 'upcoming' THEN 0
        WHEN 'pre-listing' THEN 1
        WHEN 'live' THEN 2
        WHEN 'private' THEN 3
        ELSE 4
      END ASC,
      property_address COLLATE NOCASE ASC,
      id ASC
  `).all(...scopeParams, ...searchParams, ...statusParams);

  res.json({ sellers: rows });
});

router.post('/sellers', (req, res) => {
  const agentId = resolveCreateAgentId(req, res);
  if (agentId == null) return;

  const address = trimOrNull(req.body.property_address);
  if (!address) return res.status(400).json({ error: 'property_address is required' });

  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) AS m FROM opportunity_sellers WHERE agent_id = ?',
  ).get(agentId);

  const result = db.prepare(`
    INSERT INTO opportunity_sellers (
      agent_id, status, property_address, seller_name, timing,
      price_range, neighborhood, notes, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agentId,
    trimOrNull(req.body.status),
    address,
    trimOrNull(req.body.seller_name),
    trimOrNull(req.body.timing),
    trimOrNull(req.body.price_range),
    trimOrNull(req.body.neighborhood),
    trimOrNull(req.body.notes),
    maxOrder.m + 1,
  );

  const seller = db.prepare('SELECT * FROM opportunity_sellers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ seller });
});

router.patch('/sellers/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM opportunity_sellers WHERE id = ?').get(req.params.id);
  if (!assertRowInScope(req, res, existing)) return;

  const address = req.body.property_address != null
    ? trimOrNull(req.body.property_address)
    : existing.property_address;
  if (!address) return res.status(400).json({ error: 'property_address is required' });

  const pick = (key) => (Object.prototype.hasOwnProperty.call(req.body, key)
    ? trimOrNull(req.body[key])
    : existing[key]);

  db.prepare(`
    UPDATE opportunity_sellers SET
      status = ?, property_address = ?, seller_name = ?, timing = ?,
      price_range = ?, neighborhood = ?, notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    pick('status'),
    address,
    pick('seller_name'),
    pick('timing'),
    pick('price_range'),
    pick('neighborhood'),
    pick('notes'),
    existing.id,
  );

  const seller = db.prepare('SELECT * FROM opportunity_sellers WHERE id = ?').get(existing.id);
  res.json({ seller });
});

router.delete('/sellers/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM opportunity_sellers WHERE id = ?').get(req.params.id);
  if (!assertRowInScope(req, res, existing)) return;
  db.prepare('DELETE FROM opportunity_sellers WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

export default router;
