import db from '../db.js';
import { resyncNamedChecklistTemplates } from '../seed-data.js';
import { dedupeAllChecklistTemplates } from '../lib/checklistTaskCleanup.js';

const DEFAULT_NAMES = [
  'Buyer (With TC)',
  'Listing : CTC (if no TC)',
  'Listing : CTC (With TC)',
];

const names = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_NAMES;
resyncNamedChecklistTemplates(db, names);
const { relinked, deleted } = dedupeAllChecklistTemplates(db);
console.log(`Orphan cleanup: relinked ${relinked}, deleted ${deleted}`);
