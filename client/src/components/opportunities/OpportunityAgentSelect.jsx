export default function OpportunityAgentSelect({ value, members, onChange, ariaLabel = 'Agent' }) {
  return (
    <select
      className="w-full min-w-0 bg-transparent text-xs font-semibold text-on-surface cursor-pointer focus:outline-none"
      value={value || ''}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {members.map((member) => (
        <option key={member.id} value={member.id}>{member.name}</option>
      ))}
    </select>
  );
}
