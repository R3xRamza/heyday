import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/** Overdue task count for the current user (sidebar / mobile nav badge). */
export default function useOverdueTaskCount() {
  const { user } = useAuth();
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setOverdueCount(0);
      return undefined;
    }
    let cancelled = false;
    fetch('/api/tasks?assigned_to=me&filter=overdue&include_completed=false', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled) setOverdueCount(json?.stats?.overdueCount ?? 0);
      })
      .catch(() => {
        if (!cancelled) setOverdueCount(0);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  return overdueCount;
}
