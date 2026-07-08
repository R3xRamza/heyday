import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ListChecks, Plus } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import DateText from '../components/shared/DateText';
import { formatCurrency, parseTransactionAddress } from '../utils/format';
import PriceInput from '../components/shared/PriceInput';
import AddressAutocomplete from '../components/shared/AddressAutocomplete';
import { blurActiveElement, CHROME_AUTOCOMPLETE, ChromeAddressDecoy } from '../components/shared/chromeFormGuards';
import { validateTransactionFields, transactionPortfolioType, isPrivateListing } from '../constants/transactionForm';
import PrivateListingFlag from '../components/transactions/PrivateListingFlag';
import ListPagination from '../components/shared/ListPagination';
import { useAgentScope } from '../context/AgentScopeContext';
import { appendAgentScope } from '../utils/agentScope';

const PAGE_SIZE = 50;

const FILTERS = [
  { key: 'active_transactions', label: 'Active Transactions' },
  { key: 'coming_soon', label: 'Coming Soon' },
  { key: 'current_listings', label: 'Current Listings' },
  { key: 'pending', label: 'Pending' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All Transactions' },
];

const VALID_FILTER_KEYS = new Set(FILTERS.map((f) => f.key));

const KPI_CARDS = [
  { key: 'listings', label: 'Listings', value: (s) => s?.listings_count ?? 0, sub: 'On market' },
  { key: 'comingSoon', label: 'Coming Soon', value: (s) => s?.pre_listings_count ?? 0, sub: 'Future listings' },
  { key: 'pending', label: 'Pending', value: (s) => s?.pending_count ?? 0, sub: 'Under contract' },
];

const VOLUME_BOX_BY_FILTER = {
  active_transactions: { label: 'Active Volume', sub: (n) => `${n} active` },
  all: { label: 'Total Volume', sub: (n) => `${n} propert${n === 1 ? 'y' : 'ies'}` },
  current_listings: { label: 'Listing Volume', sub: (n) => `${n} on market` },
  coming_soon: { label: 'Coming Soon Volume', sub: (n) => `${n} future listing${n === 1 ? '' : 's'}` },
  pending: { label: 'Total Pending Volume', sub: (n) => `${n} under contract` },
  closed: { label: 'Closed YTD', sub: (n) => `${n} closing${n === 1 ? '' : 's'}` },
};

const FOOTER_VOLUME_LABEL = {
  active_transactions: 'active volume',
  all: 'total volume',
  current_listings: 'listing volume',
  coming_soon: 'coming soon volume',
  pending: 'total pending volume',
  closed: 'closed YTD',
};

function filterVolume(stats, filter) {
  if (filter === 'closed') {
    return {
      volume: stats?.closedYtd?.volume ?? 0,
      count: stats?.closedYtd?.count ?? 0,
    };
  }
  return {
    volume: stats?.filtered?.volume ?? 0,
    count: stats?.filtered?.count ?? 0,
  };
}

const DATE_COLUMN_BY_FILTER = {
  active_transactions: { label: 'Creation Date', field: 'created_at' },
  all: { label: 'Creation Date', field: 'created_at' },
  current_listings: { label: 'Listing Date', field: 'listing_date' },
  coming_soon: { label: 'Listing Date', field: 'listing_date' },
  pending: { label: 'Closing Date', field: 'close_date' },
  closed: { label: 'Closing Date', field: 'close_date' },
};

const SORTABLE_COLUMNS = [
  { key: 'address', label: 'Address' },
  { key: 'type', label: 'Type' },
  { key: 'value', label: 'Price' },
  { key: 'date', label: null },
  { key: 'agent', label: 'Agent' },
];

function transactionDateValue(tx, field) {
  const raw = tx[field];
  if (!raw) return '';
  return String(raw).slice(0, 10);
}

function portfolioTypeBadgeClass(tx) {
  const type = transactionPortfolioType(tx);
  if (type === 'Coming Soon') return 'bg-lemon text-feather';
  if (type === 'Closed') return 'bg-secondary/20 text-secondary';
  if (type === 'Pending') return 'bg-tertiary-container/50 text-feather';
  if (type === 'Active listing') return 'bg-sky text-feather';
  return 'bg-secondary-container/50 text-secondary';
}

function emptyFilterMessage(filter) {
  switch (filter) {
    case 'coming_soon': return 'No coming soon listings.';
    case 'current_listings': return 'No current listings.';
    case 'pending': return 'No pending transactions.';
    case 'closed': return 'No closed transactions.';
    case 'all': return 'No transactions yet.';
    default: return 'No active transactions yet.';
  }
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-outline-variant/20 p-4 shadow-executive rounded-lg">
      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">{label}</p>
      <h2 className="text-xl font-bold text-primary leading-tight">{value}</h2>
      <p className="text-xs text-on-surface-variant mt-1">{sub}</p>
    </div>
  );
}

export default function TransactionsList() {
  const navigate = useNavigate();
  const { scope } = useAgentScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const resolvedFilter = filterParam === 'all_listings' ? 'coming_soon' : filterParam;
  const filter = VALID_FILTER_KEYS.has(resolvedFilter) ? resolvedFilter : 'active_transactions';

  const [search, setSearch] = useState('');
  const [data, setData] = useState({ transactions: [], stats: {}, total: 0 });
  const [loadedFilter, setLoadedFilter] = useState(filter);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ address: '', city: '', state: '', zip: '', value: '', client_name: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const fetchIdRef = useRef(0);

  const dateColumn = DATE_COLUMN_BY_FILTER[filter] || DATE_COLUMN_BY_FILTER.all;
  const statsFilter = refreshing ? loadedFilter : filter;

  function handleFilterChange(key) {
    setPage(1);
    if (key === 'active_transactions') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ filter: key }, { replace: true });
    }
  }

  useEffect(() => {
    setPage(1);
    setSortKey('date');
    setSortDir('desc');
  }, [filter]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  function handleSort(key) {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const transactions = data.transactions || [];

  const fetchData = useCallback(async () => {
    const requestedFilter = filter;
    const fetchId = ++fetchIdRef.current;
    setRefreshing(true);
    const params = new URLSearchParams({
      filter: requestedFilter,
      page: String(page),
      limit: String(PAGE_SIZE),
      sort: sortKey,
      order: sortDir,
    });
    if (search) params.set('search', search);
    appendAgentScope(params, scope);
    try {
      const res = await fetch(`/api/transactions?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (fetchId !== fetchIdRef.current) return;
      setData(json);
      setLoadedFilter(requestedFilter);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filter, search, page, sortKey, sortDir, scope]);

  useEffect(() => {
    const t = setTimeout(fetchData, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchData, search]);

  async function handleCreate() {
    const validation = validateTransactionFields(form);
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
      blurActiveElement();
      setShowCreate(false);
      setCreateError('');
      navigate(`/transactions/${json.transaction.id}`);
    } else {
      setCreateError(json.error || 'Could not create transaction.');
    }
  }

  const { stats } = data;
  const { volume, count: filterCount } = filterVolume(stats, statsFilter);
  const volumeBox = VOLUME_BOX_BY_FILTER[statsFilter] || VOLUME_BOX_BY_FILTER.all;
  const footerVolumeLabel = FOOTER_VOLUME_LABEL[statsFilter] || FOOTER_VOLUME_LABEL.all;
  const showInitialLoading = loading && data.transactions.length === 0;

  return (
    <DashboardLayout title="Transactions" className="bg-surface">
      <div className="max-w-[1440px] mx-auto px-8 py-6">
        <header className="flex justify-end mb-6 gap-4">
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
        </header>

        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10 transition-opacity ${refreshing ? 'opacity-70' : ''}`}>
          {KPI_CARDS.map((card) => (
            <StatCard
              key={card.key}
              label={card.label}
              value={card.value(stats)}
              sub={card.sub}
            />
          ))}
          <StatCard
            label={volumeBox.label}
            value={formatCurrency(volume)}
            sub={volumeBox.sub(filterCount)}
          />
        </div>

        <nav className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => handleFilterChange(f.key)}
              className={`px-6 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
                filter === f.key ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {f.label}
            </button>
          ))}
        </nav>

        <div className="bg-white border border-outline-variant/20 shadow-executive overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/30">
                  {SORTABLE_COLUMNS.map((col) => {
                    const label = col.key === 'date' ? dateColumn.label : col.label;
                    return (
                      <th
                        key={col.key}
                        className={`px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-widest cursor-pointer select-none hover:text-primary ${
                          col.key === 'type' ? 'whitespace-nowrap' : ''
                        }`}
                        onClick={() => handleSort(col.key)}
                      >
                        {label}
                        {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                      </th>
                    );
                  })}
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-widest" aria-hidden />
                </tr>
              </thead>
              <tbody className={`divide-y divide-outline-variant/10 transition-opacity ${refreshing ? 'opacity-50' : ''}`}>
                {showInitialLoading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">Loading…</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">{emptyFilterMessage(filter)}</td></tr>
                ) : (
                  transactions.map((tx) => {
                    const { street, cityLine } = parseTransactionAddress({
                      address: tx.address,
                      city: tx.city,
                      state: tx.state,
                      zip: tx.zip,
                    });
                    const dateValue = transactionDateValue(tx, dateColumn.field);
                    return (
                    <tr
                      key={tx.id}
                      onClick={() => navigate(`/transactions/${tx.id}`)}
                      className="hover:bg-secondary/5 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-primary">{street}</p>
                            {isPrivateListing(tx) && <PrivateListingFlag />}
                          </div>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${portfolioTypeBadgeClass(tx)}`}>
                          {transactionPortfolioType(tx)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold">{formatCurrency(tx.value)}</td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap min-w-[9.5rem]">
                        {dateValue ? <DateText value={dateValue} /> : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm">{tx.agent_name || '—'}</td>
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
          <div className={`px-6 py-4 bg-surface-container-low border-t border-outline-variant/30 text-xs text-on-surface-variant transition-opacity ${refreshing ? 'opacity-70' : ''}`}>
            Showing {transactions.length} of {(data.total ?? 0).toLocaleString()}
            {' '}
            {statsFilter === 'closed'
              ? `closed transaction${data.total === 1 ? '' : 's'}`
              : `propert${data.total === 1 ? 'y' : 'ies'}`}
            {' · '}
            {formatCurrency(volume)} {footerVolumeLabel}
          </div>
          <ListPagination
            page={page}
            total={data.total ?? 0}
            onPageChange={setPage}
          />
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 relative"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                handleCreate();
              }
            }}
          >
            <ChromeAddressDecoy />
            <h2 className="text-lg font-bold text-primary">Step 1 — Create Transaction</h2>
            <p className="text-sm text-on-surface-variant">Enter the property address to begin. You&apos;ll add full details next.</p>
            {createError && (
              <p className="text-sm text-error font-medium bg-error/10 border border-error/20 rounded-lg px-3 py-2" role="alert">
                {createError}
              </p>
            )}
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Address *</label>
              <AddressAutocomplete
                required
                value={form.address}
                onChange={(address) => { setCreateError(''); setForm({ ...form, address }); }}
                onAddressSelect={(fields) => { setCreateError(''); setForm({ ...form, ...fields }); }}
                className="w-full px-3 py-2 border border-outline-variant/40 rounded text-sm"
                placeholder="Start typing an address…"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">City *</label>
                <input required value={form.city} onChange={(e) => { setCreateError(''); setForm({ ...form, city: e.target.value }); }}
                  autoComplete={CHROME_AUTOCOMPLETE}
                  className="w-full px-3 py-2 border border-outline-variant/40 rounded text-sm" placeholder="Austin" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">State *</label>
                <input required value={form.state} onChange={(e) => { setCreateError(''); setForm({ ...form, state: e.target.value }); }}
                  autoComplete={CHROME_AUTOCOMPLETE}
                  className="w-full px-3 py-2 border border-outline-variant/40 rounded text-sm" placeholder="TX" maxLength={2} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">ZIP *</label>
                <input required value={form.zip} onChange={(e) => { setCreateError(''); setForm({ ...form, zip: e.target.value }); }}
                  autoComplete={CHROME_AUTOCOMPLETE}
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
                  autoComplete={CHROME_AUTOCOMPLETE}
                  className="w-full px-3 py-2 border border-outline-variant/40 rounded text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-on-surface-variant">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={creating} className="px-4 py-2 bg-lemon text-feather font-bold rounded text-sm">
                {creating ? 'Creating…' : 'Continue →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
