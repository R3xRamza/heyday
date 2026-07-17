import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { normalizeBuyerOpportunityRows, resolveBuyerPriceFields } from './buyerOpportunityNormalize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(__dirname, '..', 'seed', 'opportunities');
const MEREDITH_EMAIL = 'meredith@theheydaygroup.com';

function cell(row, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] != null) {
      const v = String(row[key]).trim();
      if (v) return v;
    }
  }
  // Case-insensitive / trimmed header match
  const entries = Object.entries(row);
  for (const want of keys) {
    const wantNorm = want.trim().toLowerCase();
    for (const [k, v] of entries) {
      if (String(k).trim().toLowerCase() === wantNorm) {
        const s = v == null ? '' : String(v).trim();
        if (s) return s;
      }
    }
  }
  return '';
}

function emptyToNull(s) {
  return s ? s : null;
}

function addColumnIfMissingLocal(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function migrateOpportunitiesTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS opportunity_buyers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT,
      buyer_name TEXT NOT NULL,
      price TEXT,
      price_min REAL,
      price_max REAL,
      location TEXT,
      timing TEXT,
      buyer_rep_signed TEXT,
      buyer_rep_dropbox TEXT,
      notes TEXT,
      lender TEXT,
      preapproval TEXT,
      showings TEXT,
      search_setup TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS opportunity_sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT,
      property_address TEXT NOT NULL,
      seller_name TEXT,
      timing TEXT,
      price_range TEXT,
      neighborhood TEXT,
      notes TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_opportunity_buyers_agent ON opportunity_buyers(agent_id);
    CREATE INDEX IF NOT EXISTS idx_opportunity_sellers_agent ON opportunity_sellers(agent_id);
  `);

  addColumnIfMissingLocal(db, 'opportunity_buyers', 'price_min', 'REAL');
  addColumnIfMissingLocal(db, 'opportunity_buyers', 'price_max', 'REAL');

  seedOpportunitiesIfEmpty(db);
  normalizeBuyerOpportunityRows(db);
}

export function seedOpportunitiesIfEmpty(db) {
  const meredith = db.prepare('SELECT id FROM users WHERE email = ?').get(MEREDITH_EMAIL);
  if (!meredith?.id) {
    console.error(
      `[opportunities seed] SKIPPED — user ${MEREDITH_EMAIL} not found. Do not orphan rows.`,
    );
    return;
  }
  const agentId = meredith.id;

  const buyerCount = db.prepare('SELECT COUNT(*) AS c FROM opportunity_buyers').get().c;
  if (buyerCount === 0) {
    seedBuyers(db, agentId);
  }

  const sellerCount = db.prepare('SELECT COUNT(*) AS c FROM opportunity_sellers').get().c;
  if (sellerCount === 0) {
    seedSellers(db, agentId);
  }
}

function readCsv(filename) {
  const filePath = path.join(SEED_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`[opportunities seed] Missing CSV: ${filePath}`);
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  });
}

function seedBuyers(db, agentId) {
  const rows = readCsv('buyers.csv');
  if (!rows) return;

  const insert = db.prepare(`
    INSERT INTO opportunity_buyers (
      agent_id, status, buyer_name, price, price_min, price_max, location, timing,
      buyer_rep_signed, buyer_rep_dropbox, notes, lender, preapproval,
      showings, search_setup, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let n = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const buyerName = cell(row, 'Buyer', 'buyer', 'buyer_name');
      if (!buyerName) continue;
      const rawPrice = emptyToNull(cell(row, 'Price', 'price'));
      const priceFields = resolveBuyerPriceFields({ price: rawPrice });
      insert.run(
        agentId,
        emptyToNull(cell(row, 'Status', 'status')),
        buyerName,
        priceFields.price || rawPrice,
        priceFields.price_min,
        priceFields.price_max,
        emptyToNull(cell(row, 'Location', 'location')),
        emptyToNull(cell(row, 'Timing', 'timing')),
        emptyToNull(cell(row, 'Buyer Rep signed?', 'Buyer Rep signed', 'buyer_rep_signed')),
        emptyToNull(cell(row, 'Buyer Rep in Dropbox?', 'Buyer Rep in Dropbox? ', 'buyer_rep_dropbox')),
        emptyToNull(cell(row, 'Notes', 'notes')),
        emptyToNull(cell(row, 'Lender/ Lender Intro', 'Lender', 'lender')),
        emptyToNull(cell(row, 'Pre-approval complete', 'preapproval')),
        emptyToNull(cell(row, 'showings on calendar', 'Showings', 'showings')),
        emptyToNull(cell(row, 'Search setup', 'search_setup')),
        n,
      );
      n += 1;
    }
  });
  tx();
  console.log(`[opportunities seed] Imported ${n} buyer opportunities for Meredith`);
}

function seedSellers(db, agentId) {
  const rows = readCsv('sellers.csv');
  if (!rows) return;

  const insert = db.prepare(`
    INSERT INTO opportunity_sellers (
      agent_id, status, property_address, seller_name, timing,
      price_range, neighborhood, notes, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let n = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const address = cell(row, 'Property Address', 'property_address', 'Address');
      const seller = cell(row, 'Seller', 'seller', 'seller_name');
      if (!address && !seller) continue;
      insert.run(
        agentId,
        emptyToNull(cell(row, 'STATUS', 'Status', 'status')),
        address || '(no address)',
        emptyToNull(seller),
        emptyToNull(cell(row, 'Timing', 'timing')),
        emptyToNull(cell(row, 'Price Range', 'price_range')),
        emptyToNull(cell(row, 'Neighborhood', 'neighborhood')),
        emptyToNull(cell(row, 'Notes', 'notes')),
        n,
      );
      n += 1;
    }
  });
  tx();
  console.log(`[opportunities seed] Imported ${n} seller opportunities for Meredith`);
}
