import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './lib/migrate.js';
import { seedBrokermintData } from './seed-data.js';
import { splitCombinedAddresses } from './lib/address.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'heyday.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'agent',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    last_contact DATETIME,
    status TEXT DEFAULT 'prospect',
    assigned_to INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    assigned_to INTEGER REFERENCES users(id),
    due_date DATE,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    agent_id INTEGER REFERENCES users(id),
    value REAL,
    stage TEXT DEFAULT 'active',
    close_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

runMigrations(db);

const splitCount = splitCombinedAddresses(db);
if (splitCount > 0) {
  console.log(`Split combined address/city on ${splitCount} transaction(s)`);
}

const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@heyday.com');
if (!adminExists) {
  const passwordHash = bcrypt.hashSync('admin123', 12);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('Admin User', 'admin@heyday.com', passwordHash, 'admin');
  console.log('Seeded admin user: admin@heyday.com / admin123');
}

seedBrokermintData(db);

export default db;
