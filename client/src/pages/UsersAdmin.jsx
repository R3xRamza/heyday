import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { value: 'operations', label: 'Operations' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'owner_lead', label: 'Owner lead' },
  { value: 'agent', label: 'Agent' },
];

const inputClass = 'w-full min-h-11 px-3 py-2 bg-white border border-outline-variant/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/25';

function canManage(user) {
  return user?.role === 'admin' || user?.role === 'owner_lead';
}

export default function UsersAdmin() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'operations' });
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [teamRes, templateRes] = await Promise.all([
      fetch('/api/team', { credentials: 'include' }),
      fetch('/api/revenue/templates', { credentials: 'include' }),
    ]);
    if (teamRes.ok) {
      const json = await teamRes.json();
      setMembers(json.members || []);
    }
    if (templateRes.ok) {
      const json = await templateRes.json();
      setTemplates(json.templates || []);
    }
  }, []);

  useEffect(() => {
    if (canManage(user)) load();
  }, [user, load]);

  if (user && !canManage(user)) return <Navigate to="/team-ops" replace />;

  function templateFor(member) {
    return templates.find((template) => Number(template.user_id) === Number(member.id)) || null;
  }

  async function addUser(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const res = await fetch('/api/team/members', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Could not add user');
      return;
    }
    setForm({ name: '', email: '', password: '', role: 'operations' });
    setMessage(`${json.member?.name || 'User'} can log in with that email and password.`);
    await load();
  }

  async function saveRole(member, role) {
    setError('');
    const res = await fetch(`/api/team/members/${member.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Could not update role');
      return;
    }
    await load();
  }

  async function saveAnniversary(member, value) {
    setError('');
    const anniversaryMd = value ? value.slice(5) : null;
    let template = templateFor(member);
    if (!template) {
      const createdRes = await fetch('/api/revenue/templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: member.id }),
      });
      const created = await createdRes.json().catch(() => ({}));
      if (!createdRes.ok) {
        setError(created.error || 'Could not add a split template');
        return;
      }
      template = created;
    }
    const res = await fetch(`/api/revenue/templates/${template.agent_key}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: { ...(template.settings || {}), anniversaryMd },
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Could not save anniversary');
      return;
    }
    await load();
  }

  async function reassign(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const res = await fetch('/api/team/reassign', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_user_id: Number(fromId), to_user_id: Number(toId) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Could not move tasks');
      return;
    }
    setMessage(`Moved ${json.moved || 0} task${json.moved === 1 ? '' : 's'}.`);
  }

  return (
    <DashboardLayout title="Users" subtitle="Logins, roles, and anniversary dates">
      <div className="w-full space-y-6 px-4 md:px-6 lg:px-8 py-4">
        <p className="text-sm text-on-surface-variant max-w-3xl">
          Checklist tasks follow the role. Operations checklist tasks go to the person whose role is Operations.
          When someone new takes that work, set their role to Operations, change the person who is leaving, then move the existing tasks.
        </p>
        {error && <p className="text-sm text-error">{error}</p>}
        {message && <p className="text-sm text-secondary font-semibold">{message}</p>}

        <form onSubmit={addUser} className="grid grid-cols-1 md:grid-cols-5 gap-2 bg-white border border-outline-variant/20 rounded-xl p-3">
          <input className={inputClass} required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputClass} required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={inputClass} required type="password" minLength={8} placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
          <button type="submit" className="min-h-11 px-3 bg-primary-container text-white text-xs font-semibold uppercase tracking-wider">Add user</button>
        </form>

        <div className="bg-white border border-outline-variant/20 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/15">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">eXp anniversary</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const template = templateFor(member);
                const md = template?.settings?.anniversaryMd || '';
                return (
                  <tr key={member.id} className="border-b border-outline-variant/10">
                    <td className="px-3 py-2 font-semibold">{member.name}</td>
                    <td className="px-3 py-2">{member.email}</td>
                    <td className="px-3 py-2">
                      <select
                        className={inputClass}
                        value={ROLES.some((role) => role.value === member.role) ? member.role : 'agent'}
                        onChange={(e) => saveRole(member, e.target.value)}
                      >
                        {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputClass}
                        type="date"
                        value={md ? `2000-${md}` : ''}
                        onChange={(e) => saveAnniversary(member, e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <form onSubmit={reassign} className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-white border border-outline-variant/20 rounded-xl p-3">
          <select className={inputClass} required value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">Move tasks from</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <select className={inputClass} required value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">To</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <button type="submit" className="min-h-11 px-3 bg-primary text-white text-xs font-semibold uppercase tracking-wider">Move all tasks</button>
        </form>
      </div>
    </DashboardLayout>
  );
}
