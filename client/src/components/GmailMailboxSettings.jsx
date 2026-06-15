import { useState } from 'react';
import { useGmailSync } from '../context/GmailSyncContext';
import { useAuth } from '../context/AuthContext';
import Icon from './shared/Icon';

function formatSyncTime(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return d.toLocaleString();
}

export default function GmailMailboxSettings() {
  const { user } = useAuth();
  const { gmailStatus, fetchStatus, triggerSync, syncing } = useGmailSync();
  const [connecting, setConnecting] = useState(null);

  if (!gmailStatus) return null;

  async function connectMailbox(address) {
    setConnecting(address);
    try {
      const res = await fetch(`/api/gmail/connect?mailbox=${encodeURIComponent(address)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Connect failed');
      window.location.href = json.url;
    } catch (e) {
      alert(e.message);
      setConnecting(null);
    }
  }

  async function disconnectMailbox(address) {
    if (!confirm(`Disconnect ${address}?`)) return;
    await fetch('/api/gmail/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mailbox: address }),
    });
    fetchStatus();
  }

  const configured = gmailStatus.configured;

  return (
    <div className="bg-white rounded-xl border border-outline-variant/10 p-5 shadow-executive">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-primary">Gmail mailboxes</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {configured
              ? 'Connect team inboxes to sync email into contact timelines.'
              : 'Add Google OAuth credentials — see server/README-gmail.md'}
          </p>
        </div>
        <button
          type="button"
          onClick={triggerSync}
          disabled={syncing || !configured}
          className="px-4 py-2 text-xs font-bold uppercase bg-secondary-container/30 text-secondary rounded-lg disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync all now'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {gmailStatus.mailboxes?.map((mb) => (
          <div
            key={mb.address}
            className={`p-4 rounded-lg border ${mb.connected ? 'border-secondary/30 bg-secondary-container/5' : 'border-outline-variant/20'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-primary truncate">{mb.address}</p>
              <span
                className={`shrink-0 w-2 h-2 rounded-full ${mb.connected ? 'bg-green-500' : 'bg-outline-variant'}`}
                title={mb.connected ? 'Connected' : 'Disconnected'}
              />
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Last sync: {formatSyncTime(mb.last_sync_at)}
            </p>
            {mb.last_sync_error && (
              <p className="text-[10px] text-error mt-1 line-clamp-2">{mb.last_sync_error}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {mb.canConnect && !mb.connected && configured && (
                <button
                  type="button"
                  disabled={connecting === mb.address}
                  onClick={() => connectMailbox(mb.address)}
                  className="text-xs font-semibold text-secondary hover:underline"
                >
                  {connecting === mb.address ? 'Redirecting…' : 'Connect Gmail'}
                </button>
              )}
              {mb.canDisconnect && (
                <button
                  type="button"
                  onClick={() => disconnectMailbox(mb.address)}
                  className="text-xs font-semibold text-on-surface-variant hover:underline"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {user?.role === 'admin' && (
        <p className="text-[10px] text-on-surface-variant mt-3 flex items-center gap-1">
          <Icon name="info" className="!text-[14px]" />
          Admin can connect all three mailboxes. Sign in with the matching Google account for each.
        </p>
      )}
    </div>
  );
}
