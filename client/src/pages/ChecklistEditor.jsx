import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
const TIMING_ANCHORS = ['CLOSING', 'LISTING', 'ACCEPTANCE', 'OPTION END', 'CREATED'];

function emptyTask(sortOrder) {
  return {
    id: null,
    title: '',
    timing_value: 0,
    timing_direction: 'A',
    timing_anchor: 'CLOSING',
    sort_order: sortOrder,
  };
}

export default function ChecklistEditor() {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadTemplates = useCallback(async (selectId) => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/checklists', { credentials: 'include' });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || 'Failed to load checklists');
      return;
    }
    const list = json.templates || [];
    setTemplates(list);

    let id = selectId;
    if (id != null && !list.some((t) => t.id === id)) id = null;
    if (id == null && list.length > 0) id = list[0].id;

    if (id != null) {
      const t = list.find((x) => x.id === id);
      setSelectedId(id);
      setDraft({
        id: t.id,
        name: t.name,
        category: t.category || 'TRANSACTION',
        tasks: (t.tasks || []).map((task) => ({ ...task })),
      });
    } else {
      setSelectedId(null);
      setDraft(null);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function selectTemplate(t) {
    setSelectedId(t.id);
    setDraft({
      id: t.id,
      name: t.name,
      category: t.category || 'TRANSACTION',
      tasks: (t.tasks || []).map((task) => ({ ...task })),
    });
    setMessage('');
    setError('');
  }

  async function createTemplate() {
    setSaving(true);
    setError('');
    const res = await fetch('/api/checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'New checklist', category: 'TRANSACTION' }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error || 'Could not create template');
      return;
    }
    setMessage('Template created');
    await loadTemplates(json.template.id);
  }

  async function saveTemplateMeta() {
    if (!draft?.id) return;
    setSaving(true);
    setError('');
    const res = await fetch(`/api/checklists/${draft.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: draft.name, category: draft.category }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error || 'Could not save template');
      return;
    }
    setMessage('Template saved');
    await loadTemplates(draft.id);
  }

  async function saveTask(task) {
    if (!draft?.id || !task.title?.trim()) return;
    const isNew = !task.id;
    const url = isNew
      ? `/api/checklists/${draft.id}/tasks`
      : `/api/checklists/${draft.id}/tasks/${task.id}`;
    const res = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: task.title,
        timing_value: task.timing_value,
        timing_direction: task.timing_direction,
        timing_anchor: task.timing_anchor,
        sort_order: task.sort_order,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Could not save task');
      return;
    }
    await loadTemplates(draft.id);
  }

  async function deleteTemplate() {
    if (!draft?.id) return;
    if (!window.confirm(`Delete checklist "${draft.name}"? This cannot be undone.`)) return;
    setSaving(true);
    const res = await fetch(`/api/checklists/${draft.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || 'Could not delete template');
      return;
    }
    setMessage('Template deleted');
    setSelectedId(null);
    setDraft(null);
    await loadTemplates();
  }

  async function deleteTask(taskId) {
    if (!draft?.id || !taskId) return;
    if (!window.confirm('Delete this task from the template?')) return;
    const res = await fetch(`/api/checklists/${draft.id}/tasks/${taskId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || 'Could not delete task');
      return;
    }
    await loadTemplates(draft.id);
  }

  async function reorderTask(index, direction) {
    if (!draft?.tasks) return;
    const next = index + direction;
    if (next < 0 || next >= draft.tasks.length) return;
    const tasks = [...draft.tasks];
    [tasks[index], tasks[next]] = [tasks[next], tasks[index]];
    const order = tasks.filter((t) => t.id).map((t) => t.id);
    if (order.length === 0) return;

    const res = await fetch(`/api/checklists/${draft.id}/tasks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ order }),
    });
    if (res.ok) await loadTemplates(draft.id);
  }

  function updateTaskField(index, key, value) {
    setDraft((prev) => {
      if (!prev) return prev;
      const tasks = prev.tasks.map((t, i) => (i === index ? { ...t, [key]: value } : t));
      return { ...prev, tasks };
    });
  }

  function addLocalTask() {
    setDraft((prev) => {
      if (!prev) return prev;
      const sort_order = prev.tasks.length;
      return { ...prev, tasks: [...prev.tasks, emptyTask(sort_order)] };
    });
  }

  return (
    <DashboardLayout title="Checklist Templates" className="bg-surface">
      <div className="max-w-[1440px] mx-auto px-8 py-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <Link
              to="/transactions"
              className="text-xs font-semibold text-secondary hover:underline uppercase tracking-widest mb-2 inline-block"
            >
              ← Back to Transactions
            </Link>
            <h1 className="text-3xl font-semibold text-primary tracking-tight">Edit Checklists</h1>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mt-1">
              Template tasks used when applying checklists to transactions
            </p>
          </div>
          <button
            type="button"
            onClick={createTemplate}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-primary-container text-white text-xs font-semibold uppercase tracking-wider hover:brightness-110 disabled:opacity-60"
          >
            <Plus size={18} /> New Checklist
          </button>
        </header>

        {message && <p className="text-sm text-secondary font-semibold mb-4">{message}</p>}
        {error && <p className="text-sm text-error font-semibold mb-4">{error}</p>}

        {loading ? (
          <p className="text-on-surface-variant">Loading checklists…</p>
        ) : (
          <div className="grid grid-cols-12 gap-6 min-h-[520px]">
            <aside className="col-span-12 lg:col-span-4 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-executive overflow-hidden flex flex-col">
              <div className="p-4 border-b border-outline-variant/15">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                  Templates ({templates.length})
                </p>
              </div>
              <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/10">
                {templates.length === 0 ? (
                  <li className="p-6 text-sm text-on-surface-variant">No checklists yet. Create one to get started.</li>
                ) : (
                  templates.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => selectTemplate(t)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          selectedId === t.id
                            ? 'bg-secondary/10 border-l-4 border-l-secondary'
                            : 'hover:bg-surface-container-low border-l-4 border-l-transparent'
                        }`}
                      >
                        <p className="text-sm font-semibold text-primary truncate">{t.name}</p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          {t.category || 'TRANSACTION'} · {(t.tasks || []).length} tasks
                        </p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </aside>

            <section className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-executive p-6 flex flex-col min-h-0">
              {!draft ? (
                <p className="text-on-surface-variant text-sm">Select or create a checklist template.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-end gap-4 mb-6 pb-6 border-b border-outline-variant/15">
                    <div className="flex-1 min-w-[200px] space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                        Checklist name
                      </label>
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                        className="w-full text-sm font-semibold text-primary bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 focus:ring-2 focus:ring-secondary/30 outline-none"
                      />
                    </div>
                    <div className="w-40 space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                        Category
                      </label>
                      <input
                        value={draft.category}
                        onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                        className="w-full text-sm text-primary bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 focus:ring-2 focus:ring-secondary/30 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={saveTemplateMeta}
                      disabled={saving || !draft.name.trim()}
                      className="px-4 py-2 bg-primary-container text-white text-xs font-bold uppercase tracking-wide rounded-lg hover:brightness-110 disabled:opacity-50"
                    >
                      Save template
                    </button>
                    <button
                      type="button"
                      onClick={deleteTemplate}
                      disabled={saving}
                      className="px-4 py-2 border border-error/30 text-error text-xs font-bold uppercase tracking-wide rounded-lg hover:bg-error/5"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                      <ListChecks size={16} /> Tasks ({draft.tasks.length})
                    </h2>
                    <button
                      type="button"
                      onClick={addLocalTask}
                      className="text-xs font-bold text-secondary hover:underline uppercase tracking-wide"
                    >
                      + Add task
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-0">
                    {draft.tasks.length === 0 ? (
                      <p className="text-sm text-on-surface-variant py-8 text-center">No tasks in this template.</p>
                    ) : (
                      draft.tasks.map((task, index) => (
                        <div
                          key={task.id ?? `new-${index}`}
                          className="grid grid-cols-12 gap-2 items-start p-3 bg-surface-container-low/50 border border-outline-variant/15 rounded-lg"
                        >
                          <div className="col-span-12 sm:col-span-5">
                            <input
                              value={task.title}
                              onChange={(e) => updateTaskField(index, 'title', e.target.value)}
                              onBlur={() => saveTask(task)}
                              placeholder="Task title"
                              className="w-full text-sm font-medium text-primary bg-transparent border border-outline-variant/20 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-secondary/30 outline-none"
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <input
                              type="number"
                              min={0}
                              value={task.timing_value ?? 0}
                              onChange={(e) => updateTaskField(index, 'timing_value', Number(e.target.value))}
                              onBlur={() => saveTask(task)}
                              title="Days offset"
                              className="w-full text-sm text-primary bg-surface border border-outline-variant/20 rounded-lg px-2 py-1.5"
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <select
                              value={task.timing_direction || 'A'}
                              onChange={(e) => {
                                updateTaskField(index, 'timing_direction', e.target.value);
                                const updated = { ...task, timing_direction: e.target.value };
                                saveTask(updated);
                              }}
                              className="w-full text-sm text-primary bg-surface border border-outline-variant/20 rounded-lg px-2 py-1.5"
                            >
                              <option value="A">After</option>
                              <option value="B">Before</option>
                            </select>
                          </div>
                          <div className="col-span-4 sm:col-span-3">
                            <select
                              value={task.timing_anchor || 'CLOSING'}
                              onChange={(e) => {
                                updateTaskField(index, 'timing_anchor', e.target.value);
                                saveTask({ ...task, timing_anchor: e.target.value });
                              }}
                              className="w-full text-sm text-primary bg-surface border border-outline-variant/20 rounded-lg px-2 py-1.5"
                            >
                              {TIMING_ANCHORS.map((a) => (
                                <option key={a} value={a}>{a}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-12 sm:col-span-12 flex items-center justify-end gap-1 sm:col-start-1">
                            <span className="text-[10px] text-on-surface-variant/60 mr-auto sm:mr-0 sm:hidden">
                              Order #{task.sort_order ?? index}
                            </span>
                            <button
                              type="button"
                              onClick={() => reorderTask(index, -1)}
                              disabled={index === 0}
                              className="p-1 text-on-surface-variant hover:text-primary disabled:opacity-30"
                              title="Move up"
                            >
                              <ChevronUp size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => reorderTask(index, 1)}
                              disabled={index === draft.tasks.length - 1}
                              className="p-1 text-on-surface-variant hover:text-primary disabled:opacity-30"
                              title="Move down"
                            >
                              <ChevronDown size={18} />
                            </button>
                            {task.id && (
                              <button
                                type="button"
                                onClick={() => deleteTask(task.id)}
                                className="p-1 text-on-surface-variant hover:text-error"
                                title="Delete task"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                            {!task.id && (
                              <button
                                type="button"
                                onClick={() => saveTask(task)}
                                disabled={!task.title?.trim()}
                                className="text-[10px] font-bold text-secondary uppercase px-2"
                              >
                                Save
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <p className="text-[11px] text-on-surface-variant/70 mt-4 pt-4 border-t border-outline-variant/10">
                    Timing: days before (B) or after (A) the anchor date on each transaction. Changes apply to newly applied checklists.
                  </p>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
