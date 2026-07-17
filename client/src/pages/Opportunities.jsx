import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import AgentScopeToggle from '../components/AgentScopeToggle';
import { useAgentScope } from '../context/AgentScopeContext';
import { appendAgentScope } from '../utils/agentScope';
import {
  BUYER_STATUSES,
  buyerStatusLabel,
} from '../utils/buyerOpportunity';
import BuyerOpportunitiesTable from '../components/opportunities/BuyerOpportunitiesTable';
import SellerOpportunitiesTable from '../components/opportunities/SellerOpportunitiesTable';
import OpportunityBuyerCards from '../components/opportunities/OpportunityBuyerCards';
import OpportunitySellerCards from '../components/opportunities/OpportunitySellerCards';
import OpportunityForm from '../components/opportunities/OpportunityForm';
import OpportunityKpis from '../components/opportunities/OpportunityKpis';

const TAB_KEY = 'opportunities-tab-v1';

function loadTab() {
  try {
    const v = sessionStorage.getItem(TAB_KEY);
    if (v === 'sellers' || v === 'buyers') return v;
  } catch {
    // ignore
  }
  return 'buyers';
}

export default function Opportunities() {
  const { scope } = useAgentScope();
  const [tab, setTab] = useState(loadTab);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_KEY, tab);
    } catch {
      // ignore
    }
  }, [tab]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    const path = tab === 'buyers' ? '/api/opportunities/buyers' : '/api/opportunities/sellers';
    const url = appendAgentScope(`${path}?${params.toString()}`, scope);
    try {
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      setRows(tab === 'buyers' ? (json.buyers || []) : (json.sellers || []));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, scope, search, statusFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const [allForPills, setAllForPills] = useState([]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    const path = tab === 'buyers' ? '/api/opportunities/buyers' : '/api/opportunities/sellers';
    const url = appendAgentScope(`${path}?${params.toString()}`, scope);
    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        setAllForPills(tab === 'buyers' ? (json.buyers || []) : (json.sellers || []));
      })
      .catch(() => setAllForPills([]));
  }, [tab, scope, search]);

  const statusOptions = useMemo(() => {
    if (tab === 'buyers') {
      // Always show the four canonical statuses for buyers
      return BUYER_STATUSES.map((s) => s.value);
    }
    const set = new Set();
    for (const r of allForPills) {
      const s = String(r.status || '').trim();
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [tab, allForPills]);

  function switchTab(next) {
    setTab(next);
    setStatusFilter('');
    setEditing(null);
    setFormOpen(false);
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setFormOpen(true);
  }

  async function handleSave(payload) {
    const kind = tab === 'buyers' ? 'buyers' : 'sellers';
    const isEdit = Boolean(editing?.id);
    const url = appendAgentScope(
      isEdit ? `/api/opportunities/${kind}/${editing.id}` : `/api/opportunities/${kind}`,
      scope,
    );
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Save failed');
    }
    setFormOpen(false);
    setEditing(null);
    await fetchRows();
  }

  async function handlePatchBuyer(id, fields) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)));
    const url = appendAgentScope(`/api/opportunities/buyers/${id}`, scope);
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      await fetchRows();
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (json.buyer) {
      setRows((prev) => prev.map((r) => (r.id === id ? json.buyer : r)));
      setAllForPills((prev) => prev.map((r) => (r.id === id ? json.buyer : r)));
    }
  }

  async function handleDelete(row) {
    const label = tab === 'buyers' ? row.buyer_name : row.property_address;
    if (!window.confirm(`Delete opportunity for ${label || 'this row'}?`)) return;
    const kind = tab === 'buyers' ? 'buyers' : 'sellers';
    const url = appendAgentScope(`/api/opportunities/${kind}/${row.id}`, scope);
    const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      window.alert('Delete failed');
      return;
    }
    setFormOpen(false);
    setEditing(null);
    await fetchRows();
  }

  const tabBtn = (active) =>
    `flex-1 md:flex-none min-h-11 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
      active
        ? 'bg-primary text-white'
        : 'text-on-surface-variant hover:bg-surface-container-low'
    }`;

  return (
    <DashboardLayout
      title="Opportunities"
      subtitle="Buyer & seller pipelines"
      headerRight={<AgentScopeToggle />}
      className="bg-surface"
    >
      <div className="w-full px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <header className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 mb-5">
          <div className="flex w-full md:w-auto rounded-lg border border-outline-variant/30 overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => switchTab('buyers')}
              className={tabBtn(tab === 'buyers')}
            >
              Buyers
            </button>
            <button
              type="button"
              onClick={() => switchTab('sellers')}
              className={tabBtn(tab === 'sellers')}
            >
              Sellers
            </button>
          </div>

          <div className="relative w-full md:flex-1 md:min-w-[12rem] md:max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'buyers' ? 'Search buyers…' : 'Search sellers…'}
              aria-label="Search opportunities"
              className="w-full min-h-11 pl-9 pr-9 py-2.5 bg-white border border-outline-variant/30 rounded-lg text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-secondary/25"
            />
            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded text-on-surface-variant hover:text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={openNew}
            className="w-full md:w-auto md:ml-auto flex items-center justify-center gap-2 min-h-11 px-5 py-2.5 bg-primary-container text-white text-xs font-semibold uppercase tracking-wider hover:brightness-110"
          >
            <Plus size={16} /> New
          </button>
        </header>

        <OpportunityKpis items={allForPills} kind={tab === 'buyers' ? 'buyer' : 'seller'} />

        {statusOptions.length > 0 && (
          <nav className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              className={`shrink-0 min-h-10 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
                !statusFilter ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              All
            </button>
            {statusOptions.map((s) => {
              const label = tab === 'buyers' ? buyerStatusLabel(s) : s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`shrink-0 min-h-10 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors max-w-[14rem] truncate ${
                    statusFilter === s
                      ? 'bg-primary text-white'
                      : 'text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                  title={label}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        )}

        {loading && rows.length === 0 ? (
          <p className="text-sm text-on-surface-variant py-12 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="py-12 md:py-16 px-4 text-center border border-dashed border-outline-variant/30 rounded-xl bg-white">
            <p className="text-sm text-on-surface-variant mb-4">
              No {tab === 'buyers' ? 'buyer' : 'seller'} opportunities
              {search || statusFilter ? ' match these filters' : ' for this agent yet'}.
            </p>
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center justify-center gap-2 min-h-11 px-5 py-2.5 bg-primary-container text-white text-xs font-semibold uppercase tracking-wider hover:brightness-110"
            >
              <Plus size={16} /> New Opportunity
            </button>
          </div>
        ) : tab === 'buyers' ? (
          <>
            <OpportunityBuyerCards rows={rows} onEdit={openEdit} />
            <BuyerOpportunitiesTable rows={rows} onEdit={openEdit} onPatch={handlePatchBuyer} />
          </>
        ) : (
          <>
            <OpportunitySellerCards rows={rows} onEdit={openEdit} onDelete={handleDelete} />
            <SellerOpportunitiesTable rows={rows} onEdit={openEdit} onDelete={handleDelete} />
          </>
        )}
      </div>

      {formOpen && (
        <OpportunityForm
          kind={tab === 'buyers' ? 'buyer' : 'seller'}
          initial={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
        />
      )}
    </DashboardLayout>
  );
}
