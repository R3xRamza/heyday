import { VISIBLE_SCOPE_OPTIONS, scopeBadgeLabel } from '../utils/agentScope';
import { useAgentScope } from '../context/AgentScopeContext';

export default function AgentScopeToggle({ className = '' }) {
  const { scope, setScope } = useAgentScope();

  return (
    <div
      className={`inline-flex rounded-full border border-outline-variant/30 bg-surface-container-lowest p-0.5 ${className}`}
      role="group"
      aria-label="Agent portfolio scope"
    >
      {VISIBLE_SCOPE_OPTIONS.map((opt) => {
        const active = scope === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-label={opt.label}
            aria-pressed={active}
            onClick={() => setScope(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              active
                ? 'bg-feather text-lemon shadow-sm'
                : 'text-on-surface-variant hover:text-feather hover:bg-surface-container'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function AgentScopeBadge() {
  const { scope } = useAgentScope();
  const label = scopeBadgeLabel(scope);
  if (!label) return null;
  return (
    <span
      className="inline-flex items-center justify-center h-6 px-2 rounded-md bg-feather text-lemon text-[10px] font-semibold tracking-wide"
      title={`Portfolio: ${label}`}
    >
      {label}
    </span>
  );
}
