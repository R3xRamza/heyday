import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ListChecks, Plus } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';
import DateText from '../components/shared/DateText';
import { formatCurrency, parseTransactionAddress } from '../utils/format';
import PriceInput from '../components/shared/PriceInput';
import { validateTransactionFields } from '../constants/transactionForm';

const FILTERS = [
  { key: 'all', label: 'All Transactions' },
  { key: 'active', label: 'Active Escrow' },
  { key: 'pending', label: 'Pre-Listing' },
  { key: 'escrow', label: 'Closing Soon' },
];

const STAGE_LABELS = {
  active: 'Active Escrow',
  pending: 'Pre-Listing',
  closed: 'Closed',
};

export default function TransactionsList() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ transactions: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ address: '', city: '', state: '', zip: '', value: '', client_name: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ filter });
    if (search) params.set('search', search);
    const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
    setData(await res.json());
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(fetchData, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchData, search]);

  async function handleCreate(e) {
    e.preventDefault();
    const validation = validateTransactionFields({
      ...form,
      representing: 'seller_and_buyer',
    });
    if (!validation.ok) {
      setCreateError(validation.message);
      return;
    }
    setCreateError('');
    setCreating(true);
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...form,
        value: form.value != null && form.value !== '' ? Number(form.value) : null,
      }),
    });
    const json = await res.json();
    setCreating(false);
    if (res.ok) {
      setShowCreate(false);
      setCreateError('');
      navigate(`/transactions/${json.transaction.id}`);
    } else {
      setCreateError(json.error || 'Could not create transaction.');
    }
  }

  const { stats } = data;
  const volume = stats?.volume || 0;

  return (
    <DashboardLayout title="Transaction Portfolio" className="bg-surface">
      <div className="max-w-[1440px] mx-auto px-8 py-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-semibold text-primary tracking-tight">Transaction Portfolio</h1>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mt-1">
              Enterprise Command Center
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/checklists"
              className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest border border-outline-variant/30 text-primary text-xs font-semibold uppercase tracking-wider hover:bg-surface-container-high"
            >
              <ListChecks size={18} /> Edit Checklists
            </Link>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-6 py-3 bg-primary-container text-white text-xs font-semibold uppercase tracking-wider hover:brightness-110"
            >
              <Plus size={18} /> New Transaction
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Total Volume', value: formatCurrency(volume), sub: `${stats?.count || 0} properties` },
            { label: 'Active Escrows', value: stats?.active_count || 0, sub: 'Properties' },
            { label: 'Pending Closings', value: stats?.pending_count || 0, sub: 'In pipeline' },
            { label: 'Avg Deal Size', value: stats?.count ? formatCurrency(volume / stats.count) : '—', sub: 'Per transaction' },
          ].map((m) => (
            <div key={m.label} className="bg-white border border-outline-variant/20 p-6 shadow-executive">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">{m.label}</p>
              <h2 className="text-3xl font-bold text-primary">{m.value}</h2>
              <p className="text-xs text-on-surface-variant mt-1">{m.sub}</p>
            </div>
          ))}
        </div>

        <nav className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-6 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
                filter === f.key ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {f.label}
            </button>
          ))}
        </nav>

        <div className="bg-white border border-outline-variant/20 shadow-executive overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/30">
                  {['Property', 'Lead Agent', 'Transaction Stage', 'Value', 'Est. Closing', ''].map((h) => (
                    <th key={h} className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">Loading…</td></tr>
                ) : data.transactions.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">No transactions yet. Create one to get started.</td></tr>
                ) : (
                  data.transactions.map((tx) => {
                    const { street, cityLine } = parseTransactionAddress({
                      address: tx.address,
                      city: tx.city,
                      state: tx.state,
                      zip: tx.zip,
                    });
                    return (
                    <tr
                      key={tx.id}
                      onClick={() => navigate(`/transactions/${tx.id}`)}
                      className="hover:bg-secondary/5 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-primary">{street}</p>
                          <p className="text-xs text-on-surface-variant">
                            {cityLine || tx.client_name || tx.owner_name}
                          </p>
                          {tx.workflow_status && tx.workflow_status !== 'active' && (
                            <span className="text-[10px] text-lemon bg-feather-alt/80 px-2 py-0.5 rounded mt-1 inline-block uppercase">
                              Setup: {tx.workflow_status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">{tx.agent_name || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-secondary-container/30 text-secondary text-xs font-semibold rounded-full">
                          {STAGE_LABELS[tx.stage] || tx.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold">{formatCurrency(tx.value)}</td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap min-w-[9.5rem]">
                        {tx.close_date ? <DateText value={tx.close_date} /> : tx.important_date ? <DateText value={tx.important_date} /> : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ArrowRight size={18} className="text-on-surface-variant group-hover:text-primary inline" />
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant/30 text-xs text-on-surface-variant">
            Showing {data.transactions.length} properties · {formatCurrency(volume)} total volume
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-primary">Step 1 — Create Transaction</h2>
            <p className="text-sm text-on-surface-variant">Enter the property address to begin. You&apos;ll add full details next.</p>
            {createError && (
              <p className="text-sm text-error font-medium bg-error/10 border border-error/20 rounded-lg px-3 py-2" role="alert">
                {createError}
              </p>
            )}
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Address *</label>
              <input required value={form.address} onChange={(e) => { setCreateError(''); setForm({ ...form, address: e.target.value }); }}
                className="w-full px-3 py-2 border border-outline-variant/40 rounded text-sm" placeholder="1245 Skyline Ridge Dr" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">City *</label>
                <input required value={form.city} onChange={(e) => { setCreateError(''); setForm({ ...form, city: e.target.value }); }}
                  className="w-full px-3 py-2 border border-outline-variant/40 rounded text-sm" placeholder="Austin" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">State *</label>
                <input required value={form.state} onChange={(e) => { setCreateError(''); setForm({ ...form, state: e.target.value }); }}
                  className="w-full px-3 py-2 border border-outline-variant/40 rounded text-sm" placeholder="TX" maxLength={2} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">ZIP *</label>
                <input required value={form.zip} onChange={(e) => { setCreateError(''); setForm({ ...form, zip: e.target.value }); }}
                  className="w-full px-3 py-2 border border-outline-variant/40 rounded text-sm" placeholder="78746" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Sales Price</label>
                <PriceInput
                  value={form.value}
                  onChange={(v) => setForm({ ...form, value: v })}
                  className="w-full px-3 py-2 border border-outline-variant/40 rounded text-sm"
                  placeholder="3,450,000"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Client Name</label>
                <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  className="w-full px-3 py-2 border border-outline-variant/40 rounded text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-on-surface-variant">Cancel</button>
              <button type="submit" disabled={creating} className="px-4 py-2 bg-lemon text-feather font-bold rounded text-sm">
                {creating ? 'Creating…' : 'Continue →'}
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
