import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';
import ListPagination from '../components/shared/ListPagination';
import DateText from '../components/shared/DateText';
import { useGmailSync } from '../context/GmailSyncContext';

const HIGHLIGHT_STAGES = [
  { key: 'Sphere', label: 'Sphere' },
  { key: 'Closed', label: 'Closed' },
  { key: 'Client: Actively Working', label: 'Active Clients' },
  { key: 'Hot Prospect (0-3 months)', label: 'Hot Prospects' },
  { key: 'Lead', label: 'Leads' },
];

function stageBadgeClass(stage) {
  if (!stage) return 'bg-outline-variant/20 text-on-surface-variant';
  if (stage === 'Closed') return 'bg-secondary text-white border-secondary';
  if (stage === 'Sphere') return 'bg-secondary-container/20 text-secondary border-secondary-container/30';
  if (stage.includes('Hot Prospect') || stage.includes('Actively Working')) {
    return 'bg-primary-container/10 text-primary-container border-primary-container/20';
  }
  if (stage.includes('Lost') || stage.includes('Dead')) return 'bg-error/10 text-error border-error/20';
  return 'bg-outline-variant/20 text-on-surface-variant border-outline-variant/30';
}

function propertyLine(c) {
  return c.property_address || [c.street, c.city, c.state].filter(Boolean).join(', ') || '—';
}

export default function CRMHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { fetchStatus } = useGmailSync();

  useEffect(() => {
    const gmail = searchParams.get('gmail');
    if (gmail) {
      fetchStatus();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, fetchStatus]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stage, setStage] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [isContacted, setIsContacted] = useState('');
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ contacts: [], total: 0, stats: {} });
  const [filterOptions, setFilterOptions] = useState({ stages: [], leadSources: [], assigned: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetch('/api/crm/filters', { credentials: 'include' })
      .then((r) => r.json())
      .then(setFilterOptions);
  }, []);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (stage) params.set('stage', stage);
    if (leadSource) params.set('lead_source', leadSource);
    if (assignedTo) params.set('assigned_to', assignedTo);
    if (isContacted !== '') params.set('is_contacted', isContacted);
    if (tag) params.set('tag', tag);

    const res = await fetch(`/api/crm?${params}`, { credentials: 'include' });
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [page, debouncedSearch, stage, leadSource, assignedTo, isContacted, tag]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const highlights = data.stats?.stageHighlights || {};

  return (
    <DashboardLayout title="CRM Hub" className="p-8">
      <div className="max-w-[1440px] mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-5 rounded-xl border border-outline-variant/10 shadow-executive">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Total Contacts</p>
            <h2 className="text-2xl font-bold text-primary-container">{data.stats?.total?.toLocaleString() ?? '—'}</h2>
          </div>
          {HIGHLIGHT_STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => { setStage(stage === s.key ? '' : s.key); setPage(1); }}
              className={`bg-white p-5 rounded-xl border text-left shadow-executive transition-colors ${
                stage === s.key ? 'border-secondary ring-2 ring-secondary/20' : 'border-outline-variant/10 hover:border-secondary/30'
              }`}
            >
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-1 truncate">{s.label}</p>
              <h2 className="text-2xl font-bold text-primary-container">{highlights[s.key]?.toLocaleString() ?? 0}</h2>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-outline-variant/10 p-4 shadow-executive space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-[2] min-w-[20rem] relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone, tags, address, notes…"
                className="w-full pl-10 pr-4 py-2.5 border border-outline-variant/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </div>
            <select
              value={stage}
              onChange={(e) => { setStage(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-outline-variant/30 rounded-lg text-sm min-w-[160px]"
            >
              <option value="">All stages</option>
              {filterOptions.stages?.map((s) => (
                <option key={s.value} value={s.value}>{s.value} ({s.count})</option>
              ))}
            </select>
            <select
              value={leadSource}
              onChange={(e) => { setLeadSource(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-outline-variant/30 rounded-lg text-sm min-w-[140px] max-w-[200px]"
            >
              <option value="">All lead sources</option>
              {filterOptions.leadSources?.map((s) => (
                <option key={s.value} value={s.value}>{s.value}</option>
              ))}
            </select>
            <select
              value={assignedTo}
              onChange={(e) => { setAssignedTo(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-outline-variant/30 rounded-lg text-sm min-w-[140px]"
            >
              <option value="">All assigned</option>
              {filterOptions.assigned?.map((s) => (
                <option key={s.value} value={s.value}>{s.value}</option>
              ))}
            </select>
            <select
              value={isContacted}
              onChange={(e) => { setIsContacted(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-outline-variant/30 rounded-lg text-sm"
            >
              <option value="">Contacted: All</option>
              <option value="1">Contacted: Yes</option>
              <option value="0">Contacted: No</option>
            </select>
            <input
              type="text"
              value={tag}
              onChange={(e) => { setTag(e.target.value); setPage(1); }}
              placeholder="Tag contains…"
              className="px-3 py-2 border border-outline-variant/30 rounded-lg text-sm w-36"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>
              {loading ? 'Loading…' : `${data.total?.toLocaleString()} contacts`}
              {(stage || leadSource || assignedTo || debouncedSearch || tag || isContacted !== '') && ' (filtered)'}
            </span>
            {(stage || leadSource || assignedTo || debouncedSearch || tag || isContacted !== '') && (
              <button
                type="button"
                onClick={() => {
                  setStage('');
                  setLeadSource('');
                  setAssignedTo('');
                  setIsContacted('');
                  setTag('');
                  setSearch('');
                  setPage(1);
                }}
                className="text-secondary font-semibold hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-outline-variant/10 overflow-hidden shadow-executive">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-surface-container-low border-b border-outline-variant/10">
                <tr>
                  {['Client', 'Stage', 'Last Contact', 'Assigned To', 'Property / Address', 'Tags', ''].map((h) => (
                    <th key={h} className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant">Loading contacts…</td></tr>
                ) : data.contacts.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant">No contacts match your search.</td></tr>
                ) : (
                  data.contacts.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/crm/${c.id}`)}
                      className="hover:bg-primary-container/5 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm text-primary">{c.name}</p>
                        <p className="text-[11px] text-on-surface-variant truncate max-w-[220px]">{c.email || c.phone || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border max-w-[180px] truncate ${stageBadgeClass(c.stage)}`}>
                          {c.stage || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-on-surface-variant whitespace-nowrap min-w-[9.5rem]">
                        <DateText value={c.last_contacted} />
                      </td>
                      <td className="px-6 py-4 text-[13px]">{c.assigned_to_name || c.assigned_user_name || '—'}</td>
                      <td className="px-6 py-4 text-[13px] font-medium max-w-[200px] truncate">{propertyLine(c)}</td>
                      <td className="px-6 py-4 text-[11px] text-on-surface-variant max-w-[160px] truncate">{c.tags || '—'}</td>
                      <td className="px-6 py-4 text-right">
                        <Icon name="chevron_right" className="text-outline group-hover:text-primary transition-colors" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <ListPagination page={page} total={data.total ?? 0} onPageChange={setPage} />
        </div>
      </div>
    </DashboardLayout>
  );
}
