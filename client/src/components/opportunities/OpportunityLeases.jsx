import { useCallback, useEffect, useMemo, useState } from 'react';
import { appendAgentScope } from '../../utils/agentScope';
import { useAgentScope } from '../../context/AgentScopeContext';
import OpportunityAgentSelect from './OpportunityAgentSelect';

const TYPES = [
  { value: 'listing', label: 'Listing' },
  { value: 'buyer', label: 'Buyer' },
];

const inputClass = 'w-full min-h-11 px-3 py-2 bg-white border border-outline-variant/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/25';

const EMPTY = {
  party_name: '',
  address: '',
  lease_end_date: '',
  notes: '',
  opportunity_type: 'listing',
};

export default function OpportunityLeases({ members = [], agentId = '' }) {
  const { scope } = useAgentScope();
  const queryScope = agentId ? 'all' : scope;
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [endSort, setEndSort] = useState('asc');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (agentId) params.set('agent_id', agentId);
    const res = await fetch(appendAgentScope(`/api/opportunities/leases?${params}`, queryScope), {
      credentials: 'include',
    });
    if (!res.ok) return;
    const json = await res.json();
    setRows(json.leases || []);
  }, [queryScope, search, agentId]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      party_name: row.party_name || '',
      address: row.address || '',
      lease_end_date: row.lease_end_date || '',
      notes: row.notes || '',
      opportunity_type: row.opportunity_type === 'buyer' ? 'buyer' : 'listing',
    });
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    const url = appendAgentScope(
      editingId ? `/api/opportunities/leases/${editingId}` : '/api/opportunities/leases',
      queryScope,
    );
    const res = await fetch(url, {
      method: editingId ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Could not save');
      return;
    }
    setForm(EMPTY);
    setEditingId(null);
    await load();
  }

  async function remove(id) {
    const res = await fetch(appendAgentScope(`/api/opportunities/leases/${id}`, queryScope), {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      if (editingId === id) {
        setEditingId(null);
        setForm(EMPTY);
      }
      await load();
    }
  }

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const ad = a.lease_end_date || '';
      const bd = b.lease_end_date || '';
      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return endSort === 'desc' ? bd.localeCompare(ad) : ad.localeCompare(bd);
    });
    return list;
  }, [rows, endSort]);

  async function setAgent(row, agent_id) {
    const res = await fetch(appendAgentScope(`/api/opportunities/leases/${row.id}`, queryScope), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id }),
    });
    if (res.ok) await load();
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search leases…"
        className={inputClass}
      />
      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-white border border-outline-variant/20 rounded-xl p-3">
        <input className={inputClass} placeholder="Tenant / Landlord" value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} />
        <input className={inputClass} placeholder="Address" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input className={inputClass} type="date" value={form.lease_end_date} onChange={(e) => setForm({ ...form, lease_end_date: e.target.value })} />
        <input className={inputClass} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <select className={inputClass} value={form.opportunity_type} onChange={(e) => setForm({ ...form, opportunity_type: e.target.value })}>
          {TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <button type="submit" className="min-h-11 px-3 bg-primary-container text-white text-xs font-semibold uppercase tracking-wider">
          {editingId ? 'Save' : 'Add'}
        </button>
        {error && <p className="md:col-span-6 text-sm text-error">{error}</p>}
      </form>

      <div className="bg-white border border-outline-variant/20 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/15">
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Tenant / Landlord</th>
              <th className="px-3 py-2">Address</th>
              <th className="px-3 py-2">
                <button type="button" className="font-semibold uppercase tracking-widest" onClick={() => setEndSort((dir) => (dir === 'asc' ? 'desc' : 'asc'))}>
                  Lease end {endSort === 'asc' ? '↑' : '↓'}
                </button>
              </th>
              <th className="px-3 py-2">Notes</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-on-surface-variant">No lease opportunities yet.</td></tr>
            ) : sorted.map((row) => (
              <tr key={row.id} className="border-b border-outline-variant/10">
                <td className="px-3 py-2">
                  <OpportunityAgentSelect
                    value={row.agent_id}
                    members={members}
                    onChange={(agent_id) => setAgent(row, agent_id)}
                  />
                </td>
                <td className="px-3 py-2">{row.party_name || '—'}</td>
                <td className="px-3 py-2">{row.address}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.lease_end_date || '—'}</td>
                <td className="px-3 py-2">{row.notes || '—'}</td>
                <td className="px-3 py-2">{row.opportunity_type === 'buyer' ? 'Buyer' : 'Listing'}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button type="button" className="text-secondary font-semibold mr-3" onClick={() => startEdit(row)}>Edit</button>
                  <button type="button" className="text-error font-semibold" onClick={() => remove(row.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
