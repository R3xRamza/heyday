import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';
import TeamAvatar from '../components/TeamAvatar';
import DateText from '../components/shared/DateText';
import { getTeamProfile } from '../data/teamProfiles';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, shortAddress } from '../utils/format';
import ClosingSoonPanel from '../components/tasks/ClosingSoonPanel';

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
    path: '/transactions?filter=active_transactions',
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
    link: '/transactions?filter=active_transactions',
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

export default function TeamExecutiveOps() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [stats, setStats] = useState(null);
  const [celebrations, setCelebrations] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [links, setLinks] = useState([]);
  const [closings, setClosings] = useState([]);
  const [loadingClosings, setLoadingClosings] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkForm, setLinkForm] = useState({ label: '', url: '' });

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
    fetch('/api/team-hub/stats', { credentials: 'include' })
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoadingStats(false));
    fetch('/api/team-hub/celebrations?window=hub', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setCelebrations(json.events || []));
    fetch('/api/team-hub/team-tasks', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setTeamTasks(json.members || []));
    fetch('/api/team-hub/links', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setLinks(json.links || []));
    fetch('/api/tasks/milestones', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setClosings(json.milestones || []))
      .finally(() => setLoadingClosings(false));
  }, []);

  const fetchMessages = useCallback(() => {
    fetch('/api/team-hub/messages', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setMessages(json.messages || []));
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
      setMessages((prev) => [json.message, ...prev]);
    }
    setPosting(false);
  }

  async function deleteMessage(id) {
    const res = await fetch(`/api/team-hub/messages/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setMessages((prev) => prev.filter((m) => m.id !== id));
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
    if (res.ok) setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <DashboardLayout title="Team Hub" className="p-5 md:p-6">
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

        <ClosingSoonPanel
          milestones={closings}
          loading={loadingClosings}
          layout="horizontal"
        />

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
                <div className="flex gap-1.5">
                  <div className="flex-1 rounded-md bg-secondary/10 px-2 py-1 text-center">
                    <div className="text-lg font-black text-secondary leading-none">{m.activeCount}</div>
                    <div className="text-[8px] uppercase font-bold text-on-surface-variant">Active</div>
                  </div>
                  <div className={`flex-1 rounded-md px-2 py-1 text-center ${m.overdueCount > 0 ? 'bg-error/10' : 'bg-surface-container-low'}`}>
                    <div className={`text-lg font-black leading-none ${m.overdueCount > 0 ? 'text-error' : 'text-primary'}`}>
                      {m.overdueCount}
                    </div>
                    <div className={`text-[8px] uppercase font-bold ${m.overdueCount > 0 ? 'text-error' : 'text-on-surface-variant'}`}>Overdue</div>
                  </div>
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
          <section className="lg:col-span-8 bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden">
            <div className="bg-feather px-4 py-2.5 flex items-center gap-2">
              <Icon name="campaign" className="text-lemon !text-[18px]" />
              <h3 className="text-sm font-bold text-white">Messages</h3>
            </div>
            <form onSubmit={postMessage} className="px-3 py-2.5 bg-surface-container-low/50 border-b border-primary/5 flex gap-2">
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
            <div className="max-h-48 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
              {messages.length === 0 ? (
                <p className="py-4 text-xs text-on-surface-variant text-center">No messages yet.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="group flex gap-2 rounded-lg bg-surface-container-low/40 px-2.5 py-2 hover:bg-surface-container-low transition-colors">
                    <TeamAvatar email={m.user_email} name={m.user_name} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <p className="font-bold text-xs text-primary">{m.user_name || 'Team'}</p>
                        <p className="text-[10px] text-on-surface-variant">{relativeTime(m.created_at)}</p>
                      </div>
                      <p className="text-xs text-on-surface mt-0.5 whitespace-pre-wrap line-clamp-3">{m.body}</p>
                    </div>
                    {(m.user_id === user?.id || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => deleteMessage(m.id)}
                        className="text-on-surface-variant/30 hover:text-error opacity-0 group-hover:opacity-100 self-start"
                      >
                        <Icon name="close" className="!text-[16px]" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="lg:col-span-4 bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden">
            <div className="bg-secondary px-4 py-2.5 flex items-center gap-2">
              <Icon name="link" className="text-lemon !text-[18px]" />
              <h3 className="text-sm font-bold text-white">Quick Links</h3>
            </div>
            <div className="p-3">
              {links.length === 0 && !isAdmin && (
                <p className="text-xs text-on-surface-variant py-2 text-center">No links yet.</p>
              )}
              <div className="space-y-1.5">
                {links.map((l) => (
                  <div key={l.id} className="group flex items-center gap-0.5">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-container-low/60 text-xs font-semibold text-primary hover:bg-secondary/10 hover:text-secondary transition-colors"
                    >
                      <span className="truncate">{l.label}</span>
                      <Icon name="open_in_new" className="!text-[14px] shrink-0 opacity-50" />
                    </a>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => removeLink(l.id)}
                        className="p-1.5 text-on-surface-variant/30 hover:text-error opacity-0 group-hover:opacity-100"
                      >
                        <Icon name="close" className="!text-[14px]" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isAdmin && (
                showAddLink ? (
                  <form onSubmit={addLink} className="mt-2 p-2.5 rounded-lg bg-surface-container-low/50 space-y-2">
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
                    className="mt-2 w-full py-2 rounded-lg border border-dashed border-secondary/40 text-xs font-semibold text-secondary hover:bg-secondary/5"
                  >
                    + Add link
                  </button>
                )
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
