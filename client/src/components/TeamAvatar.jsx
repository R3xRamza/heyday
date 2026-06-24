import { getTeamProfile } from '../data/teamProfiles';

const SIZE_CLASS = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
};

function getInitials(name) {
  return name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

export default function TeamAvatar({
  email,
  name,
  size = 'sm',
  className = '',
  borderClassName = '',
  title,
}) {
  const profile = email ? getTeamProfile(email) : null;
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.sm;
  const baseClass = `${sizeClass} rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-feather-alt text-white font-bold ${borderClassName} ${className}`;

  if (profile?.img) {
    return (
      <div className={baseClass} title={title}>
        <img
          src={profile.img}
          alt={name || 'Team member'}
          className="w-full h-full object-cover object-center"
        />
      </div>
    );
  }

  return (
    <div className={baseClass} title={title}>
      {getInitials(name)}
    </div>
  );
}
