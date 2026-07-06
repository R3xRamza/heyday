import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';
import ListPagination from '../components/shared/ListPagination';
import DateText from '../components/shared/DateText';

const ACTIVITY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'note', label: 'Notes' },
  { key: 'email', label: 'Emails' },
  { key: 'call', label: 'Calls' },
  { key: 'text', label: 'Texts' },
];

function Field({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className="text-sm text-primary break-words">{value}</p>
    </div>
  );
}

function extractRelationships(raw) {
  if (!raw) return [];
  const rels = [];
  for (let i = 1; i <= 4; i++) {
    const first = raw[`Relationship ${i} First Name`];
    const last = raw[`Relationship ${i} Last Name`];
    const type = raw[`Relationship ${i} Type`];
    if (first || last) {
      rels.push({
        name: [first, last].filter(Boolean).join(' '),
        type,
        phone: raw[`Relationship ${i} Phone 1`],
        email: raw[`Relationship ${i} Email 1`],
      });
    }
  }
  return rels;
}

function parseMetadata(meta) {
  if (!meta) return {};
  try {
    return typeof meta === 'string' ? JSON.parse(meta) : meta;
  } catch {
    return {};
  }
}

function ActivityCard({ activity }) {
  const meta = parseMetadata(activity.metadata);
  const isEmail = activity.event_type === 'email';

  return (
    <div className="p-4 border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/50">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Icon
            name={isEmail ? 'mail' : activity.event_type === 'note' ? 'sticky_note_2' : 'chat'}
            className="!text-[18px] text-on-surface-variant"
          />
          <span className="text-xs font-semibold uppercase text-on-surface-variant">
            {activity.event_type}
            {activity.mailbox && activity.mailbox !== 'heyday' && activity.mailbox !== 'import' && (
              <span className="ml-1 normal-case text-secondary"> · {activity.mailbox}</span>
            )}
          </span>
        </div>
        <DateText
          value={activity.occurred_at?.slice(0, 10)}
          className="text-[11px] text-on-surface-variant shrink-0"
        />
      </div>
      {isEmail && (
        <>
          <p className="font-semibold text-sm text-primary">{activity.subject || activity.summary}</p>
          {meta.from && <p className="text-xs text-on-surface-variant mt-1">From: {meta.from}</p>}
          {meta.to && <p className="text-xs text-on-surface-variant">To: {meta.to}</p>}
        </>
      )}
      {!isEmail && activity.summary && (
        <p className="font-semibold text-sm text-primary">{activity.summary}</p>
      )}
      {activity.body && (
        <p className="text-sm text-on-surface-variant mt-2 whitespace-pre-wrap line-clamp-6">{activity.body}</p>
      )}
      {activity.direction && activity.direction !== 'unknown' && (
        <span className="inline-block mt-2 text-[10px] uppercase font-semibold text-on-surface-variant/70">
          {activity.direction}
        </span>
      )}
    </div>
  );
}

function SidebarSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-outline-variant/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-semibold text-primary"
      >
        {title}
        <Icon name="expand_more" className={`!text-[18px] transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-4 pb-4 text-xs text-on-surface-variant">{children}</div>}
    </div>
  );
}

export default function ContactDetail() {
  const { id } = useParams();
  const [contact, setContact] = useState(null);
  const [activities, setActivities] = useState([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [lastCommunication, setLastCommunication] = useState(null);
  const [activityTab, setActivityTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchContact = useCallback(async () => {
    const res = await fetch(`/api/crm/${id}`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setContact(json.contact);
    }
    setLoading(false);
  }, [id]);

  const fetchActivities = useCallback(async (page = 1) => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (activityTab !== 'all') params.set('type', activityTab);

    const res = await fetch(`/api/crm/${id}/activity?${params}`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setActivities(json.activities);
      setActivityTotal(json.total);
      setActivityPage(json.page);
      setLastCommunication(json.lastCommunication);
    }
  }, [id, activityTab]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  useEffect(() => {
    setActivityPage(1);
    fetchActivities(1);
  }, [fetchActivities]);

  async function submitNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/crm/${id}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ body: noteText.trim(), event_type: 'note' }),
    });
    if (res.ok) {
      setNoteText('');
      fetchActivities(1);
    }
    setPosting(false);
  }

  if (loading) {
    return (
      <DashboardLayout title="Contact" className="p-0">
        <p className="p-8 text-on-surface-variant">Loading…</p>
      </DashboardLayout>
    );
  }

  if (!contact) {
    return (
      <DashboardLayout title="Contact" className="p-8">
        <p className="text-on-surface-variant">Contact not found.</p>
        <Link to="/crm" className="text-secondary text-sm mt-2 inline-block hover:underline">← Back to CRM</Link>
      </DashboardLayout>
    );
  }

  const relationships = extractRelationships(contact.raw);
  const location = [contact.street, contact.city, contact.state, contact.zip].filter(Boolean).join(', ');
  const property = [contact.property_address, contact.property_city, contact.property_state, contact.property_zip]
    .filter(Boolean).join(', ');
  const mailto = contact.email || contact.email_2;
  const tel = contact.phone || contact.phone_2;

  return (
    <DashboardLayout title={contact.name} fillViewport className="p-0 overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* Left — profile */}
        <aside className="w-72 shrink-0 border-r border-outline-variant/10 bg-surface-container-lowest overflow-y-auto custom-scrollbar p-5 space-y-4">
          <Link to="/crm" className="text-xs font-bold text-secondary hover:underline flex items-center gap-1">
            <Icon name="arrow_back" className="!text-[14px]" /> CRM
          </Link>

          <div>
            <h1 className="text-xl font-bold text-primary">{contact.name}</h1>
            {contact.stage && (
              <span className="inline-block mt-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-secondary-container/20 text-secondary">
                {contact.stage}
              </span>
            )}
          </div>

          <p className="text-xs text-on-surface-variant">
            Last communication:{' '}
            {lastCommunication ? (
              <DateText value={lastCommunication.slice(0, 10)} />
            ) : contact.last_contacted ? (
              <DateText value={contact.last_contacted} />
            ) : (
              '—'
            )}
          </p>

          <Field label="Phone" value={contact.phone} />
          <Field label="Phone 2" value={contact.phone_2} />
          <Field label="Email" value={contact.email} />
          <Field label="Email 2" value={contact.email_2} />
          <Field label="Address" value={location} />
          <Field label="Property" value={property} />
          <Field label="Company" value={contact.company} />
          <Field label="Lead source" value={contact.lead_source} />
          <Field label="Assigned to" value={contact.assigned_to_name || contact.assigned_user_name} />
          <Field label="Tags" value={contact.tags} />
          <Field label="Birthday" value={contact.birthday} />
          <Field label="Anniversary" value={contact.anniversary} />
          <Field label="Sphere source" value={contact.sphere_source} />
          <Field label="Referred by" value={contact.referred_by} />

          {relationships.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-2">Relationships</p>
              <ul className="space-y-2">
                {relationships.map((r, i) => (
                  <li key={i} className="text-sm">
                    <p className="font-semibold text-primary">{r.name}</p>
                    {r.type && <p className="text-xs text-on-surface-variant">{r.type}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Center — communication */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <div className="p-4 border-b border-outline-variant/10 flex flex-wrap gap-2">
            <button type="button" className="px-3 py-1.5 text-xs font-semibold bg-primary-container text-white rounded-lg">
              Create Note
            </button>
            {mailto && (
              <a href={`mailto:${mailto}`} className="px-3 py-1.5 text-xs font-semibold bg-surface-container-high text-primary rounded-lg">
                Send Email
              </a>
            )}
            {tel && (
              <a href={`tel:${tel}`} className="px-3 py-1.5 text-xs font-semibold bg-surface-container-high text-primary rounded-lg">
                Log Call
              </a>
            )}
            <span className="px-3 py-1.5 text-xs font-semibold text-on-surface-variant/50 rounded-lg cursor-not-allowed" title="Coming soon">
              Text
            </span>
          </div>

          <form onSubmit={submitNote} className="p-4 border-b border-outline-variant/10 bg-surface-container-low/30">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note…"
              rows={3}
              className="w-full border border-outline-variant/30 rounded-lg p-3 text-sm focus:ring-2 focus:ring-secondary/30 outline-none"
            />
            <button
              type="submit"
              disabled={posting || !noteText.trim()}
              className="mt-2 px-4 py-2 bg-lemon text-feather font-bold rounded-lg text-sm disabled:opacity-50"
            >
              {posting ? 'Saving…' : 'Save note'}
            </button>
          </form>

          <div className="flex gap-1 px-4 pt-3 border-b border-outline-variant/10 overflow-x-auto">
            {ACTIVITY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActivityTab(tab.key)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px ${
                  activityTab === tab.key
                    ? 'border-secondary text-secondary'
                    : 'border-transparent text-on-surface-variant hover:text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activities.length === 0 ? (
              <p className="p-8 text-center text-on-surface-variant text-sm">No activity yet. Connect Gmail or add a note.</p>
            ) : (
              activities.map((a) => <ActivityCard key={a.id} activity={a} />)
            )}
          </div>
          <ListPagination
            page={activityPage}
            total={activityTotal}
            onPageChange={(p) => {
              setActivityPage(p);
              fetchActivities(p);
            }}
          />
        </div>

        {/* Right — sidebar */}
        <aside className="w-56 shrink-0 border-l border-outline-variant/10 bg-surface-container-lowest overflow-y-auto">
          <div className="p-4 border-b border-outline-variant/10">
            <p className="text-xs font-semibold text-primary">Quick actions</p>
            <div className="flex flex-col gap-2 mt-3">
              {tel && (
                <a href={`tel:${tel}`} className="flex items-center gap-2 text-sm text-secondary hover:underline">
                  <Icon name="call" className="!text-[16px]" /> Call
                </a>
              )}
              {mailto && (
                <a href={`mailto:${mailto}`} className="flex items-center gap-2 text-sm text-secondary hover:underline">
                  <Icon name="mail" className="!text-[16px]" /> Email
                </a>
              )}
            </div>
          </div>
          <SidebarSection title="Tasks">Coming soon</SidebarSection>
          <SidebarSection title="Appointments">Coming soon</SidebarSection>
          <SidebarSection title="Files">Coming soon</SidebarSection>
          <SidebarSection title="Deals">Coming soon</SidebarSection>
          <SidebarSection title="Collaborators">Coming soon</SidebarSection>
        </aside>
      </div>
    </DashboardLayout>
  );
}
