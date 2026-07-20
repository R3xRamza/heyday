import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import CrmHubTabs from '../components/crm/CrmHubTabs';
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

const selectClass =
  'px-3 py-2 border border-outline-variant/25 rounded-lg text-sm bg-white min-w-0 focus:outline-none focus:ring-2 focus:ring-secondary/30';

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
  const hasFilters = !!(stage || leadSource || assignedTo || debouncedSearch || tag || isContacted !== '');

  function clearFilters() {
    setStage('');
    setLeadSource('');
    setAssignedTo('');
    setIsContacted('');
    setTag('');
    setSearch('');
    setPage(1);
  }

  return (
    <DashboardLayout title="CRM Hub" headerRight={<CrmHubTabs />} className="p-6 lg:p-8">
      <div className="w-full space-y-5">
        {/* Stage highlight strip — horizontal scroll on narrow, flex wrap on wide */}
        <div className="flex gap-3 overflow-x-auto pb-1 custom-scrollbar">
          <div className="shrink-0 min-w-[8.5rem] flex-1 basis-[8.5rem] max-w-[12rem] rounded-xl border border-outline-variant/15 bg-gradient-to-br from-primary-container/10 to-white px-4 py-3.5">
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">
              Total Contacts
            </p>
            <p className="text-2xl font-bold text-primary-container tabular-nums">
              {data.stats?.total?.toLocaleString() ?? '—'}
            </p>
          </div>
          {HIGHLIGHT_STAGES.map((s) => {
            const active = stage === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setStage(active ? '' : s.key);
                  setPage(1);
                }}
                className={`shrink-0 min-w-[8.5rem] flex-1 basis-[8.5rem] max-w-[12rem] rounded-xl border px-4 py-3.5 text-left transition-all ${
                  active
                    ? 'border-secondary bg-secondary/5 ring-2 ring-secondary/25'
                    : 'border-outline-variant/15 bg-white hover:border-secondary/40'
                }`}
              >
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest mb-1 truncate">
                  {s.label}
                </p>
                <p className="text-2xl font-bold text-primary-container tabular-nums">
                  {highlights[s.key]?.toLocaleString() ?? 0}
                </p>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="rounded-xl border border-outline-variant/15 bg-white p-3 sm:p-4 space-y-3 shadow-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[14rem]">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[18px]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone, tags, address, notes…"
                className="w-full pl-9 pr-3 py-2 border border-outline-variant/25 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </div>
            <select
              value={stage}
              onChange={(e) => {
                setStage(e.target.value);
                setPage(1);
              }}
              className={`${selectClass} w-[10rem]`}
            >
              <option value="">All stages</option>
              {filterOptions.stages?.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.value} ({s.count})
                </option>
              ))}
            </select>
            <select
              value={leadSource}
              onChange={(e) => {
                setLeadSource(e.target.value);
                setPage(1);
              }}
              className={`${selectClass} w-[9rem]`}
            >
              <option value="">Lead source</option>
              {filterOptions.leadSources?.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.value}
                </option>
              ))}
            </select>
            <select
              value={assignedTo}
              onChange={(e) => {
                setAssignedTo(e.target.value);
                setPage(1);
              }}
              className={`${selectClass} w-[9rem]`}
            >
              <option value="">Assigned</option>
              {filterOptions.assigned?.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.value}
                </option>
              ))}
            </select>
            <select
              value={isContacted}
              onChange={(e) => {
                setIsContacted(e.target.value);
                setPage(1);
              }}
              className={`${selectClass} w-[8.5rem]`}
            >
              <option value="">Contacted</option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
            <input
              type="text"
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                setPage(1);
              }}
              placeholder="Tag…"
              className={`${selectClass} w-[7rem]`}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>
              {loading ? 'Loading…' : `${data.total?.toLocaleString()} contacts`}
              {hasFilters && ' (filtered)'}
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-secondary font-semibold hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Contact list */}
        <div className="rounded-xl border border-outline-variant/15 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[720px]">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[20%]" />
                <col className="w-[12%]" />
                <col className="w-10" />
              </colgroup>
              <thead className="bg-surface-container-low border-b border-outline-variant/10">
                <tr>
                  {['Client', 'Stage', 'Last Contact', 'Assigned To', 'Property', 'Tags', ''].map((h) => (
                    <th
                      key={h || 'chevron'}
                      className="px-4 py-3 text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center text-on-surface-variant">
                      Loading contacts…
                    </td>
                  </tr>
                ) : data.contacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center text-on-surface-variant">
                      No contacts match your search.
                    </td>
                  </tr>
                ) : (
                  data.contacts.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/crm/${c.id}`)}
                      className="hover:bg-primary-container/5 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-sm text-primary truncate">{c.name}</p>
                        <p className="text-[11px] text-on-surface-variant truncate">
                          {c.email || c.phone || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex max-w-full px-2 py-0.5 rounded-full text-[11px] font-semibold border truncate ${stageBadgeClass(c.stage)}`}
                        >
                          {c.stage || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-on-surface-variant whitespace-nowrap">
                        <DateText value={c.last_contacted} />
                      </td>
                      <td className="px-4 py-3 text-[13px] truncate">
                        {c.assigned_to_name || c.assigned_user_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium truncate">{propertyLine(c)}</td>
                      <td className="px-4 py-3 text-[11px] text-on-surface-variant truncate">
                        {c.tags || '—'}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Icon
                          name="chevron_right"
                          className="text-outline group-hover:text-primary transition-colors !text-[20px]"
                        />
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
