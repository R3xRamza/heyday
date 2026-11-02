import { memberInitials } from '../../utils/agentScope';

export default function OpportunityAgentSelect({ value, members, onChange, ariaLabel = 'Agent' }) {
  const selected = members.find((member) => Number(member.id) === Number(value));
  return (
    <select
      className="w-full min-w-0 bg-transparent text-xs font-semibold text-on-surface cursor-pointer focus:outline-none"
      value={value || ''}
      aria-label={selected?.name ? `${ariaLabel}: ${selected.name}` : ariaLabel}
      title={selected?.name || ariaLabel}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {members.map((member) => (
        <option key={member.id} value={member.id} title={member.name}>
          {memberInitials(member)}
        </option>
      ))}
    </select>
  );
}
