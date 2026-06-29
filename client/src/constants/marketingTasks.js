export const ADAM_EMAIL = 'adam@theheydaygroup.com';

export function findAdamMember(members) {
  return (members || []).find(
    (m) => m.email === ADAM_EMAIL || /^Adam/i.test(m.name || ''),
  );
}
