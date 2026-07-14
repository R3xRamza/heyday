import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';
import TeamAvatar from '../components/TeamAvatar';
import DateText from '../components/shared/DateText';
import { getTeamProfile } from '../data/teamProfiles';
import { formatCurrency, shortAddress } from '../utils/format';
import ClosingSoonPanel from '../components/tasks/ClosingSoonPanel';
import AgentScopeToggle from '../components/AgentScopeToggle';
import { useAgentScope } from '../context/AgentScopeContext';
import { appendAgentScope } from '../utils/agentScope';

const STAT_CARDS = [
  {
    key: 'closedYtd',
    label: 'Closed YTD',
    icon: 'paid',
    accent: 'from-secondary/20 to-secondary/5',
    iconBg: 'bg-secondary text-white',
    path: '/transactions?filter=closed',
    volume: (s) => formatCurrency(s?.closedYtd?.volume ?? 0),
    sub: (s) => {
      const n = s?.closedYtd?.count ?? 0;
      return `${n} closing${n === 1 ? '' : 's'}`;
    },
  },
  {
    key: 'comingSoon',
    label: 'Coming Soon',
    icon: 'schedule',
    accent: 'from-lemon/40 to-lemon/10',
    iconBg: 'bg-lemon text-feather',
    path: '/transactions?filter=coming_soon',
    volume: (s) => formatCurrency(s?.comingSoonStats?.volume ?? 0),
    sub: (s) => {
      const n = s?.comingSoonStats?.count ?? 0;
      return `${n} future listing${n === 1 ? '' : 's'}`;
    },
  },
  {
    key: 'listings',
    label: 'Listings',
    icon: 'home_work',
    accent: 'from-sky/25 to-secondary/10',
    iconBg: 'bg-sky text-feather',
    path: '/transactions?filter=current_listings',
    volume: (s) => formatCurrency(s?.activeListings?.volume ?? 0),
    sub: (s) => `${s?.activeListings?.count ?? 0} on market`,
  },
  {
    key: 'pending',
    label: 'Pending',
    icon: 'handshake',
    accent: 'from-feather/15 to-sky/10',
    iconBg: 'bg-feather text-lemon',
    path: '/transactions?filter=pending',
    volume: (s) => formatCurrency(s?.pending?.volume ?? 0),
    sub: (s) => `${s?.pending?.count ?? 0} under contract`,
  },
];

const TX_PANELS = [
  {
    key: 'comingSoon',
    title: 'Coming Soon',
    icon: 'schedule',
    header: 'bg-tertiary text-white',
    iconColor: 'text-light-pink',
    link: '/transactions?filter=coming_soon',
    dateField: 'listing_date',
    dateLabel: 'Lists',
    empty: 'No upcoming listings.',
  },
  {
    key: 'listings',
    title: 'Listings',
    icon: 'real_estate_agent',
    header: 'bg-secondary text-white',
    iconColor: 'text-lemon',
    link: '/transactions?filter=current_listings',
    dateField: 'listing_date',
    dateLabel: 'Listed',
    empty: 'Nothing on market.',
  },
  {
    key: 'pendingDeals',
    title: 'Pending',
    icon: 'key',
    header: 'bg-feather text-white',
    iconColor: 'text-lemon',
    link: '/transactions?filter=pending',
    dateField: 'close_date',
    dateLabel: 'Close',
    empty: 'Nothing pending.',
  },
];

const CELEBRATION_SHORT = {
  'birthday:contact': 'Bday',
  'birthday:child': 'Bday',
  'birthday:partner': 'Partner',
  'anniversary:contact': 'Anniv',
  'anniversary:home': 'Home',
};

const CELEBRATION_CHIP = {
  'birthday:contact': 'bg-secondary/15 text-secondary border-secondary/25',
  'birthday:child': 'bg-lemon/50 text-feather border-lemon',
  'birthday:partner': 'bg-sky/20 text-secondary border-sky/30',
  'anniversary:contact': 'bg-tertiary-container/15 text-tertiary border-tertiary/20',
  'anniversary:home': 'bg-primary-container/10 text-primary-container border-primary-container/20',
};

function celebrationShort(event) {
  return CELEBRATION_SHORT[`${event.type}:${event.subtype || 'contact'}`]
    || (event.type === 'anniversary' ? 'Anniv' : 'Bday');
}

function celebrationChipClass(event) {
  return CELEBRATION_CHIP[`${event.type}:${event.subtype || 'contact'}`]
    || 'bg-surface-container-high text-on-surface-variant border-outline-variant/30';
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${String(dateStr).replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function celebrationWindowLabel() {
  const day = new Date().getDay();
  return day === 5 ? 'Today & this weekend' : 'Today';
}

function CelebrationChip({ event }) {
  return (
    <Link
      to={`/crm/${event.contact_id}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${celebrationChipClass(event)} hover:brightness-95 transition-all`}
    >
      <span className="truncate max-w-[8rem]">{event.name}</span>
      <span className="opacity-70">·</span>
      <span className="shrink-0">{celebrationShort(event)}</span>
      {event.subtype === 'child' && <span className="text-[9px] font-black uppercase opacity-80">kid</span>}
    </Link>
  );
}

function CelebrationSection({ icon, title, events, emptyLabel }) {
  return (
    <div className="flex items-center gap-2 flex-wrap rounded-xl bg-gradient-to-r from-lemon/30 via-secondary/10 to-sky/20 border border-secondary/15 px-3 py-2 min-h-[2.5rem]">
      <Icon name={icon} className="text-tertiary !text-[18px] shrink-0" />
      <span className="text-[10px] font-black uppercase tracking-widest text-tertiary shrink-0">
        {title}
      </span>
      {events.length === 0 ? (
        <span className="text-xs text-on-surface-variant">{emptyLabel}</span>
      ) : (
        events.map((e, i) => (
          <CelebrationChip key={`${e.type}-${e.subtype}-${e.contact_id}-${e.date}-${i}`} event={e} />
        ))
      )}
    </div>
  );
}

function StatCard({ card, stats, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden bg-gradient-to-br ${card.accent} p-3 rounded-lg border border-white/60 shadow-executive text-left transition-all hover:shadow-[0_4px_14px_rgba(5,62,63,0.12)] hover:-translate-y-0.5`}
    >
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md shadow-sm ${card.iconBg}`}>
          <Icon name={card.icon} className="!text-[16px]" />
        </span>
        <Icon name="arrow_forward" className="!text-[15px] text-on-surface-variant/40 group-hover:text-secondary transition-colors" />
      </div>
      <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">{card.label}</p>
      <h2 className="text-lg font-bold text-primary leading-tight mt-0.5">{card.volume(stats)}</h2>
      <p className="text-[10px] text-on-surface-variant mt-0.5 leading-snug">{card.sub(stats)}</p>
    </button>
  );
}

function TxRow({ tx, dateField, dateLabel, onClick }) {
  const dateVal = tx[dateField];
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-2 py-1 rounded hover:bg-white/80 transition-colors border border-transparent hover:border-primary/5"
    >
      <div className="flex items-baseline justify-between gap-2 leading-tight">
        <p className="text-xs font-semibold text-primary truncate">{shortAddress(tx.address)}</p>
        <span className="text-[10px] font-bold text-secondary shrink-0">{formatCurrency(tx.value)}</span>
      </div>
      <p className="text-[10px] text-on-surface-variant truncate leading-tight mt-px">
        {tx.client_name || '—'}
        {dateVal && (
          <>
            <span className="text-outline-variant"> · </span>
            {dateLabel} <DateText value={dateVal} />
          </>
        )}
      </p>
    </button>
  );
}

const TX_PANEL_HEIGHT = 'h-[21rem]';
const HUB_SIDE_PANEL_HEIGHT = 'h-[22rem]';

function isPinnedMessage(m) {
  return m?.pinned === 1 || m?.pinned === true;
}

function sortMessages(list) {
  return [...list].sort((a, b) => {
    const ap = isPinnedMessage(a) ? 1 : 0;
    const bp = isPinnedMessage(b) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return (a.id || 0) - (b.id || 0);
  });
}

function moveItemToIndex(list, fromId, insertIndex) {
  const from = list.findIndex((item) => item.id === fromId);
  if (from < 0 || insertIndex == null) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  const clamped = Math.max(0, Math.min(insertIndex, next.length));
  next.splice(clamped, 0, item);
  return next;
}

function TxPanel({ panel, rows, onRowClick, onViewAll }) {
  return (
    <section className={`bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden flex flex-col ${TX_PANEL_HEIGHT}`}>
      <div className={`${panel.header} px-3 py-2 flex items-center justify-between shrink-0`}>
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <Icon name={panel.icon} className={`${panel.iconColor} !text-[17px]`} />
          {panel.title}
        </h3>
        <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">{rows.length}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar bg-gradient-to-b from-surface-container-low/30 to-white px-0.5 py-0.5">
        {rows.length === 0 ? (
          <p className="px-3 pt-4 text-xs text-on-surface-variant">{panel.empty}</p>
        ) : (
          rows.map((tx) => (
            <TxRow
              key={tx.id}
              tx={tx}
              dateField={panel.dateField}
              dateLabel={panel.dateLabel}
              onClick={() => onRowClick(tx.id)}
            />
          ))
        )}
      </div>
      <button
        type="button"
        onClick={onViewAll}
        className="shrink-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-secondary hover:bg-secondary/5 border-t border-primary/5 transition-colors"
      >
        View all →
      </button>
    </section>
  );
}

function TaskStatRow({ label, thisWeekCount, overdueCount }) {
  return (
    <div>
      <p className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">{label}</p>
      <div className="flex gap-1.5">
        <div className="flex-1 rounded-md bg-secondary/10 px-2 py-1 text-center">
          <div className="text-lg font-black text-secondary leading-none tabular-nums">{thisWeekCount}</div>
          <div className="text-[8px] uppercase font-bold text-on-surface-variant">This Week</div>
        </div>
        <div className={`flex-1 rounded-md px-2 py-1 text-center ${overdueCount > 0 ? 'bg-error/10' : 'bg-surface-container-low'}`}>
          <div className={`text-lg font-black leading-none tabular-nums ${overdueCount > 0 ? 'text-error' : 'text-primary'}`}>
            {overdueCount}
          </div>
          <div className={`text-[8px] uppercase font-bold ${overdueCount > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
            Overdue
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeamExecutiveOps() {
  const navigate = useNavigate();
  const { scope } = useAgentScope();
  const [stats, setStats] = useState(null);
  const [celebrations, setCelebrations] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [links, setLinks] = useState([]);
  const [closings, setClosings] = useState([]);
  const [loadingClosings, setLoadingClosings] = useState(true);
  const [expirations, setExpirations] = useState([]);
  const [loadingExpirations, setLoadingExpirations] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkForm, setLinkForm] = useState({ label: '', url: '' });
  const [dragLinkId, setDragLinkId] = useState(null);
  const [dragInsertIndex, setDragInsertIndex] = useState(null);
  const [linkOrderError, setLinkOrderError] = useState('');
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [editLinkForm, setEditLinkForm] = useState({ label: '', url: '' });
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editMessageBody, setEditMessageBody] = useState('');
  const [dragMessageId, setDragMessageId] = useState(null);
  const [dragMessageInsertIndex, setDragMessageInsertIndex] = useState(null);
  const [messageOrderError, setMessageOrderError] = useState('');
  const linksRef = useRef(links);
  const linksBeforeDragRef = useRef(null);
  const dragLinkIdRef = useRef(null);
  const dragInsertIndexRef = useRef(null);
  const messagesRef = useRef(messages);
  const messagesBeforeDragRef = useRef(null);
  const dragMessageIdRef = useRef(null);
  const dragMessageInsertIndexRef = useRef(null);

  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const celebrationLabel = useMemo(() => celebrationWindowLabel(), []);

  const birthdayEvents = useMemo(
    () => celebrations.filter((e) => e.type === 'birthday' || (e.type === 'anniversary' && e.subtype === 'contact')),
    [celebrations],
  );

  const homeAnniversaryEvents = useMemo(
    () => celebrations.filter((e) => e.type === 'anniversary' && e.subtype === 'home'),
    [celebrations],
  );

  useEffect(() => {
    setLoadingStats(true);
    setLoadingClosings(true);
    setLoadingExpirations(true);
    fetch(appendAgentScope('/api/team-hub/stats', scope), { credentials: 'include' })
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoadingStats(false));
    fetch('/api/team-hub/celebrations?window=hub', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setCelebrations(json.events || []));
    fetch(appendAgentScope('/api/team', scope), { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setTeamTasks(json.members || []));
    fetch('/api/team-hub/links', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setLinks(json.links || []));
    fetch(appendAgentScope('/api/tasks/milestones', scope), { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setClosings(json.milestones || []))
      .finally(() => setLoadingClosings(false));
    fetch(appendAgentScope('/api/tasks/expirations', scope), { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setExpirations(json.milestones || []))
      .finally(() => setLoadingExpirations(false));
  }, [scope]);

  const fetchMessages = useCallback(() => {
    fetch('/api/team-hub/messages', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setMessages(sortMessages(json.messages || [])));
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  async function postMessage(e) {
    e.preventDefault();
    const body = composer.trim();
    if (!body) return;
    setPosting(true);
    const res = await fetch('/api/team-hub/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const json = await res.json();
      setComposer('');
      setMessages((prev) => sortMessages([json.message, ...prev]));
    }
    setPosting(false);
  }

  async function deleteMessage(id) {
    const res = await fetch(`/api/team-hub/messages/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (editingMessageId === id) {
        setEditingMessageId(null);
        setEditMessageBody('');
      }
    }
  }

  async function patchMessage(id, payload) {
    const res = await fetch(`/api/team-hub/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const json = await res.json();
    setMessages((prev) => sortMessages(prev.map((m) => (m.id === id ? json.message : m))));
    return json.message;
  }

  async function togglePinMessage(m) {
    await patchMessage(m.id, { pinned: !isPinnedMessage(m) });
  }

  function startEditMessage(m) {
    setEditingMessageId(m.id);
    setEditMessageBody(m.body || '');
  }

  function cancelEditMessage() {
    setEditingMessageId(null);
    setEditMessageBody('');
  }

  async function saveEditMessage(id) {
    const body = editMessageBody.trim();
    if (!body) return;
    const updated = await patchMessage(id, { body });
    if (updated) cancelEditMessage();
  }

  function handleMessageDragStart(e, id) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
    messagesBeforeDragRef.current = messagesRef.current;
    const fromIndex = messagesRef.current.findIndex((m) => m.id === id);
    dragMessageIdRef.current = id;
    dragMessageInsertIndexRef.current = fromIndex;
    setDragMessageId(id);
    setDragMessageInsertIndex(fromIndex);
    setMessageOrderError('');
  }

  function handleMessageDragOver(e, overId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const fromId = dragMessageIdRef.current;
    if (fromId == null) return;

    const list = messagesRef.current;
    const fromIndex = list.findIndex((m) => m.id === fromId);
    const overIndex = list.findIndex((m) => m.id === overId);
    if (fromIndex < 0 || overIndex < 0) return;

    const fromItem = list[fromIndex];
    const overItem = list[overIndex];
    if (isPinnedMessage(fromItem) !== isPinnedMessage(overItem)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    let insertIndex = after ? overIndex + 1 : overIndex;
    if (fromIndex < insertIndex) insertIndex -= 1;
    insertIndex = Math.max(0, Math.min(list.length - 1, insertIndex));

    // Keep insert within the same pin group bounds
    const samePin = list
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => isPinnedMessage(m) === isPinnedMessage(fromItem))
      .map(({ i }) => i);
    const minI = samePin[0];
    const maxI = samePin[samePin.length - 1];
    insertIndex = Math.max(minI, Math.min(maxI, insertIndex));

    if (dragMessageInsertIndexRef.current === insertIndex) return;
    dragMessageInsertIndexRef.current = insertIndex;
    setDragMessageInsertIndex(insertIndex);
  }

  async function handleMessageDragEnd() {
    const fromId = dragMessageIdRef.current;
    const insertIndex = dragMessageInsertIndexRef.current;
    dragMessageIdRef.current = null;
    dragMessageInsertIndexRef.current = null;
    setDragMessageId(null);
    setDragMessageInsertIndex(null);
    if (fromId == null || insertIndex == null) return;

    const previous = messagesBeforeDragRef.current || messagesRef.current;
    const next = moveItemToIndex(previous, fromId, insertIndex);
    const unchanged = previous.length === next.length
      && previous.every((m, i) => m.id === next[i].id);
    if (unchanged) return;

    setMessages(next);
    messagesRef.current = next;

    const res = await fetch('/api/team-hub/messages/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ordered_ids: next.map((m) => m.id) }),
    });
    if (!res.ok) {
      setMessages(previous);
      messagesRef.current = previous;
      setMessageOrderError('Could not save message order');
      return;
    }
    const json = await res.json();
    if (json.messages) {
      const sorted = sortMessages(json.messages);
      setMessages(sorted);
      messagesRef.current = sorted;
    }
  }

  async function addLink(e) {
    e.preventDefault();
    if (!linkForm.label.trim() || !linkForm.url.trim()) return;
    const res = await fetch('/api/team-hub/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(linkForm),
    });
    if (res.ok) {
      const json = await res.json();
      setLinks((prev) => [...prev, json.link]);
      setLinkForm({ label: '', url: '' });
      setShowAddLink(false);
    }
  }

  async function removeLink(id) {
    const res = await fetch(`/api/team-hub/links/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      setLinks((prev) => prev.filter((l) => l.id !== id));
      if (editingLinkId === id) {
        setEditingLinkId(null);
        setEditLinkForm({ label: '', url: '' });
      }
    }
  }

  function startEditLink(l) {
    setEditingLinkId(l.id);
    setEditLinkForm({ label: l.label || '', url: l.url || '' });
  }

  function cancelEditLink() {
    setEditingLinkId(null);
    setEditLinkForm({ label: '', url: '' });
  }

  async function saveEditLink(e) {
    e.preventDefault();
    if (!editingLinkId) return;
    const label = editLinkForm.label.trim();
    const url = editLinkForm.url.trim();
    if (!label || !url) return;
    const res = await fetch(`/api/team-hub/links/${editingLinkId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ label, url }),
    });
    if (!res.ok) return;
    const json = await res.json();
    setLinks((prev) => prev.map((l) => (l.id === editingLinkId ? json.link : l)));
    cancelEditLink();
  }

  function handleLinkDragStart(e, id) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
    linksBeforeDragRef.current = linksRef.current;
    const fromIndex = linksRef.current.findIndex((l) => l.id === id);
    dragLinkIdRef.current = id;
    dragInsertIndexRef.current = fromIndex;
    setDragLinkId(id);
    setDragInsertIndex(fromIndex);
    setLinkOrderError('');
  }

  function handleLinkDragOver(e, overId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const fromId = dragLinkIdRef.current;
    if (fromId == null) return;

    const list = linksRef.current;
    const fromIndex = list.findIndex((l) => l.id === fromId);
    const overIndex = list.findIndex((l) => l.id === overId);
    if (fromIndex < 0 || overIndex < 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    let insertIndex = after ? overIndex + 1 : overIndex;
    if (fromIndex < insertIndex) insertIndex -= 1;
    insertIndex = Math.max(0, Math.min(list.length - 1, insertIndex));

    if (dragInsertIndexRef.current === insertIndex) return;
    dragInsertIndexRef.current = insertIndex;
    setDragInsertIndex(insertIndex);
  }

  async function handleLinkDragEnd() {
    const fromId = dragLinkIdRef.current;
    const insertIndex = dragInsertIndexRef.current;
    dragLinkIdRef.current = null;
    dragInsertIndexRef.current = null;
    setDragLinkId(null);
    setDragInsertIndex(null);
    if (fromId == null || insertIndex == null) return;

    const previous = linksBeforeDragRef.current || linksRef.current;
    const next = moveItemToIndex(previous, fromId, insertIndex);
    const unchanged = previous.length === next.length
      && previous.every((l, i) => l.id === next[i].id);
    if (unchanged) return;

    setLinks(next);
    linksRef.current = next;

    const res = await fetch('/api/team-hub/links/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ordered_ids: next.map((l) => l.id) }),
    });
    if (!res.ok) {
      setLinks(previous);
      linksRef.current = previous;
      setLinkOrderError('Could not save link order');
      return;
    }
    const json = await res.json();
    if (json.links) {
      setLinks(json.links);
      linksRef.current = json.links;
    }
  }

  return (
    <DashboardLayout title="Team Hub" headerRight={<AgentScopeToggle />} className="p-5 md:p-6">
      <div className="space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 md:gap-3">
          {loadingStats
            ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-outline-variant/15 shadow-executive animate-pulse h-[5.25rem] bg-white" />
            ))
            : STAT_CARDS.map((card) => (
              <StatCard key={card.key} card={card} stats={stats} onClick={() => navigate(card.path)} />
            ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
          {TX_PANELS.map((panel) => (
            <TxPanel
              key={panel.key}
              panel={panel}
              rows={stats?.[panel.key] ?? []}
              onRowClick={(id) => navigate(`/transactions/${id}`)}
              onViewAll={() => navigate(panel.link)}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
          <ClosingSoonPanel
            milestones={closings}
            loading={loadingClosings}
            layout="horizontal"
            className="col-span-2 xl:col-span-3 min-w-0"
          />

          <ClosingSoonPanel
            title="Expiring in Next 30 Days"
            icon="event_busy"
            milestones={expirations}
            loading={loadingExpirations}
            layout="horizontal"
            size="compact"
            className="col-span-2 xl:col-span-1 min-w-0"
            emptyMessage="None in 30 days."
            loadingMessage="Loading…"
            viewAllTo="/transactions?filter=current_listings"
          />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {teamTasks.map((m) => {
            const profile = getTeamProfile(m.email);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/tasks/${m.id}`)}
                className="group w-full bg-white p-3.5 rounded-xl border border-outline-variant/15 shadow-executive hover:border-secondary/40 transition-all text-left flex flex-col items-stretch"
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <TeamAvatar email={m.email} name={m.name} size="sm" borderClassName="border-2 border-surface-container" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-primary truncate group-hover:text-secondary">{m.name}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant truncate">{profile.role}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <TaskStatRow
                    label="Transaction tasks"
                    thisWeekCount={m.transaction?.thisWeek ?? 0}
                    overdueCount={m.transaction?.overdue ?? 0}
                  />
                  <TaskStatRow
                    label="Admin tasks"
                    thisWeekCount={m.admin?.thisWeek ?? 0}
                    overdueCount={m.admin?.overdue ?? 0}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">
            {celebrationLabel}
          </p>
          <CelebrationSection
            icon="cake"
            title="Birthdays"
            events={birthdayEvents}
            emptyLabel="No birthdays"
          />
          <CelebrationSection
            icon="home"
            title="Home Anniversaries"
            events={homeAnniversaryEvents}
            emptyLabel="No home anniversaries"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
          <section className={`lg:col-span-8 bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden flex flex-col ${HUB_SIDE_PANEL_HEIGHT}`}>
            <div className="bg-feather px-4 py-2.5 flex items-center gap-2 shrink-0">
              <Icon name="campaign" className="text-lemon !text-[18px]" />
              <h3 className="text-sm font-bold text-white">Messages</h3>
            </div>
            <form onSubmit={postMessage} className="px-3 py-2.5 bg-surface-container-low/50 border-b border-primary/5 flex gap-2 shrink-0">
              <textarea
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="Team update…"
                rows={1}
                className="flex-1 bg-white border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-secondary/25 outline-none resize-none"
              />
              <button
                type="submit"
                disabled={posting || !composer.trim()}
                className="px-4 py-2 bg-lemon text-feather font-bold rounded-lg text-xs hover:brightness-105 disabled:opacity-50 shrink-0 self-end"
              >
                {posting ? '…' : 'Post'}
              </button>
            </form>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-2 space-y-1.5">
              {messages.length === 0 ? (
                <p className="py-4 text-xs text-on-surface-variant text-center">No messages yet.</p>
              ) : (
                <>
                  {messageOrderError && (
                    <p className="text-[11px] text-error px-1">{messageOrderError}</p>
                  )}
                  {messages.map((m, index) => {
                    const pinned = isPinnedMessage(m);
                    const editing = editingMessageId === m.id;
                    return (
                      <div key={m.id}>
                        {dragMessageId != null && dragMessageInsertIndex === index && (
                          <div className="h-0.5 mb-1 rounded bg-lemon" aria-hidden />
                        )}
                        <div
                          onDragOver={(e) => handleMessageDragOver(e, m.id)}
                          onDrop={(e) => e.preventDefault()}
                          className={`group flex gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                            dragMessageId === m.id ? 'opacity-50' : ''
                          } ${
                            pinned ? 'bg-lemon/15 border border-lemon/30' : 'bg-surface-container-low/40 hover:bg-surface-container-low'
                          }`}
                        >
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => handleMessageDragStart(e, m.id)}
                            onDragEnd={handleMessageDragEnd}
                            aria-label="Reorder message"
                            title="Drag to reorder"
                            className="p-0.5 mt-0.5 text-on-surface-variant/40 hover:text-on-surface-variant cursor-grab active:cursor-grabbing shrink-0 self-start"
                          >
                            <Icon name="drag_indicator" className="!text-[16px]" />
                          </button>
                          <TeamAvatar email={m.user_email} name={m.user_name} size="xs" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <p className="font-bold text-xs text-primary">{m.user_name || 'Team'}</p>
                              <p className="text-[10px] text-on-surface-variant">{relativeTime(m.created_at)}</p>
                              {pinned && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-feather/70">Pinned</span>
                              )}
                            </div>
                            {editing ? (
                              <div className="mt-1 space-y-1.5">
                                <textarea
                                  value={editMessageBody}
                                  onChange={(e) => setEditMessageBody(e.target.value)}
                                  rows={3}
                                  className="w-full bg-white border border-outline-variant/20 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-secondary/25 outline-none resize-y"
                                />
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={cancelEditMessage}
                                    className="px-2 py-1 text-[10px] font-semibold text-on-surface-variant"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => saveEditMessage(m.id)}
                                    disabled={!editMessageBody.trim()}
                                    className="px-3 py-1 bg-feather text-white rounded text-[10px] font-semibold disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-on-surface mt-0.5 whitespace-pre-wrap">{m.body}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-0.5 shrink-0 self-start">
                            <button
                              type="button"
                              onClick={() => togglePinMessage(m)}
                              aria-label={pinned ? 'Unpin message' : 'Pin message'}
                              title={pinned ? 'Unpin' : 'Pin'}
                              className={`p-0.5 rounded ${pinned ? 'text-feather opacity-100' : 'text-on-surface-variant/40 opacity-0 group-hover:opacity-100 hover:text-feather'}`}
                            >
                              <Icon name="push_pin" className="!text-[15px]" filled={pinned} />
                            </button>
                            {!editing && (
                              <button
                                type="button"
                                onClick={() => startEditMessage(m)}
                                aria-label="Edit message"
                                title="Edit"
                                className="p-0.5 text-on-surface-variant/40 hover:text-secondary opacity-0 group-hover:opacity-100"
                              >
                                <Icon name="edit" className="!text-[15px]" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteMessage(m.id)}
                              aria-label="Delete message"
                              className="p-0.5 text-on-surface-variant/30 hover:text-error opacity-0 group-hover:opacity-100"
                            >
                              <Icon name="close" className="!text-[16px]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </section>

          <section className={`lg:col-span-4 bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden flex flex-col ${HUB_SIDE_PANEL_HEIGHT}`}>
            <div className="bg-secondary px-4 py-2.5 flex items-center gap-2 shrink-0">
              <Icon name="link" className="text-lemon !text-[18px]" />
              <h3 className="text-sm font-bold text-white">Quick Links</h3>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar p-3">
              {links.length === 0 && (
                <p className="text-xs text-on-surface-variant py-2 text-center">No links yet.</p>
              )}
              {linkOrderError && (
                <p className="text-[11px] text-error mb-2">{linkOrderError}</p>
              )}
              <div className="space-y-1.5 min-w-0">
                {links.map((l, index) => (
                  <div key={l.id} className="min-w-0">
                    {dragLinkId != null && dragInsertIndex === index && (
                      <div className="h-0.5 mb-1 rounded bg-secondary" aria-hidden />
                    )}
                    <div
                      onDragOver={(e) => handleLinkDragOver(e, l.id)}
                      onDrop={(e) => e.preventDefault()}
                      className={`group flex items-start gap-0.5 min-w-0 ${dragLinkId === l.id ? 'opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => handleLinkDragStart(e, l.id)}
                        onDragEnd={handleLinkDragEnd}
                        aria-label={`Reorder ${l.label}`}
                        title="Drag to reorder"
                        className="p-1.5 mt-0.5 text-on-surface-variant/40 hover:text-on-surface-variant cursor-grab active:cursor-grabbing shrink-0"
                      >
                        <Icon name="drag_indicator" className="!text-[16px]" />
                      </button>
                      {editingLinkId === l.id ? (
                        <form onSubmit={saveEditLink} className="flex-1 p-2 rounded-lg bg-surface-container-low/50 space-y-1.5">
                          <input
                            value={editLinkForm.label}
                            onChange={(e) => setEditLinkForm({ ...editLinkForm, label: e.target.value })}
                            placeholder="Label"
                            className="w-full px-2.5 py-1.5 bg-white border border-outline-variant/20 rounded text-xs"
                          />
                          <input
                            value={editLinkForm.url}
                            onChange={(e) => setEditLinkForm({ ...editLinkForm, url: e.target.value })}
                            placeholder="https://…"
                            className="w-full px-2.5 py-1.5 bg-white border border-outline-variant/20 rounded text-xs"
                          />
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={cancelEditLink} className="px-2 py-1 text-[10px] font-semibold text-on-surface-variant">
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={!editLinkForm.label.trim() || !editLinkForm.url.trim()}
                              className="px-3 py-1 bg-feather text-white rounded text-[10px] font-semibold disabled:opacity-50"
                            >
                              Save
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 min-w-0 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-container-low/60 text-xs font-semibold text-primary hover:bg-secondary/10 hover:text-secondary transition-colors"
                          >
                            <span className="truncate">{l.label}</span>
                            <Icon name="open_in_new" className="!text-[14px] shrink-0 opacity-50" />
                          </a>
                          <button
                            type="button"
                            onClick={() => startEditLink(l)}
                            aria-label={`Edit ${l.label}`}
                            title="Edit"
                            className="p-1.5 mt-0.5 text-on-surface-variant/30 hover:text-secondary opacity-0 group-hover:opacity-100"
                          >
                            <Icon name="edit" className="!text-[14px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLink(l.id)}
                            className="p-1.5 mt-0.5 text-on-surface-variant/30 hover:text-error opacity-0 group-hover:opacity-100"
                          >
                            <Icon name="close" className="!text-[14px]" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 px-3 pb-3 pt-1 border-t border-primary/5">
              {showAddLink ? (
                <form onSubmit={addLink} className="p-2.5 rounded-lg bg-surface-container-low/50 space-y-2">
                  <input
                    value={linkForm.label}
                    onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })}
                    placeholder="Label"
                    className="w-full px-2.5 py-1.5 bg-white border border-outline-variant/20 rounded text-xs"
                  />
                  <input
                    value={linkForm.url}
                    onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                    placeholder="https://…"
                    className="w-full px-2.5 py-1.5 bg-white border border-outline-variant/20 rounded text-xs"
                  />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowAddLink(false)} className="px-2 py-1 text-[10px] font-semibold text-on-surface-variant">
                      Cancel
                    </button>
                    <button type="submit" className="px-3 py-1 bg-feather text-white rounded text-[10px] font-semibold">
                      Add
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddLink(true)}
                  className="w-full py-2 rounded-lg border border-dashed border-secondary/40 text-xs font-semibold text-secondary hover:bg-secondary/5"
                >
                  + Add link
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
