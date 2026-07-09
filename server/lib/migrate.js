import { parseLegacyCityLine } from './address.js';
import { backfillTransactionChecklists } from './transactionChecklists.js';
import { deriveNickname } from './deriveNickname.js';
import {
  CHECKLIST_TEMPLATE_SORT_ORDER,
  defaultRoleForChecklistTemplate,
} from './checklist-templates.js';
import { syncAllTaskAssigneesFromTemplates } from './taskAssignment.js';
import { resyncNamedChecklistTemplates } from '../seed-data.js';
import { dedupeAllChecklistTemplates } from './checklistTaskCleanup.js';

export function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS template_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER REFERENCES checklist_templates(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      timing_value INTEGER,
      timing_direction TEXT,
      timing_anchor TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const txCols = {
    mls_number: 'TEXT',
    owner_name: 'TEXT',
    city: 'TEXT',
    representing: "TEXT DEFAULT 'seller'",
    important_date: 'DATE',
    important_date_label: "TEXT DEFAULT 'expires'",
    thumbnail_color: "TEXT DEFAULT 'gray'",
    listing_date: 'DATE',
    acceptance_date: 'DATE',
    option_end_date: 'DATE',
    workflow_status: "TEXT DEFAULT 'active'",
    checklist_template_id: 'INTEGER REFERENCES checklist_templates(id)',
  };
  for (const [col, def] of Object.entries(txCols)) {
    addColumnIfMissing(db, 'transactions', col, def);
  }

  addColumnIfMissing(db, 'tasks', 'transaction_id', 'INTEGER REFERENCES transactions(id)');
  addColumnIfMissing(db, 'tasks', 'template_task_id', 'INTEGER REFERENCES template_tasks(id)');
  addColumnIfMissing(db, 'tasks', 'completed_at', 'DATETIME');
  addColumnIfMissing(db, 'template_tasks', 'default_role', 'TEXT');
  addColumnIfMissing(db, 'template_tasks', 'calendar_nickname', 'TEXT');
  backfillTemplateTaskNicknames(db);
  migrateTemplateNicknamesV2(db);
  migrateTemplateNicknamesV3(db);
  migrateTemplateNicknamesV4(db);
  migrateTemplateNicknamesV5(db);
  migrateChecklistTemplatesJul2026(db);
  migrateChecklistTaskOrphansJul2026(db);

  addColumnIfMissing(db, 'transactions', 'transaction_name', 'TEXT');
  addColumnIfMissing(db, 'transactions', 'sale_type', "TEXT DEFAULT 'Traditional sale'");
  addColumnIfMissing(db, 'transactions', 'gross_commission', 'REAL');
  addColumnIfMissing(db, 'transactions', 'buyer_agreement_date', 'DATE');
  addColumnIfMissing(db, 'transactions', 'buyer_expiration_date', 'DATE');

  addColumnIfMissing(db, 'transactions', 'client_name', 'TEXT');
  db.prepare('UPDATE transactions SET client_name = owner_name WHERE client_name IS NULL AND owner_name IS NOT NULL').run();
  addColumnIfMissing(db, 'tasks', 'description', 'TEXT');
  addColumnIfMissing(db, 'tasks', 'requires_document', 'INTEGER DEFAULT 0');

  db.exec(`
    CREATE TABLE IF NOT EXISTS transaction_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      event_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      detail TEXT,
      task_id INTEGER REFERENCES tasks(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transaction_parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      user_id INTEGER REFERENCES users(id),
      sort_order INTEGER DEFAULT 0,
      UNIQUE(transaction_id, role)
    );
  `);

  db.prepare("UPDATE transactions SET workflow_status = 'active' WHERE workflow_status IS NULL").run();

  addColumnIfMissing(db, 'transactions', 'state', 'TEXT');
  addColumnIfMissing(db, 'transactions', 'zip', 'TEXT');
  migrateTransactionAddressAndRepresenting(db);
  migratePrivateListingVisibility(db);
  migrateSellerAndBuyerRepresenting(db);
  migrateCounterpartyParties(db);
  migrateDeprecateSellerAndBuyer(db);
  backfillTransactionChecklists(db);

  migrateContactsTable(db);
  addColumnIfMissing(db, 'contacts', 'partner_birthday', 'TEXT');
  addColumnIfMissing(db, 'contacts', 'partner_name', 'TEXT');
  addColumnIfMissing(db, 'contacts', 'kids_names', 'TEXT');
  addColumnIfMissing(db, 'contacts', 'person_type', "TEXT DEFAULT 'contact'");
  addColumnIfMissing(db, 'contacts', 'home_anniversary', 'TEXT');
  addColumnIfMissing(db, 'tasks', 'timing_value', 'INTEGER');
  addColumnIfMissing(db, 'tasks', 'timing_direction', 'TEXT');
  addColumnIfMissing(db, 'tasks', 'timing_anchor', 'TEXT');
  addColumnIfMissing(db, 'tasks', 'due_date_override', 'INTEGER DEFAULT 0');
  migrateCrmActivityAndGmail(db);
  migrateMarketingTables(db);
  migrateBirthdayPinsTable(db);
  migrateProjectsTables(db);
  migrateUserTodosTable(db);
  addColumnIfMissing(db, 'user_todos', 'due_date', 'DATE');
  migratePendingStageFromCloseDate(db);
  migrateChecklistTemplateSortOrder(db);
  migrateChecklistTemplateAssigneesOnce(db);
  migrateUserEmailsToHeydayGroup(db);
  migrateTaskCategory(db);
  migrateTeamHubTables(db);
  migrateHubDocItemsTable(db);
}

function migrateHubDocItemsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hub_doc_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL CHECK(section IN ('feedback', 'hub_edits')),
      body TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_hub_doc_items_section ON hub_doc_items(section, sort_order, id);
  `);
}

function migrateTeamHubTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS team_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_team_messages_created ON team_messages(created_at);
  `);
}

function migrateTaskCategory(db) {
  addColumnIfMissing(db, 'tasks', 'category', 'TEXT');
  db.prepare(`
    UPDATE tasks SET category = CASE WHEN transaction_id IS NOT NULL THEN 'transaction' ELSE 'admin' END
    WHERE category IS NULL
  `).run();
}

function migrateUserEmailsToHeydayGroup(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  const done = db.prepare("SELECT 1 FROM app_meta WHERE key = 'user_emails_theheydaygroup_v1'").get();
  if (done) return;

  db.prepare(`
    UPDATE users SET email = REPLACE(email, '@heyday.com', '@theheydaygroup.com')
    WHERE email LIKE '%@heyday.com'
  `).run();

  db.prepare("INSERT INTO app_meta (key, value) VALUES ('user_emails_theheydaygroup_v1', '1')").run();
}

function migrateChecklistTemplateSortOrder(db) {
  for (const [name, sortOrder] of Object.entries(CHECKLIST_TEMPLATE_SORT_ORDER)) {
    db.prepare('UPDATE checklist_templates SET sort_order = ? WHERE name = ?').run(sortOrder, name);
  }
}

function migrateChecklistTemplateAssigneesOnce(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  const done = db.prepare("SELECT 1 FROM app_meta WHERE key = 'checklist_template_roles_v1'").get();
  if (done) return;

  const templates = db.prepare('SELECT id, name FROM checklist_templates').all();
  const updateRole = db.prepare('UPDATE template_tasks SET default_role = ? WHERE template_id = ?');
  db.transaction(() => {
    for (const template of templates) {
      updateRole.run(defaultRoleForChecklistTemplate(template.name), template.id);
    }
    syncAllTaskAssigneesFromTemplates(db);
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('checklist_template_roles_v1', '1')").run();
  })();
}

function migratePendingStageFromCloseDate(db) {
  db.prepare(`
    UPDATE transactions SET stage = 'pending'
    WHERE stage = 'active' AND close_date IS NOT NULL AND TRIM(close_date) != ''
  `).run();
}

function migrateProjectsTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT,
      due_date DATE,
      is_complete INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_project_checklist_items_project ON project_checklist_items(project_id);
  `);
}

function migrateUserTodosTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT,
      is_complete INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_user_todos_user_id ON user_todos(user_id);
  `);
}

function backfillTemplateTaskNicknames(db) {
  const rows = db.prepare(`
    SELECT id, title FROM template_tasks
    WHERE calendar_nickname IS NULL OR calendar_nickname = ''
       OR calendar_nickname LIKE '%…%'
  `).all();
  if (rows.length === 0) return;

  const update = db.prepare('UPDATE template_tasks SET calendar_nickname = ? WHERE id = ?');
  db.transaction(() => {
    for (const row of rows) {
      update.run(deriveNickname(row.title), row.id);
    }
  })();
}

function migrateTemplateNicknamesV2(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  if (db.prepare("SELECT 1 FROM _migrations WHERE name = 'template_nicknames_v2'").get()) return;

  const rows = db.prepare('SELECT id, title FROM template_tasks').all();
  const update = db.prepare('UPDATE template_tasks SET calendar_nickname = ? WHERE id = ?');
  db.transaction(() => {
    for (const row of rows) {
      update.run(deriveNickname(row.title), row.id);
    }
  })();

  db.prepare("INSERT INTO _migrations (name) VALUES ('template_nicknames_v2')").run();
}

function migrateTemplateNicknamesV3(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  if (db.prepare("SELECT 1 FROM _migrations WHERE name = 'template_nicknames_v3'").get()) return;

  const rows = db.prepare(`
    SELECT id, title FROM template_tasks
    WHERE title LIKE 'MARKETING PREP:%'
       OR calendar_nickname LIKE 'MARKETING PREP:%'
  `).all();
  const update = db.prepare('UPDATE template_tasks SET calendar_nickname = ? WHERE id = ?');
  db.transaction(() => {
    for (const row of rows) {
      update.run(deriveNickname(row.title), row.id);
    }
  })();

  db.prepare("INSERT INTO _migrations (name) VALUES ('template_nicknames_v3')").run();
}

function migrateTemplateNicknamesV4(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  if (db.prepare("SELECT 1 FROM _migrations WHERE name = 'template_nicknames_v4'").get()) return;

  const rows = db.prepare(`
    SELECT id, title FROM template_tasks
    WHERE title LIKE 'MARKETING:%'
       OR title LIKE 'MARKETING PREP:%'
       OR calendar_nickname LIKE '%MARKETING%'
       OR calendar_nickname LIKE '%Marketing%'
  `).all();
  const update = db.prepare('UPDATE template_tasks SET calendar_nickname = ? WHERE id = ?');
  db.transaction(() => {
    for (const row of rows) {
      update.run(deriveNickname(row.title), row.id);
    }
  })();

  db.prepare("INSERT INTO _migrations (name) VALUES ('template_nicknames_v4')").run();
}

function migrateTemplateNicknamesV5(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  if (db.prepare("SELECT 1 FROM _migrations WHERE name = 'template_nicknames_v5'").get()) return;

  const rows = db.prepare(`
    SELECT id, title FROM template_tasks
    WHERE title LIKE 'MARKETING:%'
       OR title LIKE 'MARKETING PREP:%'
       OR calendar_nickname LIKE '%MARKETING%'
       OR calendar_nickname LIKE '%Marketing%'
  `).all();
  const update = db.prepare('UPDATE template_tasks SET calendar_nickname = ? WHERE id = ?');
  db.transaction(() => {
    for (const row of rows) {
      update.run(deriveNickname(row.title), row.id);
    }
  })();

  db.prepare("INSERT INTO _migrations (name) VALUES ('template_nicknames_v5')").run();
}

function migrateChecklistTemplatesJul2026(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  if (db.prepare("SELECT 1 FROM _migrations WHERE name = 'checklist_templates_jul2026'").get()) return;

  resyncNamedChecklistTemplates(db, [
    'Buyer (With TC)',
    'Listing : CTC (if no TC)',
    'Listing : CTC (With TC)',
  ]);

  db.prepare("INSERT INTO _migrations (name) VALUES ('checklist_templates_jul2026')").run();
}

function migrateChecklistTaskOrphansJul2026(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  if (db.prepare("SELECT 1 FROM _migrations WHERE name = 'checklist_task_orphans_jul2026'").get()) return;

  const { relinked, deleted } = dedupeAllChecklistTemplates(db);
  console.log(`Checklist orphan cleanup: relinked ${relinked}, deleted ${deleted} duplicate/stale task(s)`);

  db.prepare("INSERT INTO _migrations (name) VALUES ('checklist_task_orphans_jul2026')").run();
}

function migrateBirthdayPinsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS marketing_birthday_pins (
      month TEXT NOT NULL,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (month, contact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_marketing_birthday_pins_month ON marketing_birthday_pins(month);
  `);
}

const DEFAULT_PLATFORM_GOALS = [
  { platform: 'TikTok', frequency: '2–3 posts/week', goal: '200+ views per post', color: '#000000', sort_order: 0 },
  { platform: 'Instagram', frequency: 'Stories daily', goal: '1K subscribers by EOY', color: '#E1306C', sort_order: 1 },
  { platform: 'Facebook', frequency: '3 posts/week', goal: 'Grow page reach 15%', color: '#1877F2', sort_order: 2 },
  { platform: 'LinkedIn', frequency: '2 posts/week', goal: 'Build thought leadership', color: '#4f2a50', sort_order: 3 },
  { platform: 'YouTube', frequency: '1 video/week', goal: '500 views per video', color: '#FF0000', sort_order: 4 },
  { platform: 'Podcast', frequency: '1 episode/week', goal: 'Steady listener growth', color: '#2c4a6e', sort_order: 5 },
  { platform: 'IG Grid', frequency: '3 grid posts/week', goal: 'Consistent brand aesthetic', color: '#0d9488', sort_order: 6 },
  { platform: 'IG Story', frequency: 'Daily stories', goal: 'High engagement rate', color: '#38bdf8', sort_order: 7 },
  { platform: 'Blog', frequency: '2 posts/month', goal: 'SEO + lead capture', color: '#7f1d1d', sort_order: 8 },
  { platform: 'Pop By', frequency: '2 events/month', goal: 'Sphere touchpoints', color: '#d4a574', sort_order: 9 },
  { platform: 'Newsletters', frequency: '2 posts/week', goal: 'Consistent nurture', color: '#053e3f', sort_order: 10 },
];

function migrateMarketingTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS marketing_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planning',
      scheduled_date DATE NOT NULL,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS marketing_platform_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL UNIQUE,
      frequency TEXT,
      goal TEXT,
      color TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_marketing_posts_date ON marketing_posts(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_marketing_posts_platform ON marketing_posts(platform);
  `);

  const insertGoal = db.prepare(`
    INSERT INTO marketing_platform_goals (platform, frequency, goal, color, sort_order)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(platform) DO NOTHING
  `);
  for (const g of DEFAULT_PLATFORM_GOALS) {
    insertGoal.run(g.platform, g.frequency, g.goal, g.color, g.sort_order);
  }
}

function migrateSellerAndBuyerRepresenting(db) {
  db.prepare("UPDATE transactions SET representing = 'seller_and_buyer' WHERE representing IN ('both', 'seller_and_client')").run();
}

function migrateDeprecateSellerAndBuyer(db) {
  db.prepare("UPDATE transactions SET representing = 'seller' WHERE representing = 'seller_and_buyer'").run();
}

function migrateCounterpartyParties(db) {
  db.prepare("DELETE FROM transaction_parties WHERE role = 'client'").run();

  const transactions = db.prepare('SELECT id, representing, client_name, owner_name FROM transactions').all();

  for (const tx of transactions) {
    const r = tx.representing === 'both' || tx.representing === 'seller_and_client'
      ? 'seller_and_buyer'
      : tx.representing;

    const rows = db.prepare(
      'SELECT id, role, name FROM transaction_parties WHERE transaction_id = ?',
    ).all(tx.id);

    const externalName = (tx.client_name || tx.owner_name || '').trim();
    const sellerRow = rows.find((p) => p.role === 'seller' || p.role === 'counterparty');
    const buyerRow = rows.find((p) => p.role === 'buyer');
    const sellerName = sellerRow?.name?.trim() || externalName;

    if (r === 'seller_and_buyer') {
      if (sellerRow && sellerRow.role !== 'seller') {
        db.prepare('UPDATE transaction_parties SET role = ? WHERE id = ?').run('seller', sellerRow.id);
      }
      if (!buyerRow) {
        db.prepare(`
          INSERT INTO transaction_parties (transaction_id, role, name, user_id, sort_order)
          VALUES (?, 'buyer', '', NULL, 99)
        `).run(tx.id);
      }
      if (!sellerRow) {
        db.prepare(`
          INSERT INTO transaction_parties (transaction_id, role, name, user_id, sort_order)
          VALUES (?, 'seller', ?, NULL, 98)
        `).run(tx.id, sellerName);
      }
      db.prepare("DELETE FROM transaction_parties WHERE transaction_id = ? AND role = 'counterparty'").run(tx.id);
    } else {
      if (sellerRow) {
        db.prepare('UPDATE transaction_parties SET role = ? WHERE id = ?').run('counterparty', sellerRow.id);
      } else {
        db.prepare(`
          INSERT INTO transaction_parties (transaction_id, role, name, user_id, sort_order)
          VALUES (?, 'counterparty', ?, NULL, 98)
        `).run(tx.id, sellerName);
      }
      db.prepare("DELETE FROM transaction_parties WHERE transaction_id = ? AND role IN ('buyer', 'seller')").run(tx.id);
    }
  }
}

function migratePrivateListingVisibility(db) {
  addColumnIfMissing(db, 'transactions', 'listing_visibility', "TEXT DEFAULT 'public'");
  db.prepare(`
    UPDATE transactions
    SET listing_visibility = 'private', representing = 'seller'
    WHERE representing = 'private_listing'
  `).run();
  db.prepare(`
    UPDATE transactions SET listing_visibility = 'public'
    WHERE listing_visibility IS NULL OR TRIM(listing_visibility) = ''
  `).run();
}

function migrateTransactionAddressAndRepresenting(db) {
  db.prepare("UPDATE transactions SET representing = 'landlord' WHERE representing = 'leasing'").run();
  db.prepare("UPDATE transactions SET representing = 'tenant' WHERE representing = 'renting'").run();

  const rows = db.prepare(`
    SELECT id, city FROM transactions
    WHERE city IS NOT NULL AND city != '' AND (state IS NULL OR state = '') AND city LIKE '%,%'
  `).all();

  const update = db.prepare('UPDATE transactions SET city = ?, state = ?, zip = ? WHERE id = ?');
  for (const row of rows) {
    const parsed = parseLegacyCityLine(row.city);
    update.run(parsed.city, parsed.state, parsed.zip, row.id);
  }
}

function migrateCrmActivityAndGmail(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gmail_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gmail_address TEXT NOT NULL UNIQUE,
      heyday_user_id INTEGER REFERENCES users(id),
      refresh_token TEXT NOT NULL,
      access_token TEXT,
      token_expiry INTEGER,
      last_sync_at DATETIME,
      last_sync_error TEXT,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      connected_by_user_id INTEGER REFERENCES users(id),
      sync_enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS contact_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      event_type TEXT NOT NULL,
      summary TEXT,
      body TEXT,
      subject TEXT,
      occurred_at DATETIME,
      direction TEXT,
      mailbox TEXT,
      external_id TEXT UNIQUE,
      thread_id TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_contact_activity_contact ON contact_activity(contact_id);
    CREATE INDEX IF NOT EXISTS idx_contact_activity_occurred ON contact_activity(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_contact_activity_type ON contact_activity(event_type);
    CREATE INDEX IF NOT EXISTS idx_contact_activity_external ON contact_activity(external_id);
  `);
}

function migrateContactsTable(db) {
  const cols = db.prepare('PRAGMA table_info(contacts)').all();
  if (cols.some((c) => c.name === 'external_id')) return;

  db.exec(`
    DROP TABLE IF EXISTS contacts;
    CREATE TABLE contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT UNIQUE,
      date_added DATE,
      first_name TEXT,
      last_name TEXT,
      name TEXT NOT NULL,
      stage TEXT,
      lead_source TEXT,
      assigned_to_name TEXT,
      last_assigned DATE,
      is_contacted INTEGER DEFAULT 0,
      listing_price REAL,
      tags TEXT,
      timeframe TEXT,
      email TEXT,
      email_2 TEXT,
      phone TEXT,
      phone_2 TEXT,
      street TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      country TEXT,
      property_address TEXT,
      property_city TEXT,
      property_state TEXT,
      property_zip TEXT,
      property_mls TEXT,
      property_price REAL,
      last_contacted DATE,
      birthday TEXT,
      anniversary TEXT,
      company TEXT,
      sphere_source TEXT,
      referred_by TEXT,
      message TEXT,
      description TEXT,
      notes TEXT,
      assigned_to INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'prospect',
      raw_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_external_id ON contacts(external_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
    CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage);
    CREATE INDEX IF NOT EXISTS idx_contacts_lead_source ON contacts(lead_source);
    CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to_name ON contacts(assigned_to_name);
    CREATE INDEX IF NOT EXISTS idx_contacts_last_contacted ON contacts(last_contacted);
  `);
}
