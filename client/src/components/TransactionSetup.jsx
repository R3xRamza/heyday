import { useState, useEffect } from 'react';
import DateText from './shared/DateText';
import { buildAssignments } from '../utils/taskAssignment';
import {
  REPRESENTING_OPTIONS,
  normalizeRepresenting,
  showsOptionEndDate,
  getRequiredTransactionFields,
  validateTransactionFields,
  FIELD_LABELS,
  SALE_TYPE_OPTIONS,
  saleTypeForRepresenting,
  normalizeSaleType,
  counterpartyNameLabel,
  isDualCounterpartyRepresenting,
} from '../constants/transactionForm';
import PriceInput from './shared/PriceInput';
import { buildFallbackParties } from '../data/transactionParties';

const STEPS = [
  { key: 'details', label: '1. Transaction Details', num: 1 },
  { key: 'template', label: '2. Pick Task Template', num: 2 },
  { key: 'assign', label: '3. Assign Tasks', num: 3 },
];

function hydrateForm(transaction) {
  const representing = normalizeRepresenting(transaction.representing);
  return {
    ...transaction,
    representing,
    sale_type: normalizeSaleType(transaction.sale_type, representing),
    state: transaction.state || '',
    zip: transaction.zip || '',
    agent_id: transaction.agent_id ?? '',
  };
}

export default function TransactionSetup({ transaction, onUpdate, onComplete }) {
  const [step, setStep] = useState(transaction.workflow_status || 'details');
  const [form, setForm] = useState(hydrateForm(transaction));
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [appliedChecklists, setAppliedChecklists] = useState([]);
  const [activeAssignTemplateId, setActiveAssignTemplateId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  const requiredFields = getRequiredTransactionFields(form.representing);
  const isRequired = (key) => requiredFields.includes(key);

  function fieldLabel(key, fallback) {
    const name = FIELD_LABELS[key] || fallback;
    return isRequired(key) ? `${name} *` : name;
  }

  useEffect(() => {
    setStep(transaction.workflow_status || 'details');
    setForm(hydrateForm(transaction));
  }, [transaction]);

  useEffect(() => {
    fetch('/api/checklists', { credentials: 'include' }).then((r) => r.json()).then((d) => setTemplates(d.templates || []));
    fetch('/api/team', { credentials: 'include' }).then((r) => r.json()).then((d) => setUsers(d.members || []));
  }, []);

  useEffect(() => {
    if (step !== 'details' || users.length === 0) return;
    setForm((prev) => {
      if (prev.agent_id) return prev;
      const meredith = users.find((u) => u.email === 'meredith@heyday.com');
      const defaultId = meredith?.id ?? users[0]?.id;
      return defaultId ? { ...prev, agent_id: defaultId } : prev;
    });
  }, [users, step]);

  function agentSelect() {
    return (
      <div>
        <label className="text-xs font-semibold text-on-surface-variant">Agent</label>
        <select
          value={String(form.agent_id || '')}
          onChange={(e) => setForm({ ...form, agent_id: e.target.value ? Number(e.target.value) : '' })}
          className="w-full mt-1 px-3 py-2 border rounded text-sm"
        >
          <option value="">Select agent…</option>
          {users.map((u) => (
            <option key={u.id} value={String(u.id)}>{u.name}</option>
          ))}
        </select>
      </div>
    );
  }

  async function loadAssignStepData(members) {
    const [tasksRes, checklistsRes] = await Promise.all([
      fetch(`/api/tasks?transaction_id=${transaction.id}`, { credentials: 'include' }),
      fetch(`/api/transactions/${transaction.id}/checklists`, { credentials: 'include' }),
    ]);
    const tasksJson = await tasksRes.json();
    const checklistsJson = await checklistsRes.json();
    const taskList = tasksJson.tasks || [];
    const lists = checklistsJson.checklists || [];
    setTasks(taskList);
    setAppliedChecklists(lists);
    setAssignments(buildAssignments(taskList, members));
    setActiveAssignTemplateId((prev) => {
      if (prev && lists.some((l) => Number(l.id) === Number(prev))) return prev;
      return lists[0]?.id ?? null;
    });
  }

  useEffect(() => {
    if (step !== 'assign' || users.length === 0) return;
    loadAssignStepData(users);
  }, [step, transaction.id, users]);

  async function persistWorkflow(status) {
    const res = await fetch(`/api/transactions/${transaction.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ workflow_status: status }),
    });
    if (res.ok) {
      const json = await res.json();
      onUpdate(json.transaction);
    }
  }

  async function saveDetails(e) {
    e.preventDefault();
    const validation = validateTransactionFields(form);
    if (!validation.ok) {
      setValidationError(validation.message);
      return;
    }
    setValidationError('');
    setSaving(true);
    const res = await fetch(`/api/transactions/${transaction.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...form,
        value: form.value != null && form.value !== '' ? Number(form.value) : null,
        agent_id: form.agent_id ? Number(form.agent_id) : null,
        workflow_status: 'template',
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      const tx = json.transaction;
      onUpdate(tx);
      let parties = buildFallbackParties({
        ...tx,
        representing: form.representing,
        client_name: form.client_name,
        owner_name: form.owner_name,
      });
      if (isDualCounterpartyRepresenting(form.representing)) {
        parties = parties.map((p) => {
          if (p.role === 'seller') {
            return { ...p, name: form.seller_party_name ?? form.client_name ?? '' };
          }
          if (p.role === 'buyer') {
            return { ...p, name: form.buyer_party_name ?? '' };
          }
          return p;
        });
      }
      await fetch(`/api/transactions/${transaction.id}/parties`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          parties: parties.map(({ role, name, user_id }) => ({ role, name, user_id })),
        }),
      });
      setStep('template');
    } else {
      setValidationError(json.error || 'Could not save transaction details.');
    }
  }

  function toggleTemplate(id) {
    setSelectedTemplateIds((prev) =>
      (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]),
    );
  }

  async function applyTemplates() {
    if (selectedTemplateIds.length === 0) return;
    setSaving(true);
    const res = await fetch(`/api/transactions/${transaction.id}/apply-checklists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ template_ids: selectedTemplateIds }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return;

    let members = users;
    if (members.length === 0) {
      const teamRes = await fetch('/api/team', { credentials: 'include' });
      const team = await teamRes.json();
      members = team.members || [];
      setUsers(members);
    }

    const lists = json.checklists || [];
    setAppliedChecklists(lists);
    if (lists.length) setActiveAssignTemplateId(lists[0].id);

    await loadAssignStepData(members);
    onUpdate({ ...transaction, workflow_status: 'assign' });
    setStep('assign');
  }

  async function goBackToDetails() {
    setSaving(true);
    await persistWorkflow('details');
    setStep('details');
    setSaving(false);
  }

  async function goBackToTemplates() {
    setSaving(true);
    await persistWorkflow('template');
    setStep('template');
    setSaving(false);
  }

  async function finishAssign() {
    setSaving(true);
    await fetch('/api/tasks/bulk/assign', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        assignments: Object.entries(assignments).map(([task_id, assigned_to]) => ({
          task_id: Number(task_id),
          assigned_to: assigned_to ? Number(assigned_to) : null,
        })),
      }),
    });
    const res = await fetch(`/api/transactions/${transaction.id}/complete-setup`, { method: 'POST', credentials: 'include' });
    const json = await res.json();
    setSaving(false);
    if (res.ok) onComplete(json.transaction);
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-8">
        {STEPS.map((s) => (
          <div
            key={s.key}
            className={`flex-1 text-center py-2 text-xs font-bold uppercase tracking-wider border-b-2 ${
              step === s.key ? 'border-lemon text-feather' : 'border-outline-variant/30 text-on-surface-variant'
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>

      {step === 'details' && (
        <form onSubmit={saveDetails} className="bg-white border border-outline-variant/20 rounded-xl p-6 shadow-executive space-y-4">
          <h2 className="text-xl font-bold text-primary">Transaction Details</h2>
          <p className="text-sm text-on-surface-variant">Add property, client, and key dates for this transaction.</p>
          {validationError && (
            <p className="text-sm text-error font-medium bg-error/10 border border-error/20 rounded-lg px-3 py-2" role="alert">
              {validationError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-on-surface-variant">{fieldLabel('address', 'Address')}</label>
              <input
                required={isRequired('address')}
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant">{fieldLabel('city', 'City')}</label>
              <input
                required={isRequired('city')}
                value={form.city || ''}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant">{fieldLabel('state', 'State')}</label>
              <input
                required={isRequired('state')}
                value={form.state || ''}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
                placeholder="TX"
                maxLength={2}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant">{fieldLabel('zip', 'ZIP')}</label>
              <input
                required={isRequired('zip')}
                value={form.zip || ''}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
                placeholder="78746"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant">Sales Price</label>
              <PriceInput
                value={form.value}
                onChange={(v) => setForm({ ...form, value: v })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
                placeholder="1,000,000"
              />
            </div>
            {isDualCounterpartyRepresenting(form.representing) ? (
              <>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant">Seller name</label>
                  <input
                    value={form.seller_party_name ?? form.client_name ?? form.owner_name ?? ''}
                    onChange={(e) => setForm({
                      ...form,
                      seller_party_name: e.target.value,
                      client_name: e.target.value,
                      owner_name: e.target.value,
                    })}
                    className="w-full mt-1 px-3 py-2 border rounded text-sm"
                  />
                </div>
                {agentSelect()}
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-on-surface-variant">Buyer name</label>
                  <input
                    value={form.buyer_party_name ?? ''}
                    onChange={(e) => setForm({ ...form, buyer_party_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded text-sm"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant">
                    {counterpartyNameLabel(form.representing)}
                  </label>
                  <input
                    value={form.client_name || form.owner_name || ''}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value, owner_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded text-sm"
                  />
                </div>
                {agentSelect()}
              </>
            )}
            <div className="col-span-2">
              <label className="text-xs font-semibold text-on-surface-variant">Representing</label>
              <select
                value={form.representing || 'seller'}
                onChange={(e) => {
                  setValidationError('');
                  const representing = e.target.value;
                  setForm({
                    ...form,
                    representing,
                    sale_type: saleTypeForRepresenting(representing),
                  });
                }}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
              >
                {REPRESENTING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant">Type of sale</label>
              <select
                value={form.sale_type || saleTypeForRepresenting(form.representing)}
                onChange={(e) => setForm({ ...form, sale_type: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
              >
                {SALE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant">{fieldLabel('close_date', 'Closing Date')}</label>
              <input
                type="date"
                required={isRequired('close_date')}
                value={form.close_date || ''}
                onChange={(e) => setForm({ ...form, close_date: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant">{fieldLabel('important_date', 'Expiry Date')}</label>
              <input
                type="date"
                required={isRequired('important_date')}
                value={form.important_date || ''}
                onChange={(e) => setForm({ ...form, important_date: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
              />
            </div>
            {showsOptionEndDate(form.representing) && (
              <div>
                <label className="text-xs font-semibold text-on-surface-variant">{fieldLabel('option_end_date', 'Option End Date')}</label>
                <input
                  type="date"
                  required={isRequired('option_end_date')}
                  value={form.option_end_date || ''}
                  onChange={(e) => setForm({ ...form, option_end_date: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded text-sm"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-on-surface-variant">{fieldLabel('listing_date', 'Listing Date')}</label>
              <input
                type="date"
                required={isRequired('listing_date')}
                value={form.listing_date || ''}
                onChange={(e) => setForm({ ...form, listing_date: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant">{fieldLabel('acceptance_date', 'Acceptance Date')}</label>
              <input
                type="date"
                required={isRequired('acceptance_date')}
                value={form.acceptance_date || ''}
                onChange={(e) => setForm({ ...form, acceptance_date: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
              />
            </div>
          </div>
          <button type="submit" disabled={saving} className="w-full py-3 bg-lemon text-feather font-bold rounded-lg">
            {saving ? 'Saving…' : 'Save & Continue →'}
          </button>
        </form>
      )}

      {step === 'template' && (
        <div className="bg-white border border-outline-variant/20 rounded-xl p-6 shadow-executive space-y-4">
          <h2 className="text-xl font-bold text-primary">Pick Task Templates</h2>
          <p className="text-sm text-on-surface-variant">
            Select one or more checklists. Tasks merge without duplicates.
          </p>
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {templates.map((t) => {
              const checked = selectedTemplateIds.includes(t.id);
              return (
                <label
                  key={t.id}
                  className={`flex items-start gap-3 w-full p-4 rounded-lg border cursor-pointer transition-colors ${
                    checked ? 'border-feather bg-feather/5' : 'border-outline-variant/20 hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTemplate(t.id)}
                    className="mt-1 rounded border-outline-variant text-secondary"
                  />
                  <div>
                    <p className="font-semibold text-primary">{t.name}</p>
                    <p className="text-xs text-on-surface-variant">{t.tasks?.length || 0} tasks · {t.category}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={goBackToDetails}
              disabled={saving}
              className="px-5 py-3 border border-outline-variant/30 text-feather font-bold rounded-lg"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={applyTemplates}
              disabled={selectedTemplateIds.length === 0 || saving}
              className="flex-1 py-3 bg-lemon text-feather font-bold rounded-lg disabled:opacity-50"
            >
              {saving ? 'Applying…' : `Apply ${selectedTemplateIds.length || ''} Template(s) →`}
            </button>
          </div>
        </div>
      )}

      {step === 'assign' && (
        <div className="bg-white border border-outline-variant/20 rounded-xl p-6 shadow-executive space-y-4">
          <h2 className="text-xl font-bold text-primary">Assign Tasks</h2>
          <p className="text-sm text-on-surface-variant">Assign each task to a team member before launching the transaction dashboard.</p>
          {appliedChecklists.length > 1 && (
            <div className="flex flex-wrap gap-2 border-b border-outline-variant/20 pb-3">
              {appliedChecklists.map((cl) => (
                <button
                  key={cl.id}
                  type="button"
                  onClick={() => setActiveAssignTemplateId(cl.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                    activeAssignTemplateId === cl.id
                      ? 'bg-feather text-white border-feather'
                      : 'border-outline-variant/30 text-feather hover:bg-surface-container-low'
                  }`}
                >
                  {cl.name}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {tasks
              .filter((task) => {
                if (!activeAssignTemplateId) return true;
                if (task.template_id == null) return appliedChecklists.length <= 1;
                return Number(task.template_id) === Number(activeAssignTemplateId);
              })
              .map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{task.title}</p>
                  <p className="text-xs text-on-surface-variant whitespace-nowrap">
                    Due <DateText value={task.due_date} />
                  </p>
                </div>
                <select
                  value={String(assignments[task.id] ?? '')}
                  onChange={(e) => setAssignments({ ...assignments, [task.id]: e.target.value })}
                  className="text-sm border rounded px-2 py-1.5 min-w-[140px]"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={String(u.id)}>{u.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={goBackToTemplates}
              disabled={saving}
              className="px-5 py-3 border border-outline-variant/30 text-feather font-bold rounded-lg"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={finishAssign}
              disabled={saving}
              className="flex-1 py-3 bg-lemon text-feather font-bold rounded-lg"
            >
              {saving ? 'Launching…' : 'Launch Transaction Dashboard →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
