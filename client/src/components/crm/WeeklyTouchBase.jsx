import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dices } from 'lucide-react';
import Icon from '../shared/Icon';
import { formatPhone } from '../../utils/format';

const cardClass =
  'shrink-0 min-w-[7.5rem] md:min-w-[8.5rem] flex-1 basis-[7.5rem] rounded-xl border px-3 md:px-4 py-3 md:py-3.5 text-left transition-all';

function parseDate(dateStr) {
  if (!dateStr) return null;
  const normalized = String(dateStr).includes('T')
    ? dateStr
    : String(dateStr).includes(' ')
      ? String(dateStr).replace(' ', 'T')
      : `${dateStr}T12:00:00`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthYear(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function reachedDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function contactLine(pick) {
  if (pick.phone) return formatPhone(pick.phone);
  if (pick.email) return pick.email;
  return '—';
}

function PickCard({ pick, busy, onOpen, onReplace, onToggleReached }) {
  const since = monthYear(pick.dateAdded);
  const reachedOn = monthYear(pick.reachedAt);
  const reached = Boolean(pick.reachedAt);
  const topLabel = reached && reachedOn
    ? `Reached out ${reachedOn}`
    : since
      ? `Since ${since}`
      : (pick.stage || 'Client');

  return (
    <div
      className={`${cardClass} relative ${
        reached
          ? 'border-secondary bg-secondary/5 ring-2 ring-secondary/25'
          : 'border-outline-variant/15 bg-white hover:border-secondary/40'
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest truncate">
          {topLabel}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={onToggleReached}
          className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center disabled:opacity-50 ${
            reached
              ? 'bg-secondary border-secondary text-white'
              : 'border-outline-variant/40 text-transparent hover:border-secondary hover:text-secondary/50'
          }`}
          title={reached ? 'Undo reached' : 'Mark reached'}
          aria-pressed={reached}
          aria-label={reached ? `Unmark ${pick.name} as reached` : `Mark ${pick.name} as reached`}
        >
          <Icon name="check" className="!text-[14px]" filled={reached} />
        </button>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left min-w-0"
      >
        <p className="text-lg md:text-xl font-bold text-primary-container truncate leading-tight">
          {pick.name}
        </p>
        <p className="text-[10px] text-on-surface-variant truncate mt-1 pr-5">
          {contactLine(pick)}
        </p>
      </button>
      <div className="h-4" aria-hidden="true" />
      <button
        type="button"
        disabled={busy}
        onClick={onReplace}
        className="absolute bottom-1.5 right-2 p-0.5 rounded text-on-surface-variant hover:text-secondary disabled:opacity-50"
        title="Draw a new client"
        aria-label={`Draw a new client instead of ${pick.name}`}
      >
        <Dices size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

function ContactedList({ rows, onOpen }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-on-surface-variant px-1 py-2">
        No one has been marked reached yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant/15 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-outline-variant/15 text-[10px] uppercase tracking-widest text-on-surface-variant">
            <th className="px-3 py-2 font-semibold">Name</th>
            <th className="px-3 py-2 font-semibold">Stage</th>
            <th className="px-3 py-2 font-semibold">Phone</th>
            <th className="px-3 py-2 font-semibold">Reached</th>
            <th className="px-3 py-2 font-semibold">By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.contactId} className="border-b border-outline-variant/10 last:border-0">
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onOpen(row.contactId)}
                  className="font-semibold text-primary-container hover:underline text-left"
                >
                  {row.name}
                </button>
              </td>
              <td className="px-3 py-2 text-on-surface-variant">{row.stage || '—'}</td>
              <td className="px-3 py-2 text-on-surface-variant">{contactLine(row)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{reachedDate(row.reachedAt)}</td>
              <td className="px-3 py-2 text-on-surface-variant">{row.reachedByName || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WeeklyTouchBase({ leading = null }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [showContacted, setShowContacted] = useState(false);
  const [contacted, setContacted] = useState(null);
  const [contactedError, setContactedError] = useState('');

  const applyList = useCallback((json) => {
    setData(json);
    setError('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/crm/weekly-touch', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load weekly list');
        if (!cancelled) applyList(json);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load weekly list');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyList]);

  const loadContacted = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/weekly-touch/contacted', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load contacted clients');
      setContacted(json.contacts || []);
      setContactedError('');
    } catch (e) {
      setContactedError(e.message || 'Could not load contacted clients');
    }
  }, []);

  useEffect(() => {
    if (showContacted && contacted == null) loadContacted();
  }, [showContacted, contacted, loadContacted]);

  async function postAction(path, body, contactId) {
    setBusyId(contactId);
    setError('');
    try {
      const res = await fetch(`/api/crm/weekly-touch/${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      applyList(json);
      if (showContacted) loadContacted();
    } catch (e) {
      setError(e.message || 'Request failed');
    } finally {
      setBusyId(null);
    }
  }

  const cooldownMonths = data?.cooldownMonths || 6;
  const cards = loading
    ? [0, 1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className={`${cardClass} border-outline-variant/15 bg-white animate-pulse min-h-[5.5rem]`}
      />
    ))
    : !data?.picks?.length
      ? (
        <div className={`${cardClass} border-outline-variant/15 bg-white flex items-center`}>
          <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">
            {error || 'No clients to draw'}
          </p>
        </div>
      )
      : data.picks.map((pick) => (
        <PickCard
          key={`${pick.slot}-${pick.contactId}`}
          pick={pick}
          busy={busyId === pick.contactId}
          onOpen={() => navigate(`/crm/${pick.contactId}`)}
          onReplace={() => postAction('skip', { contactId: pick.contactId }, pick.contactId)}
          onToggleReached={() =>
            postAction(
              'reach',
              { contactId: pick.contactId, reached: !pick.reachedAt },
              pick.contactId,
            )
          }
        />
      ));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-on-surface-variant">
          New five every Sunday at 6:00 PM Chicago. A checkmark keeps them off the list for {cooldownMonths} months.
        </p>
        <button
          type="button"
          onClick={() => setShowContacted((open) => !open)}
          className="text-[11px] font-bold uppercase tracking-widest text-secondary hover:underline"
        >
          {showContacted ? 'Hide contacted' : 'Contacted'}
        </button>
      </div>
      <div className="flex gap-2.5 md:gap-3 overflow-x-auto pb-1 hide-scrollbar md:custom-scrollbar">
        {leading}
        {cards}
      </div>
      {error && data?.picks?.length ? (
        <p className="text-xs text-error font-semibold" role="alert">{error}</p>
      ) : null}
      {showContacted && (
        contactedError
          ? <p className="text-xs text-error font-semibold" role="alert">{contactedError}</p>
          : contacted == null
            ? <p className="text-sm text-on-surface-variant">Loading contacted clients…</p>
            : <ContactedList rows={contacted} onOpen={(id) => navigate(`/crm/${id}`)} />
      )}
    </div>
  );
}
