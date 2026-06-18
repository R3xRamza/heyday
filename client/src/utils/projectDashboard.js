export function formatLastSaved(updatedAt) {
  if (!updatedAt) return '—';
  const d = new Date(updatedAt.includes('T') ? updatedAt : `${updatedAt.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function firstName(fullName) {
  return fullName?.split(' ')[0] || 'User';
}
