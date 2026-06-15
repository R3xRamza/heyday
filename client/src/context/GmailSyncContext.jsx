import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

const GmailSyncContext = createContext(null);

export function GmailSyncProvider({ children }) {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [gmailStatus, setGmailStatus] = useState(null);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/gmail/status', { credentials: 'include' });
      if (res.ok) setGmailStatus(await res.json());
    } catch {
      /* ignore */
    }
  }, [user]);

  const triggerSync = useCallback(async () => {
    if (!user || syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/gmail/sync', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sync failed');
      setLastSync(new Date());
      await fetchStatus();
    } catch (e) {
      setSyncError(e.message);
    } finally {
      setSyncing(false);
    }
  }, [user, syncing, fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!user) return;
    triggerSync();
    const interval = setInterval(triggerSync, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GmailSyncContext.Provider value={{
      syncing,
      lastSync,
      syncError,
      gmailStatus,
      fetchStatus,
      triggerSync,
    }}
    >
      {children}
    </GmailSyncContext.Provider>
  );
}

export function useGmailSync() {
  const ctx = useContext(GmailSyncContext);
  if (!ctx) throw new Error('useGmailSync must be used within GmailSyncProvider');
  return ctx;
}
