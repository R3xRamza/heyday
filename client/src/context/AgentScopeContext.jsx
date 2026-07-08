import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  AGENT_SCOPE_STORAGE_KEY,
  normalizeScope,
  scopeQueryParam,
  scopeBadgeLabel,
} from '../utils/agentScope';

const AgentScopeContext = createContext(null);

const EMAIL_BY_SCOPE = {
  meredith: 'meredith@theheydaygroup.com',
  tessa: 'tessa@theheydaygroup.com',
};

export function AgentScopeProvider({ children }) {
  const [scope, setScopeState] = useState(() => {
    try {
      return normalizeScope(localStorage.getItem(AGENT_SCOPE_STORAGE_KEY) || 'meredith');
    } catch {
      return 'meredith';
    }
  });
  const [agentIds, setAgentIds] = useState({ meredith: null, tessa: null });

  useEffect(() => {
    try {
      localStorage.setItem(AGENT_SCOPE_STORAGE_KEY, scope);
    } catch {
      // ignore
    }
  }, [scope]);

  useEffect(() => {
    fetch('/api/team', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        const members = json.members || [];
        const byEmail = Object.fromEntries(members.map((m) => [m.email, m.id]));
        setAgentIds({
          meredith: byEmail[EMAIL_BY_SCOPE.meredith] ?? null,
          tessa: byEmail[EMAIL_BY_SCOPE.tessa] ?? null,
        });
      })
      .catch(() => {});
  }, []);

  const setScope = useCallback((next) => {
    setScopeState(normalizeScope(next));
  }, []);

  const scopeAgentId = scope === 'all' ? null : agentIds[scope] ?? null;
  const scopeLabel = scopeBadgeLabel(scope) ?? 'Meredith';
  const scopeCode = scopeQueryParam(scope);

  const value = useMemo(
    () => ({ scope, setScope, scopeAgentId, scopeLabel, scopeCode }),
    [scope, setScope, scopeAgentId, scopeLabel, scopeCode],
  );

  return (
    <AgentScopeContext.Provider value={value}>
      {children}
    </AgentScopeContext.Provider>
  );
}

export function useAgentScope() {
  const ctx = useContext(AgentScopeContext);
  if (!ctx) throw new Error('useAgentScope must be used within AgentScopeProvider');
  return ctx;
}
