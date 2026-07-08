import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import Icon from './shared/Icon';
import EditTaskModal from './EditTaskModal';
import CreateTaskModal from './CreateTaskModal';
import PartiesToTransaction from './PartiesToTransaction';
import PrivateListingFlag from './transactions/PrivateListingFlag';
import DateText from './shared/DateText';
import { formatCurrency, parseTransactionAddress } from '../utils/format';
import {
  REPRESENTING_OPTIONS,
  LISTING_VISIBILITY_OPTIONS,
  normalizeRepresenting,
  normalizeListingVisibility,
  isListingSideRepresenting,
  isPrivateListing,
  representingLabel,
  getTimelineSteps,
  getTimelineDateKeys,
  datesToClearOnRepresentingChange,
  transactionStageLabel,
  transactionPortfolioType,
  TRANSACTION_STAGE_OPTIONS,
  SALE_TYPE_OPTIONS,
  saleTypeForRepresenting,
  normalizeSaleType,
} from '../constants/transactionForm';

const ASSET_VIEWS = [
  { key: 'details', label: 'Transaction details', icon: 'info' },
  { key: 'checklist', label: 'Checklist', icon: 'checklist' },
  { key: 'activity', label: 'Activity', icon: 'history' },
];

const EXTRA_FIELDS = [
  { key: 'created_at', label: 'Created', type: 'readonly-date' },
  { key: 'representing', label: 'Representing', type: 'select', options: REPRESENTING_OPTIONS },
  {
    key: 'listing_visibility',
    label: 'Listing status',
    type: 'select',
    options: LISTING_VISIBILITY_OPTIONS,
    listingSideOnly: true,
  },
  { key: 'sale_type', label: 'Type of sale', type: 'select', options: SALE_TYPE_OPTIONS },
  { key: 'stage', label: 'Status', type: 'select', options: TRANSACTION_STAGE_OPTIONS },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'zip', label: 'ZIP', type: 'text' },
];

function shortDue(d) {
  if (!d) return '—';
  const date = new Date(`${d}T12:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function activityLabel(type) {
  const map = {
    transaction_created: 'Transaction created',
    transaction_updated: 'Transaction updated',
    deadlines_changed: 'Deadlines changed',
    task_complete: 'Task complete',
    task_updated: 'Task updated',
    task_deleted: 'Task deleted',
    task_created: 'Task added',
    checklist_added: 'Checklist added',
    checklist_removed: 'Checklist removed',
    comment: 'Comment',
  };
  return map[type] || type;
}

function stageBadge(stage) {
  return transactionStageLabel(stage).toUpperCase();
}

function EditableField({ field, form, transaction, onChange, onBlur }) {
  const key = field.key;
  if (field.type === 'readonly-date') {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">{field.label}</label>
        <DateText value={transaction.created_at?.slice(0, 10)} className="block text-sm font-semibold text-primary" />
      </div>
    );
  }
  if (field.type === 'select') {
    return (
      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">{field.label}</label>
        <select
          value={form[key] || ''}
          onChange={(e) => onChange(key, e.target.value)}
          className="w-full text-sm font-semibold text-primary bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 focus:ring-2 focus:ring-secondary/30 outline-none"
        >
          {field.options.map((o) => {
            const val = typeof o === 'object' ? o.value : o;
            const label = typeof o === 'object' ? o.label : o;
            return <option key={val} value={val}>{label}</option>;
          })}
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">{field.label}</label>
      <div className="flex items-center gap-1 bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-secondary/30">
        {field.prefix && <span className="text-sm font-semibold text-primary">{field.prefix}</span>}
        <input
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={form[key] ?? ''}
          onChange={(e) => onChange(key, field.type === 'number' ? e.target.value : e.target.value)}
          onBlur={(e) => onBlur(key, field.type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
          className="flex-1 text-sm font-semibold text-primary bg-transparent outline-none min-w-0"
        />
      </div>
    </div>
  );
}

export default function TransactionWorkspace({
  transaction,
  checklists = [],
  parties: partiesProp = [],
  tasks,
  activities,
  users,
  onSaveTransaction,
  onSaveParties,
  onTaskUpdate,
  onTaskDelete,
  onTaskCreate,
  onAddComment,
  onRefreshActivities,
  onDeleteTransaction,
  onRemoveChecklist,
  onApplyChecklists,
  onCompleteOverdueTasks,
}) {
  const [view, setView] = useState('details');
  const [activeChecklistId, setActiveChecklistId] = useState(null);
  const [form, setForm] = useState({ ...transaction });
  const [selectedTask, setSelectedTask] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [checklistActionLoading, setChecklistActionLoading] = useState(false);
  const [checklistActionError, setChecklistActionError] = useState('');
  const [comment, setComment] = useState('');
  const [savingTx, setSavingTx] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [completingOverdue, setCompletingOverdue] = useState(false);

  useEffect(() => {
    const representing = normalizeRepresenting(transaction.representing);
    setForm({
      ...transaction,
      representing,
      sale_type: normalizeSaleType(transaction.sale_type, representing),
      listing_visibility: normalizeListingVisibility(transaction.listing_visibility),
    });
  }, [transaction]);

  const sidebarChecklists = checklists.length > 0
    ? checklists
    : (transaction.template_name && transaction.checklist_template_id
      ? [{ id: transaction.checklist_template_id, name: transaction.template_name }]
      : []);

  useEffect(() => {
    const lists = checklists.length > 0
      ? checklists
      : (transaction.template_name && transaction.checklist_template_id
        ? [{ id: transaction.checklist_template_id, name: transaction.template_name }]
        : []);
    setActiveChecklistId((prev) => {
      if (prev && lists.some((c) => Number(c.id) === Number(prev))) return prev;
      return lists[0]?.id ?? null;
    });
  }, [checklists, transaction.checklist_template_id, transaction.template_name]);

  const checklistTasks = tasks.filter((t) => {
    if (!activeChecklistId) return true;
    if (t.template_task_id != null) {
      return Number(t.template_id) === Number(activeChecklistId);
    }
    // Orphaned template rows (e.g. after template resync) must not appear on every checklist tab.
    const checklistStyle = /^(CLOSE OUT|MARKETING|UNDER CONTRACT|GO LIVE|COMING SOON|LISTING|FOLLOW UP|EXECUTED|PRIOR TO|POST-OPTION|OPTION PERIOD|Social Post)/i;
    if (checklistStyle.test(t.title || '')) return false;
    return true;
  });

  const activeChecklistName = sidebarChecklists.find((c) => Number(c.id) === Number(activeChecklistId))?.name
    || transaction.template_name
    || 'Tasks';

  useEffect(() => {
    if (view !== 'checklist') return;
    if (checklistTasks.length && !selectedTask) setSelectedTask(checklistTasks[0]);
    if (selectedTask && !checklistTasks.find((t) => t.id === selectedTask.id)) {
      setSelectedTask(checklistTasks[0] || null);
    }
  }, [checklistTasks, selectedTask, view]);

  const loadChecklistTemplates = useCallback(async () => {
    const res = await fetch('/api/checklists', { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setChecklistTemplates(json.templates || []);
    }
  }, []);

  useEffect(() => {
    if (showAddChecklist) loadChecklistTemplates();
  }, [showAddChecklist, loadChecklistTemplates]);

  const appliedChecklistIds = new Set(sidebarChecklists.map((c) => Number(c.id)));
  const availableTemplates = checklistTemplates.filter((t) => !appliedChecklistIds.has(Number(t.id)));

  async function handleRemoveChecklist(cl) {
    const total = cl.task_count ?? 0;
    const msg = total > 0
      ? `Remove "${cl.name}"? This deletes ${total} task${total === 1 ? '' : 's'} from this transaction (including any completed).`
      : `Remove "${cl.name}" from this transaction?`;
    if (!window.confirm(msg)) return;

    setChecklistActionLoading(true);
    setChecklistActionError('');
    const result = await onRemoveChecklist?.(cl.id);
    setChecklistActionLoading(false);
    if (!result?.ok) {
      setChecklistActionError(result?.error || 'Could not remove checklist.');
      return;
    }
    if (Number(activeChecklistId) === Number(cl.id)) {
      setActiveChecklistId(null);
      setSelectedTask(null);
    }
    onRefreshActivities?.();
  }

  function toggleAddTemplate(id) {
    setSelectedTemplateIds((prev) =>
      (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]),
    );
  }

  async function handleApplyChecklists() {
    if (selectedTemplateIds.length === 0) return;
    setChecklistActionLoading(true);
    setChecklistActionError('');
    const result = await onApplyChecklists?.(selectedTemplateIds);
    setChecklistActionLoading(false);
    if (!result?.ok) {
      setChecklistActionError(result?.error || 'Could not apply checklist.');
      return;
    }
    setShowAddChecklist(false);
    setSelectedTemplateIds([]);
    const firstId = result.templateIds?.[0] ?? selectedTemplateIds[0];
    if (firstId != null) {
      setActiveChecklistId(firstId);
      setView('checklist');
    }
    onRefreshActivities?.();
  }

  async function saveTransaction(updates) {
    setSavingTx(true);
    setSavedMsg('');
    const payload = { ...form, ...updates };
    const result = await onSaveTransaction(payload);
    setSavingTx(false);
    if (result?.tasksRecalculated) {
      setSavedMsg(`Saved · ${result.tasksRecalculated} task due dates updated`);
    } else {
      setSavedMsg('Saved');
    }
    setTimeout(() => setSavedMsg(''), 4000);
  }

  function handleFieldChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFieldBlur(key, value) {
    if (transaction[key] === value || (transaction[key] == null && value === '')) return;
    saveTransaction({ [key]: value === '' ? null : value });
  }

  function handleSelectChange(key, value) {
    if (key === 'representing') {
      const normalized = normalizeRepresenting(value);
      const { updates, patch } = datesToClearOnRepresentingChange(form, normalized);
      const sale_type = saleTypeForRepresenting(normalized);
      const listing_visibility = isListingSideRepresenting(normalized)
        ? normalizeListingVisibility(form.listing_visibility)
        : 'public';
      const payload = { [key]: value, sale_type, listing_visibility, ...updates };
      setForm((prev) => ({ ...prev, [key]: value, sale_type, listing_visibility, ...patch }));
      saveTransaction(payload);
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
    saveTransaction({ [key]: value });
  }

  async function toggleTask(task) {
    const updated = await onTaskUpdate(task.id, {
      status: task.status === 'complete' ? 'pending' : 'complete',
    });
    if (updated) setSelectedTask(updated);
    onRefreshActivities();
  }

  async function saveTaskEdit(data) {
    const updated = await onTaskUpdate(editTask.id, data);
    setEditTask(null);
    if (updated) setSelectedTask(updated);
    onRefreshActivities();
  }

  async function handleCreateTask(formData) {
    const created = await onTaskCreate(formData);
    if (created) {
      setShowCreateTask(false);
      setView('checklist');
      setSelectedTask(created);
      onRefreshActivities();
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    await onAddComment(comment.trim());
    setComment('');
    onRefreshActivities();
  }

  async function handleCompleteOverdueTasks() {
    if (!overdueTasks.length || !onCompleteOverdueTasks) return;
    const n = overdueTasks.length;
    if (!window.confirm(`Mark ${n} overdue task${n === 1 ? '' : 's'} as complete?`)) return;

    setCompletingOverdue(true);
    try {
      const ok = await onCompleteOverdueTasks();
      if (ok) {
        if (selectedTask && overdueTasks.some((t) => t.id === selectedTask.id)) {
          setSelectedTask((prev) => (prev ? { ...prev, status: 'complete' } : prev));
        }
        onRefreshActivities?.();
      }
    } finally {
      setCompletingOverdue(false);
    }
  }

  const doneCount = checklistTasks.filter((t) => t.status === 'complete').length;
  const progressPct = checklistTasks.length ? Math.round((doneCount / checklistTasks.length) * 100) : 0;
  const { street, cityLine } = parseTransactionAddress({
    address: form.address,
    city: form.city,
    state: form.state,
    zip: form.zip,
  });
  const openTasks = tasks.filter((t) => t.status !== 'complete').length;
  const overdueTasks = tasks.filter((t) => t.is_overdue && t.status !== 'complete');
  const timelineDates = getTimelineSteps(form.representing);
  const timelineKeySet = new Set(getTimelineDateKeys(form.representing));
  const visibleExtraFields = EXTRA_FIELDS.filter((f) => {
    if (timelineKeySet.has(f.key)) return false;
    if (f.listingSideOnly && !isListingSideRepresenting(form.representing)) return false;
    return true;
  });
  const representingDisplay = representingLabel(form.representing);
  const showPrivateFlag = isPrivateListing(form);
  const portfolioType = transactionPortfolioType(form);

  const dashboardHeader = (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-2">
      <div>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1 uppercase tracking-widest font-semibold">
          <Link to="/transactions" className="hover:text-secondary">Transactions</Link>
          <Icon name="chevron_right" className="!text-[14px]" />
          <span className="text-secondary font-bold">{street?.toUpperCase()}</span>
        </div>
        {savedMsg && <p className="text-xs text-secondary mt-1 font-semibold">{savedMsg}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1 bg-secondary-container/30 text-secondary border border-secondary/20 rounded-full text-xs font-semibold uppercase tracking-wide">
          {stageBadge(transaction.stage)}
        </span>
        {showPrivateFlag && <PrivateListingFlag />}
        {openTasks > 0 && (
          <span className="px-3 py-1 bg-primary-container text-white rounded-full text-xs font-semibold uppercase tracking-wide">
            {openTasks} OPEN TASKS
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-surface">
      <aside className="w-56 shrink-0 bg-surface-container-lowest border-r border-outline-variant/10 flex flex-col overflow-y-auto custom-scrollbar">
        <div className="p-4 border-b border-outline-variant/10">
          <Link to="/transactions" className="text-xs font-bold text-secondary hover:underline flex items-center gap-1 mb-4">
            <Icon name="arrow_back" className="!text-[14px]" /> BACK
          </Link>
          <p className="text-sm font-semibold text-primary leading-snug">{street}</p>
          {cityLine && <p className="text-xs text-on-surface-variant mt-0.5">{cityLine}</p>}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase bg-secondary-container/40 text-secondary rounded-full">
              {transaction.stage || 'active'}
            </span>
            {showPrivateFlag && <PrivateListingFlag />}
          </div>
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Checklists</p>
            <button
              type="button"
              onClick={() => {
                setChecklistActionError('');
                setSelectedTemplateIds([]);
                setShowAddChecklist(true);
              }}
              className="p-1 text-secondary hover:text-primary rounded"
              title="Add checklist"
              aria-label="Add checklist"
            >
              <Plus size={14} />
            </button>
          </div>
          {checklistActionError && (
            <p className="text-[10px] text-error px-2 mb-2" role="alert">{checklistActionError}</p>
          )}
          {sidebarChecklists.length > 0 ? (
            <div className="space-y-1">
              {sidebarChecklists.map((cl) => (
                <div key={cl.id} className="flex items-center gap-0.5 group">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChecklistId(cl.id);
                      setView('checklist');
                    }}
                    className={`flex-1 min-w-0 text-left px-2 py-2 text-sm rounded truncate ${
                      view === 'checklist' && Number(activeChecklistId) === Number(cl.id)
                        ? 'bg-primary-container text-white font-semibold'
                        : 'text-primary hover:bg-surface-container-low'
                    }`}
                  >
                    {cl.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklist(cl)}
                    disabled={checklistActionLoading}
                    className="shrink-0 p-1.5 rounded text-on-surface-variant hover:text-error hover:bg-error/10 opacity-60 group-hover:opacity-100"
                    title={`Remove ${cl.name}`}
                    aria-label={`Remove ${cl.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant px-2">No checklist applied</p>
          )}
        </div>

        <div className="p-3 border-t border-outline-variant/10 mt-auto flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-2 mb-2">Assets</p>
            {ASSET_VIEWS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded ${view === item.key ? 'bg-primary-container text-white font-semibold' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'}`}
              >
                <Icon name={item.icon} className="!text-[16px]" />
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-on-surface-variant/35 px-2 pb-1 tabular-nums">
            TR-{transaction.id}
          </p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {view === 'details' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
            {dashboardHeader}

            <div className="grid grid-cols-12 gap-6 items-start">
              <div className="col-span-12 lg:col-span-5 space-y-5">
                <div className="rounded-xl overflow-hidden shadow-executive border border-secondary/20 bg-gradient-to-br from-primary-container via-primary-container to-secondary/90 text-white">
                  <div className="p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-secondary/90 mb-1">
                      {representingDisplay}
                    </p>
                    <p className="text-xl font-semibold leading-snug">{street || '—'}</p>
                    {cityLine && <p className="text-white/75 text-sm mt-1">{cityLine}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-white/20 rounded-full">
                        {portfolioType}
                      </span>
                      <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-white/15 rounded-full">
                        {stageBadge(transaction.stage)}
                      </span>
                      {showPrivateFlag && <PrivateListingFlag />}
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-6 shadow-executive border-l-4 border-l-secondary">
                  <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-5">
                    Critical Dates Timeline
                  </h3>
                  <div className="relative pl-1">
                    <div
                      className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-outline-variant/25 rounded-full"
                      aria-hidden
                    />
                    <ul className="space-y-5 relative z-10">
                      {timelineDates.map((item) => {
                        const hasDate = Boolean(form[item.key]);
                        return (
                          <li key={item.key} className="flex gap-4 items-start">
                            <div
                              className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border-2 shadow-sm ${
                                hasDate
                                  ? 'bg-secondary border-secondary text-white'
                                  : 'bg-surface border-outline-variant/40 text-outline-variant'
                              }`}
                            >
                              <Icon name={item.icon} filled={hasDate} className="!text-[18px]" />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-xs font-bold text-primary leading-snug">{item.label}</p>
                              <input
                                type="date"
                                value={form[item.key] || ''}
                                onChange={(e) => handleFieldChange(item.key, e.target.value)}
                                onBlur={(e) => handleFieldBlur(item.key, e.target.value || null)}
                                className="mt-1.5 w-full text-sm text-primary bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 focus:ring-2 focus:ring-secondary/30 outline-none"
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-7">
                <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-6 shadow-executive h-full">
                  <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-6">
                    Transaction Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {visibleExtraFields.map((field) => (
                      <div key={field.key} className={field.key === 'created_at' ? 'sm:col-span-2' : undefined}>
                        <EditableField
                          field={field}
                          form={form}
                          transaction={transaction}
                          onChange={field.type === 'select' ? handleSelectChange : handleFieldChange}
                          onBlur={handleFieldBlur}
                        />
                      </div>
                    ))}
                  </div>
                  {savingTx && <p className="text-xs text-on-surface-variant mt-4">Saving…</p>}

                  <div className="mt-8 pt-8 border-t border-outline-variant/15">
                    <PartiesToTransaction
                      parties={partiesProp}
                      transaction={transaction}
                      onSave={onSaveParties}
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-surface-container-lowest border border-outline-variant/10 rounded-xl shadow-executive">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-tertiary-container/10 text-tertiary rounded-full flex items-center justify-center">
                      <Icon name="description" />
                    </div>
                    <div>
                      <p className="text-[11px] text-on-surface-variant uppercase tracking-widest font-semibold">Checklist Tasks</p>
                      <p className="text-xl font-semibold text-primary">{checklistTasks.length} Total</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-surface-container-lowest border border-outline-variant/10 rounded-xl shadow-executive">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-full flex items-center justify-center">
                      <Icon name="speed" />
                    </div>
                    <div>
                      <p className="text-[11px] text-on-surface-variant uppercase tracking-widest font-semibold">Progress</p>
                      <p className="text-xl font-semibold text-primary">{progressPct}% Complete</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'checklist' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
            {dashboardHeader}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-8">
                <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl shadow-executive flex flex-col max-h-[calc(100vh-280px)]">
                  <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center shrink-0 gap-4">
                    <div>
                      <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
                        Checklist: {activeChecklistName}
                      </h3>
                      <p className="text-[11px] text-on-surface-variant mt-1">{doneCount} of {checklistTasks.length} Tasks Completed</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreateTask(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-primary-container rounded-lg hover:brightness-110 shrink-0"
                    >
                      <Icon name="add" className="!text-[16px]" />
                      Add task
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
                    {checklistTasks.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-on-surface-variant">No tasks on this checklist.</p>
                        <button
                          type="button"
                          onClick={() => setShowCreateTask(true)}
                          className="mt-3 text-sm font-semibold text-secondary hover:underline"
                        >
                          Add task
                        </button>
                      </div>
                    ) : (
                      checklistTasks.map((task) => {
                        const isComplete = task.status === 'complete';
                        const isOverdue = task.is_overdue && !isComplete;
                        const isActive = selectedTask?.id === task.id;
                        return (
                          <div
                            key={task.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedTask(task)}
                            onKeyDown={(e) => e.key === 'Enter' && setSelectedTask(task)}
                            className={`flex items-center gap-4 p-4 rounded-lg border transition-colors group cursor-pointer ${
                              isActive
                                ? 'bg-primary-container/[0.03] border-primary-container/10'
                                : isOverdue
                                  ? 'bg-red-50/50 border-red-200'
                                  : 'hover:bg-surface-container-low border-outline-variant/5'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isComplete}
                              onChange={(e) => { e.stopPropagation(); toggleTask(task); }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 rounded text-secondary focus:ring-secondary border-outline-variant shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold ${isComplete ? 'line-through opacity-50' : 'text-on-surface'} ${isOverdue ? 'text-red-600' : ''}`}>
                                {task.title}
                              </p>
                              <div className="flex flex-nowrap items-center gap-2 mt-1 overflow-hidden">
                                {task.due_date && (
                                  <span className={`text-[10px] flex items-center gap-1 whitespace-nowrap shrink-0 ${isOverdue ? 'text-red-600 font-bold' : 'text-on-surface-variant'}`}>
                                    <Icon name="calendar_month" className="!text-[12px]" />
                                    {isOverdue ? 'Overdue · ' : 'Due '}
                                    <DateText value={task.due_date} />
                                  </span>
                                )}
                                {task.user_name && (
                                  <span className="text-[10px] text-on-surface-variant">Assigned: {task.user_name}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setEditTask(task); }}
                                className="p-1 hover:bg-surface-container-highest rounded"
                              >
                                <Icon name="edit" className="!text-[18px]" />
                              </button>
                            </div>
                            {isComplete && (
                              <p className="text-[11px] text-on-surface-variant font-bold uppercase shrink-0">Completed</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {selectedTask && (
                <aside className="col-span-12 lg:col-span-4">
                  <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-6 shadow-executive sticky top-0">
                    <h3 className="text-base font-bold text-primary leading-snug">{selectedTask.title}</h3>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div>
                        <dt className="text-xs text-on-surface-variant uppercase tracking-wide">Assigned to</dt>
                        <dd className="font-semibold mt-0.5">{selectedTask.user_name || 'Unassigned'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-on-surface-variant uppercase tracking-wide">Due</dt>
                        <dd className="font-semibold mt-0.5">
                          <DateText value={selectedTask.due_date} />
                        </dd>
                      </div>
                    </dl>
                    <div className="flex flex-wrap gap-2 mt-6">
                      <button
                        type="button"
                        onClick={() => toggleTask(selectedTask)}
                        className="px-3 py-1.5 text-xs font-bold border border-outline-variant/30 rounded-lg hover:bg-surface-container-low"
                      >
                        {selectedTask.status === 'complete' ? 'Mark pending' : 'Mark completed'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditTask(selectedTask)}
                        className="px-3 py-1.5 text-xs font-bold border border-outline-variant/30 rounded-lg hover:bg-surface-container-low"
                      >
                        Edit task
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm('Delete this task?')) {
                            await onTaskDelete(selectedTask.id);
                            setSelectedTask(null);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-error border border-error/30 rounded-lg hover:bg-error/5"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </div>
        )}

        {view === 'activity' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
            {dashboardHeader}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-8">
                <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-6 shadow-executive">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Transaction Activity</h3>
                  </div>
                  <div className="space-y-6">
                    {activities.length === 0 ? (
                      <p className="text-sm text-on-surface-variant">No activity yet.</p>
                    ) : (
                      activities.map((a) => (
                        <div key={a.id} className="border-b border-outline-variant/10 pb-4 last:border-0">
                          <p className="text-sm">
                            <span className="font-semibold text-primary">
                              {a.summary || `${a.user_name || 'System'} ${activityLabel(a.event_type).toLowerCase()}`}
                            </span>
                          </p>
                          <DateText value={a.created_at?.slice(0, 10)} className="text-xs text-on-surface-variant mt-1 block" />
                          {a.detail && (
                            <p className="text-sm text-on-surface-variant mt-2 whitespace-pre-wrap bg-surface-container-low rounded-lg p-3">
                              {a.detail}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <aside className="col-span-12 lg:col-span-4">
                <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-6 shadow-executive">
                  <form onSubmit={submitComment}>
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Comments</label>
                    <textarea
                      id="tx-comment"
                      rows={5}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Type comment here…"
                      className="w-full mt-2 px-3 py-2 text-sm border border-outline-variant/30 rounded-lg resize-none focus:ring-2 focus:ring-secondary/30 outline-none"
                    />
                    <button type="submit" className="mt-3 w-full py-2.5 text-xs font-bold bg-primary-container text-white rounded-lg hover:brightness-110">
                      Post comment
                    </button>
                  </form>

                  {onCompleteOverdueTasks && overdueTasks.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-outline-variant/15">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                        Overdue tasks
                      </p>
                      <button
                        type="button"
                        disabled={completingOverdue}
                        onClick={handleCompleteOverdueTasks}
                        className="w-full py-2.5 text-xs font-bold text-secondary border border-secondary/30 rounded-lg hover:bg-secondary/5 transition-colors disabled:opacity-50"
                      >
                        {completingOverdue
                          ? 'Completing…'
                          : `Complete ${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`}
                      </button>
                    </div>
                  )}

                  {onDeleteTransaction && (
                    <div className="mt-6 pt-6 border-t border-error/20">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                        Danger zone
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          const label = street || transaction.address || 'this transaction';
                          if (!window.confirm(
                            `Remove ${label}? All tasks and activity for this transaction will be permanently deleted.`,
                          )) return;
                          await onDeleteTransaction();
                        }}
                        className="w-full py-2.5 text-xs font-bold text-error border border-error/30 rounded-lg hover:bg-error/5 transition-colors"
                      >
                        Remove transaction
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>

      {editTask && (
        <EditTaskModal
          task={editTask}
          users={users}
          transaction={transaction}
          onClose={() => setEditTask(null)}
          onSave={saveTaskEdit}
        />
      )}

      {showCreateTask && (
        <CreateTaskModal
          users={users}
          defaultTransactionId={transaction.id}
          lockTransaction
          transaction={transaction}
          onClose={() => setShowCreateTask(false)}
          onSave={handleCreateTask}
        />
      )}

      {showAddChecklist && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-primary">Add checklist</h2>
            <p className="text-sm text-on-surface-variant">
              Select templates to apply. Tasks are created from the template with current assignees and due dates.
            </p>
            {checklistActionError && (
              <p className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2" role="alert">
                {checklistActionError}
              </p>
            )}
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {availableTemplates.length === 0 ? (
                <p className="text-sm text-on-surface-variant py-4 text-center">All templates are already applied.</p>
              ) : (
                availableTemplates.map((t) => {
                  const checked = selectedTemplateIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={`flex items-start gap-3 w-full p-3 rounded-lg border cursor-pointer transition-colors ${
                        checked ? 'border-feather bg-feather/5' : 'border-outline-variant/20 hover:bg-surface-container-low'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddTemplate(t.id)}
                        className="mt-1 rounded border-outline-variant text-secondary"
                      />
                      <div>
                        <p className="font-semibold text-primary text-sm">{t.name}</p>
                        <p className="text-xs text-on-surface-variant">{t.tasks?.length || 0} tasks</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddChecklist(false);
                  setSelectedTemplateIds([]);
                  setChecklistActionError('');
                }}
                className="px-4 py-2 text-sm text-on-surface-variant"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyChecklists}
                disabled={checklistActionLoading || selectedTemplateIds.length === 0}
                className="px-4 py-2 bg-lemon text-feather font-bold rounded text-sm disabled:opacity-50"
              >
                {checklistActionLoading ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
