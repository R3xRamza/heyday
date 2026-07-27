import { VISIBLE_SCOPE_OPTIONS, scopeBadgeLabel, scopeInitials } from '../utils/agentScope';
import { useAgentScope } from '../context/AgentScopeContext';
import { useSidebar } from '../context/SidebarContext';

export default function AgentScopeToggle({ className = '' }) {
  const { scope, setScope } = useAgentScope();
  const { isMobileNav } = useSidebar();

  return (
    <div
      className={`inline-flex rounded-full border border-outline-variant/30 bg-surface-container-lowest p-0.5 shrink-0 ${className}`}
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
            className={`rounded-full font-semibold transition-colors ${
              isMobileNav
                ? 'min-w-[2rem] px-1.5 py-1 text-[10px] tracking-wide'
                : 'px-3 py-1 text-xs'
            } ${
              active
                ? 'bg-feather text-lemon shadow-sm'
                : 'text-on-surface-variant hover:text-feather hover:bg-surface-container'
            }`}
          >
            {isMobileNav ? opt.initials : opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function AgentScopeBadge() {
  const { scope } = useAgentScope();
  const { isMobileNav } = useSidebar();
  const label = scopeBadgeLabel(scope);
  if (!label) return null;
  return (
    <span
      className="inline-flex items-center justify-center h-6 px-2 rounded-md bg-feather text-lemon text-[10px] font-semibold tracking-wide shrink-0"
      title={`Portfolio: ${label}`}
    >
      {isMobileNav ? scopeInitials(scope) : label}
    </span>
  );
}
