import { Router } from 'express';
import db from '../db.js';
import { rowsToCsv } from '../lib/csv.js';
import { buildZip } from '../lib/zipStore.js';
import {
  computeYearCommissions,
  anniversaryWindowForEndYear,
} from '../lib/commissionPlans.js';
import { getTemplateSettingsForAgentId } from '../lib/revenueTemplates.js';

const router = Router();

const CRM_EXCLUDE = new Set(['raw_json']);

function omitKeys(row, exclude) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (!exclude.has(k)) out[k] = v;
  }
  return out;
}

function queryCsv(sql, params = [], { exclude, columns } = {}) {
  const rows = db.prepare(sql).all(...params);
  const mapped = exclude ? rows.map((r) => omitKeys(r, exclude)) : rows;
  return rowsToCsv(mapped, columns);
}

function computeRevenueRows() {
  const DEAL_SELECT = `
    SELECT t.id, t.address, t.city, t.state, t.zip, t.value, t.stage, t.representing, t.sale_type,
      t.close_date, t.listing_date, t.gross_commission, t.commission_custom_fees,
      t.commission_fee_overrides, t.agent_id, t.client_name, u.name as agent_name
    FROM transactions t
    LEFT JOIN users u ON u.id = t.agent_id
  `;

  const years = db.prepare(`
    SELECT DISTINCT CAST(strftime('%Y', close_date) AS INTEGER) as y
    FROM transactions
    WHERE close_date IS NOT NULL
      AND stage IN ('closed', 'pending')
    ORDER BY y ASC
  `).all().map((r) => r.y).filter(Boolean);

  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.push(currentYear);

  const out = [];

  for (const year of years) {
    const { start, end } = anniversaryWindowForEndYear(year);

    for (const stage of ['closed', 'pending']) {
      const deals = db.prepare(`
        ${DEAL_SELECT}
        WHERE t.stage = ?
          AND t.close_date >= ? AND t.close_date <= ?
        ORDER BY t.close_date ASC, t.id ASC
      `).all(stage, start, end);

      const groups = new Map();
      for (const deal of deals) {
        const key = deal.agent_id != null ? String(deal.agent_id) : 'none';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(deal);
      }

      for (const [, group] of groups) {
        const settings = getTemplateSettingsForAgentId(db, group[0]?.agent_id);
        const { results } = computeYearCommissions(group, 0, settings);
        for (const r of results) {
          const b = r.breakdown || {};
          out.push({
            anniversary_year: year,
            anniversary_start: start,
            anniversary_end: end,
            pipeline: stage === 'pending' ? 1 : 0,
            stage: r.stage,
            transaction_id: r.id,
            address: r.address,
            city: r.city,
            state: r.state,
            zip: r.zip,
            client_name: r.client_name,
            agent_id: r.agent_id,
            agent_name: r.agent_name,
            representing: r.representing,
            sale_type: r.sale_type,
            close_date: r.close_date,
            listing_date: r.listing_date,
            sales_price: r.value,
            gross_commission: r.gross_commission,
            has_gci: r.hasGci ? 1 : 0,
            plan: b.plan ?? '',
            gci: b.gci ?? '',
            exp_split: b.expSplit ?? '',
            post_split: b.postSplit ?? '',
            fixed_fees: b.fixedFees ?? '',
            team_splits: b.teamSplits ?? '',
            custom_fees: b.customSum ?? '',
            net: b.net ?? '',
            tessa: b.tessa ?? '',
            margaret: b.margaret ?? '',
          });
        }
      }
    }
  }

  return rowsToCsv(out);
}

function buildExportFiles() {
  const files = [
    {
      name: 'crm.csv',
      data: queryCsv('SELECT * FROM contacts ORDER BY id', [], { exclude: CRM_EXCLUDE }),
    },
    {
      name: 'vendors.csv',
      data: queryCsv(`
        SELECT v.*,
          cu.name as created_by_name,
          uu.name as updated_by_name,
          (SELECT COUNT(*) FROM vendor_likes vl WHERE vl.vendor_id = v.id AND IFNULL(vl.kind, 'like') = 'like') as like_count,
          (SELECT COUNT(*) FROM vendor_likes vl WHERE vl.vendor_id = v.id AND vl.kind = 'dislike') as dislike_count
        FROM vendors v
        LEFT JOIN users cu ON cu.id = v.created_by
        LEFT JOIN users uu ON uu.id = v.updated_by
        ORDER BY v.id
      `),
    },
    {
      name: 'vendor_likes.csv',
      data: queryCsv(`
        SELECT vl.id, vl.vendor_id, v.name as vendor_name, vl.user_id, u.name as user_name,
          vl.kind, vl.note, vl.created_at, vl.updated_at
        FROM vendor_likes vl
        LEFT JOIN vendors v ON v.id = vl.vendor_id
        LEFT JOIN users u ON u.id = vl.user_id
        ORDER BY vl.id
      `),
    },
    {
      name: 'transactions.csv',
      data: queryCsv(`
        SELECT t.*, u.name as agent_name
        FROM transactions t
        LEFT JOIN users u ON u.id = t.agent_id
        ORDER BY t.id
      `),
    },
    {
      name: 'transaction_parties.csv',
      data: queryCsv(`
        SELECT tp.*, t.address as transaction_address, u.name as user_name
        FROM transaction_parties tp
        LEFT JOIN transactions t ON t.id = tp.transaction_id
        LEFT JOIN users u ON u.id = tp.user_id
        ORDER BY tp.transaction_id, tp.sort_order, tp.id
      `),
    },
    {
      name: 'tasks.csv',
      data: queryCsv(`
        SELECT tk.*,
          u.name as assigned_to_name,
          t.address as transaction_address,
          tt.calendar_nickname as template_nickname,
          ct.name as checklist_template_name
        FROM tasks tk
        LEFT JOIN users u ON u.id = tk.assigned_to
        LEFT JOIN transactions t ON t.id = tk.transaction_id
        LEFT JOIN template_tasks tt ON tt.id = tk.template_task_id
        LEFT JOIN checklist_templates ct ON ct.id = tt.template_id
        ORDER BY tk.id
      `),
    },
    {
      name: 'checklist_templates.csv',
      data: queryCsv('SELECT * FROM checklist_templates ORDER BY sort_order, id'),
    },
    {
      name: 'checklist_template_tasks.csv',
      data: queryCsv(`
        SELECT tt.*, ct.name as template_name
        FROM template_tasks tt
        LEFT JOIN checklist_templates ct ON ct.id = tt.template_id
        ORDER BY tt.template_id, tt.sort_order, tt.id
      `),
    },
    {
      name: 'transaction_checklists.csv',
      data: queryCsv(`
        SELECT tc.transaction_id, t.address as transaction_address,
          tc.template_id, ct.name as template_name, tc.sort_order
        FROM transaction_checklists tc
        LEFT JOIN transactions t ON t.id = tc.transaction_id
        LEFT JOIN checklist_templates ct ON ct.id = tc.template_id
        ORDER BY tc.transaction_id, tc.sort_order
      `),
    },
    {
      name: 'revenue.csv',
      data: computeRevenueRows(),
    },
    {
      name: 'marketing_posts.csv',
      data: queryCsv(`
        SELECT mp.*, u.name as created_by_name
        FROM marketing_posts mp
        LEFT JOIN users u ON u.id = mp.created_by
        ORDER BY mp.scheduled_date, mp.id
      `),
    },
    {
      name: 'marketing_platform_goals.csv',
      data: queryCsv('SELECT * FROM marketing_platform_goals ORDER BY sort_order, id'),
    },
    {
      name: 'projects.csv',
      data: queryCsv(`
        SELECT p.*, u.name as owner_name
        FROM projects p
        LEFT JOIN users u ON u.id = p.user_id
        ORDER BY p.id
      `),
    },
    {
      name: 'project_checklist_items.csv',
      data: queryCsv(`
        SELECT pci.*, p.title as project_title, u.name as owner_name
        FROM project_checklist_items pci
        LEFT JOIN projects p ON p.id = pci.project_id
        LEFT JOIN users u ON u.id = p.user_id
        ORDER BY pci.project_id, pci.sort_order, pci.id
      `),
    },
    {
      name: 'user_todos.csv',
      data: queryCsv(`
        SELECT ut.*, u.name as user_name
        FROM user_todos ut
        LEFT JOIN users u ON u.id = ut.user_id
        ORDER BY ut.user_id, ut.sort_order, ut.id
      `),
    },
    {
      name: 'opportunity_buyers.csv',
      data: queryCsv(`
        SELECT ob.*, u.name as agent_name
        FROM opportunity_buyers ob
        LEFT JOIN users u ON u.id = ob.agent_id
        ORDER BY ob.id
      `),
    },
    {
      name: 'opportunity_sellers.csv',
      data: queryCsv(`
        SELECT os.*, u.name as agent_name
        FROM opportunity_sellers os
        LEFT JOIN users u ON u.id = os.agent_id
        ORDER BY os.id
      `),
    },
    {
      name: 'feedback.csv',
      data: queryCsv(`
        SELECT h.*,
          cu.name as created_by_name,
          uu.name as updated_by_name
        FROM hub_doc_items h
        LEFT JOIN users cu ON cu.id = h.created_by
        LEFT JOIN users uu ON uu.id = h.updated_by
        ORDER BY h.section, h.sort_order, h.id
      `),
    },
    {
      name: 'team_messages.csv',
      data: queryCsv(`
        SELECT tm.*, u.name as user_name
        FROM team_messages tm
        LEFT JOIN users u ON u.id = tm.user_id
        ORDER BY tm.id
      `),
    },
    {
      name: 'team_links.csv',
      data: queryCsv('SELECT * FROM team_links ORDER BY sort_order, id'),
    },
    {
      name: 'users.csv',
      data: queryCsv(`
        SELECT id, name, email, role, created_at
        FROM users
        ORDER BY id
      `),
    },
  ];

  return files;
}

router.get('/zip', (_req, res) => {
  try {
    const files = buildExportFiles();
    const zip = buildZip(files);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="heyday-export-${stamp}.zip"`);
    res.setHeader('Content-Length', zip.length);
    res.send(zip);
  } catch (err) {
    console.error('[export] Failed to build zip:', err);
    res.status(500).json({ error: err.message || 'Export failed' });
  }
});

router.get('/manifest', (_req, res) => {
  res.json({
    files: [
      'crm.csv',
      'vendors.csv',
      'vendor_likes.csv',
      'transactions.csv',
      'transaction_parties.csv',
      'tasks.csv',
      'checklist_templates.csv',
      'checklist_template_tasks.csv',
      'transaction_checklists.csv',
      'revenue.csv',
      'marketing_posts.csv',
      'marketing_platform_goals.csv',
      'projects.csv',
      'project_checklist_items.csv',
      'user_todos.csv',
      'opportunity_buyers.csv',
      'opportunity_sellers.csv',
      'feedback.csv',
      'team_messages.csv',
      'team_links.csv',
      'users.csv',
    ],
  });
});

export default router;
