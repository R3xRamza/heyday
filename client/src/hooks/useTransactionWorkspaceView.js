import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const VALID_VIEWS = new Set(['details', 'checklist', 'activity']);

function normalizeView(value) {
  return VALID_VIEWS.has(value) ? value : 'details';
}

export function useTransactionWorkspaceView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = normalizeView(searchParams.get('view'));

  const setView = useCallback((key) => {
    const next = normalizeView(key);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next === 'details') params.delete('view');
      else params.set('view', next);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  return { view, setView };
}
