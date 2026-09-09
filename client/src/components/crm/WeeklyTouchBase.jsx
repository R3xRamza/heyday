import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../shared/Icon';
import { formatPhone } from '../../utils/format';

const cardClass =
  'shrink-0 min-w-[7.5rem] md:min-w-[8.5rem] flex-1 basis-[7.5rem] rounded-xl border px-3 md:px-4 py-3 md:py-3.5 text-left transition-all';

function monthYear(dateStr) {
  if (!dateStr) return null;
  const normalized = String(dateStr).includes('T')
    ? dateStr
    : String(dateStr).includes(' ')
      ? String(dateStr).replace(' ', 'T')
      : `${dateStr}T12:00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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
      : 'Closed';

  return (
    <div
      className={`${cardClass} ${
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
        <p className="text-[10px] text-on-surface-variant truncate mt-1">
          {contactLine(pick)}
        </p>
      </button>
      {reached ? null : (
        <button
          type="button"
          disabled={busy}
          onClick={onReplace}
          className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant hover:text-secondary mt-1.5 disabled:opacity-50"
        >
          Replace
        </button>
      )}
    </div>
  );
}

export default function WeeklyTouchBase() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

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
    } catch (e) {
      setError(e.message || 'Request failed');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return [0, 1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className={`${cardClass} border-outline-variant/15 bg-white animate-pulse min-h-[5.5rem]`}
      />
    ));
  }

  if (!data?.picks?.length) {
    return (
      <div className={`${cardClass} border-outline-variant/15 bg-white flex items-center`}>
        <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">
          {error || 'No Closed clients to draw'}
        </p>
      </div>
    );
  }

  return (
    <>
      {data.picks.map((pick) => (
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
      ))}
    </>
  );
}
