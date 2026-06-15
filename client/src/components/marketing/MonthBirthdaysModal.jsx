import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';

function formatDayHeader(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekdayDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function groupByDate(events) {
  const groups = new Map();
  for (const e of events) {
    if (!groups.has(e.date)) groups.set(e.date, []);
    groups.get(e.date).push(e);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function daysInMonth(viewDate) {
  return new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
}

function contactSnippet(contact) {
  return contact.email || contact.phone || contact.company || '—';
}

function formatBirthdayLabel(raw) {
  if (!raw?.trim()) return null;
  const s = raw.trim();

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (slash) {
    const d = new Date(2000, Number(slash[1]) - 1, Number(slash[2]));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  return s;
}

function AddBirthdayPanel({ viewDate, onCancel, onSave, saving }) {
  const [crmSearch, setCrmSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const dayCount = daysInMonth(viewDate);
  const monthShort = viewDate.toLocaleDateString('en-US', { month: 'short' });

  useEffect(() => {
    const q = crmSearch.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/crm?search=${encodeURIComponent(q)}&limit=20`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          setResults(json.contacts || []);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [crmSearch]);

  async function handleSave() {
    if (!selectedContact) {
      setError('Select a CRM contact');
      return;
    }
    setError('');
    setSuccess('');
    try {
      await onSave({ contactId: selectedContact.id, day: selectedDay });
      setSuccess(`Birthday added for ${selectedContact.name}`);
      setSelectedContact(null);
      setCrmSearch('');
      setResults([]);
    } catch (err) {
      setError(err.message || 'Could not save birthday');
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-purple/5 border-b border-purple/10">
      <div className="px-5 py-4 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-feather flex items-center gap-1.5">
            <Icon name="person_add" className="!text-[18px] text-purple" />
            Add birthday
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-on-surface-variant hover:text-feather"
          >
            Cancel
          </button>
        </div>
        <p className="text-xs text-on-surface-variant">Link an existing CRM contact to a day in {monthShort}.</p>

        <div className="relative">
          <Icon
            name="search"
            className="!text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none"
          />
          <input
            type="search"
            value={crmSearch}
            onChange={(e) => {
              setCrmSearch(e.target.value);
              setSelectedContact(null);
            }}
            placeholder="Search CRM by name, email, phone…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-outline-variant/20 bg-white focus:outline-none focus:ring-2 focus:ring-purple/25"
          />
        </div>

        {selectedContact ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-purple/20">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-feather truncate">{selectedContact.name}</p>
              <p className="text-xs text-on-surface-variant truncate">{contactSnippet(selectedContact)}</p>
              {selectedContact.birthday?.trim() && (
                <p className="text-xs text-purple font-medium mt-0.5 flex items-center gap-1">
                  <Icon name="cake" className="!text-[14px]" />
                  Birthday {formatBirthdayLabel(selectedContact.birthday)}
                </p>
              )}
            </div>
            <Link
              to={`/crm/${selectedContact.id}`}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-purple hover:bg-purple/10 shrink-0"
              aria-label={`Open ${selectedContact.name} in CRM`}
            >
              <Icon name="open_in_new" className="!text-[16px]" />
            </Link>
            <button
              type="button"
              onClick={() => setSelectedContact(null)}
              className="text-xs font-semibold text-on-surface-variant hover:underline shrink-0"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="max-h-36 overflow-y-auto custom-scrollbar rounded-xl border border-outline-variant/15 bg-white">
            {searching && (
              <p className="text-xs text-on-surface-variant px-3 py-3">Searching…</p>
            )}
            {!searching && crmSearch.trim().length < 2 && (
              <p className="text-xs text-on-surface-variant px-3 py-3">Type at least 2 characters to search.</p>
            )}
            {!searching && crmSearch.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-on-surface-variant px-3 py-3">No contacts found.</p>
            )}
            {results.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => setSelectedContact(contact)}
                className="w-full text-left px-3 py-2.5 hover:bg-off-white border-b border-outline-variant/8 last:border-0"
              >
                <span className="flex items-center gap-2">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-feather truncate">{contact.name}</span>
                    <span className="block text-[11px] text-on-surface-variant truncate">{contactSnippet(contact)}</span>
                  </span>
                  {!contact.birthday?.trim() ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-purple/80 shrink-0">
                      No birthday
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-purple shrink-0 flex items-center gap-0.5">
                      <Icon name="cake" className="!text-[12px]" />
                      {formatBirthdayLabel(contact.birthday)}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-on-surface-variant">Day in {monthShort}</label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-outline-variant/20 bg-white focus:outline-none focus:ring-2 focus:ring-purple/25"
          >
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {monthShort} {day}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}
        {success && <p className="text-xs text-secondary font-medium">{success}</p>}

        <button
          type="button"
          disabled={saving || !selectedContact}
          onClick={handleSave}
          className="w-full py-2.5 text-sm font-semibold bg-feather text-white rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save birthday'}
        </button>
      </div>
    </div>
  );
}

const STICKY_HEADER_CLASS =
  'sticky top-0 z-10 text-[10px] font-bold uppercase tracking-wider text-purple px-2 py-1.5 bg-white border-b border-outline-variant/10 shadow-[0_1px_0_rgba(255,255,255,1)]';

export default function MonthBirthdaysModal({
  open,
  viewDate,
  events,
  pinnedIds,
  onClose,
  onSavePins,
  onAddBirthday,
}) {
  const [search, setSearch] = useState('');
  const [localPinned, setLocalPinned] = useState(() => new Set(pinnedIds));
  const [saving, setSaving] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addingBirthday, setAddingBirthday] = useState(false);

  const monthTitle = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setShowAddPanel(false);
    setLocalPinned(new Set(pinnedIds));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLocalPinned(new Set(pinnedIds));
  }, [pinnedIds, open]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(e) {
      if (e.key !== 'Escape') return;
      setShowAddPanel((show) => {
        if (show) return false;
        onClose();
        return show;
      });
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => e.name?.toLowerCase().includes(q));
  }, [events, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  if (!open) return null;

  async function persistPins(nextSet, wasEmpty) {
    const contactIds = [...nextSet];
    setSaving(true);
    try {
      await onSavePins(contactIds, { firstPin: wasEmpty && contactIds.length > 0 });
    } catch (err) {
      setLocalPinned(new Set(pinnedIds));
      window.alert(err.message || 'Could not save birthday selections');
    } finally {
      setSaving(false);
    }
  }

  function toggleContact(contactId) {
    const wasEmpty = localPinned.size === 0;
    const next = new Set(localPinned);
    if (next.has(contactId)) next.delete(contactId);
    else next.add(contactId);
    setLocalPinned(next);
    persistPins(next, wasEmpty);
  }

  function selectAllVisible() {
    const wasEmpty = localPinned.size === 0;
    const next = new Set(localPinned);
    for (const e of filtered) next.add(e.contact_id);
    setLocalPinned(next);
    persistPins(next, wasEmpty);
  }

  function clearAll() {
    setLocalPinned(new Set());
    persistPins(new Set(), false);
  }

  async function handleAddBirthday({ contactId, day }) {
    setAddingBirthday(true);
    try {
      await onAddBirthday({ contactId, day });
      setLocalPinned((prev) => new Set([...prev, contactId]));
    } finally {
      setAddingBirthday(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[min(85vh,640px)] flex flex-col overflow-hidden border border-purple/10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="month-birthdays-title"
      >
        <div className="bg-gradient-to-r from-purple/10 to-purple/5 px-5 py-4 border-b border-purple/10 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="month-birthdays-title" className="text-lg font-bold text-feather flex items-center gap-2">
                <Icon name="cake" className="!text-[22px] text-purple" />
                {monthTitle} Birthdays
              </h2>
              <p className="text-xs text-on-surface-variant mt-1">Choose clients to show on the calendar</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-on-surface-variant hover:bg-white/80 hover:text-feather"
              aria-label="Close"
            >
              <Icon name="close" />
            </button>
          </div>

          {!showAddPanel && (
            <>
              <div className="mt-3 relative">
                <Icon
                  name="search"
                  className="!text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-outline-variant/20 bg-white focus:outline-none focus:ring-2 focus:ring-purple/25"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPanel(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-purple border border-purple/25 rounded-full px-2.5 py-1 hover:bg-purple/10"
                >
                  <Icon name="add" className="!text-[14px]" />
                  Add birthday
                </button>
                {events.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={selectAllVisible}
                      disabled={saving || filtered.length === 0}
                      className="text-xs font-semibold text-secondary hover:underline disabled:opacity-50"
                    >
                      Select all{search.trim() ? ' shown' : ''}
                    </button>
                    <button
                      type="button"
                      onClick={clearAll}
                      disabled={saving || localPinned.size === 0}
                      className="text-xs font-semibold text-on-surface-variant hover:underline disabled:opacity-50"
                    >
                      Clear all
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {showAddPanel ? (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <AddBirthdayPanel
              viewDate={viewDate}
              onCancel={() => setShowAddPanel(false)}
              onSave={handleAddBirthday}
              saving={addingBirthday}
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-purple/10 flex items-center justify-center mb-3">
                  <Icon name="cake" className="!text-[28px] text-purple/70" />
                </div>
                <p className="text-sm font-medium text-feather">No birthdays this month</p>
                <p className="text-xs text-on-surface-variant mt-1 mb-4">Add a birthday from CRM or import contacts.</p>
                <button
                  type="button"
                  onClick={() => setShowAddPanel(true)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-purple border border-purple/25 rounded-lg px-4 py-2 hover:bg-purple/10"
                >
                  <Icon name="add" className="!text-[16px]" />
                  Add birthday
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-12 px-4">No matches for &ldquo;{search}&rdquo;</p>
            ) : (
              <div className="px-2 pb-2">
                {grouped.map(([dateStr, dayEvents]) => (
                  <Fragment key={dateStr}>
                    <p className={STICKY_HEADER_CLASS}>{formatDayHeader(dateStr)}</p>
                    <ul className="space-y-0.5 pb-2">
                      {dayEvents.map((event) => {
                        const checked = localPinned.has(event.contact_id);
                        return (
                          <li key={`${event.contact_id}-${event.date}`}>
                            <label
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                checked ? 'bg-purple/8 hover:bg-purple/12' : 'hover:bg-off-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={saving}
                                onChange={() => toggleContact(event.contact_id)}
                                className="w-4 h-4 rounded border-outline-variant/40 text-purple focus:ring-purple/30 shrink-0"
                              />
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-medium text-feather truncate">{event.name}</span>
                                <span className="block text-[11px] text-on-surface-variant">{formatWeekdayDate(event.date)}</span>
                              </span>
                              <Link
                                to={`/crm/${event.contact_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-lg text-on-surface-variant hover:text-purple hover:bg-purple/10 shrink-0"
                                aria-label={`Open ${event.name} in CRM`}
                              >
                                <Icon name="open_in_new" className="!text-[16px]" />
                              </Link>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="shrink-0 px-5 py-3 border-t border-outline-variant/10 flex items-center justify-between gap-3 bg-off-white/50">
          <span className="text-xs text-on-surface-variant">
            <span className="font-semibold text-purple">{localPinned.size}</span> selected
            {events.length > 0 && (
              <span className="text-on-surface-variant/70"> · {events.length} this month</span>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-feather text-white text-sm font-semibold rounded-lg hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
