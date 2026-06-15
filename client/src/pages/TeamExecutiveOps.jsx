import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';

const ALERTS = [
  { icon: 'emergency', badge: 'Urgent', badgeClass: 'bg-secondary/20', label: 'Closing Deadline', title: '450 Park Ave', sub: 'Document missing: Proof of Funds', subClass: 'text-secondary', dark: true },
  { icon: 'campaign', badge: 'Action', badgeClass: 'bg-accent/20 text-primary', label: 'Campaign Launch', title: 'Luxury Loft Series', sub: 'Pending creative approval from Director' },
  { icon: 'person_alert', badge: 'Lead', badgeClass: 'bg-secondary/20 text-primary', label: 'Hot Lead Decay', title: 'Julian V.', sub: 'Last contact: 48h ago. Response required.' },
  { icon: 'monitoring', badge: 'Goal', badgeClass: 'bg-primary text-white', label: 'YTD Gap', title: '$1.4M to Target', sub: '8 working days left in Oct', accent: true },
];

const PRIORITY_ROWS = [
  { property: '98 Riverside Drive', task: 'Escrow Management', stakeholder: 'The Steiner Family', stage: 'In Contract', status: 'On Track', statusClass: 'bg-primary text-white', deadline: 'Oct 29' },
  { property: '22 West 12th St', task: 'Photography & Staging', stakeholder: 'Adam Mitchell', stage: 'Pre-Listing', status: 'Delayed', statusClass: 'bg-error text-white', deadline: 'Tomorrow' },
  { property: 'The Chelsea Penthouse', task: 'Contract Negotiation', stakeholder: 'L. Guggenheim', stage: 'Offer Out', status: 'Active', statusClass: 'bg-secondary text-primary', deadline: 'Nov 02' },
  { property: 'Quarterly Tax Filing', task: 'Corporate Operations', stakeholder: 'Financial Dept', stage: 'Internal', status: 'Not Started', statusClass: 'bg-surface-container text-on-surface-variant', deadline: 'Oct 31' },
  { property: 'Upper East Portfolio', task: 'Valuation Refresh', stakeholder: 'Asset Mgt Team', stage: 'Review', status: 'On Track', statusClass: 'bg-primary text-white', deadline: 'Nov 05' },
];

const HOT_BUYERS = [
  { initials: 'JV', name: 'Julian Vance', budget: '$8.5M', looking: 'West Village Loft', tag: 'Tour Follow-up', tagClass: 'bg-primary text-white', time: 'Today, 2:30 PM' },
  { initials: 'SA', name: 'Sarah Amari', budget: '$12.0M', looking: 'Penthouse, UES', tag: 'Contract Review', tagClass: 'bg-secondary text-primary', time: 'In 2 days' },
  { initials: 'MT', name: 'Marcus Thorne', budget: '$4.5M', looking: 'Multi-family Brklyn', tag: 'New Match Found', tagClass: 'bg-accent text-primary', time: '1h ago' },
];

const ACHIEVEMENTS = [
  { initial: 'A', icon: 'check_circle', text: <>Adam closed <strong>142 Water St</strong></>, time: '2 hours ago' },
  { initial: 'M', icon: 'rocket_launch', text: <>Margaret finalized <strong>Q4 Prospectus</strong></>, time: '5 hours ago' },
  { initial: 'T', icon: 'task', text: <>Tessa approved <strong>6 Marketing Assets</strong></>, time: 'Yesterday' },
  { initial: 'ME', icon: 'local_fire_department', text: <>Meredith hit <strong>Lead Gen Goal</strong></>, time: 'Yesterday' },
];

export default function TeamExecutiveOps() {
  return (
    <DashboardLayout title="Team Operations Command" className="p-8">
      <div className="space-y-8 custom-scrollbar">
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-3xl font-extrabold text-primary tracking-tight">Team Operations Command</h2>
              <p className="text-on-surface-variant">Critical alerts across the enterprise</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-error animate-pulse" />
              <span className="text-xs font-bold text-error uppercase tracking-widest">Live Updates</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {ALERTS.map((a) => (
              <div key={a.title} className={`p-4 rounded border command-shadow ${a.dark ? 'bg-primary text-white border-primary' : a.accent ? 'bg-accent/10 border-accent/30' : 'bg-white border-outline-variant/30'}`}>
                <div className="flex justify-between items-start mb-2">
                  <Icon name={a.icon} className={a.dark ? 'text-secondary' : 'text-primary'} />
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.badgeClass}`}>{a.badge}</span>
                </div>
                <p className={`text-xs uppercase font-bold tracking-tighter ${a.dark ? 'opacity-80' : 'text-on-surface-variant'}`}>{a.label}</p>
                <h3 className="text-lg font-bold">{a.title}</h3>
                <p className={`text-[10px] mt-1 ${a.subClass || ''}`}>{a.sub}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <section className="bg-white border border-outline-variant/20 rounded p-6 command-shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Icon name="list_alt" className="text-primary" />
                  <h3 className="text-xl font-bold">Priority Transactions & Tasks</h3>
                </div>
                <button className="text-xs font-bold text-primary hover:underline">Manage All</button>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/20">
                    {['Property / Task', 'Lead / Stakeholder', 'Stage', 'Status', 'Deadline'].map((h) => (
                      <th key={h} className={`pb-3 font-extrabold ${h === 'Deadline' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {PRIORITY_ROWS.map((row) => (
                    <tr key={row.property} className="group hover:bg-surface-container-low transition-colors">
                      <td className="py-3">
                        <div className="font-bold text-sm">{row.property}</div>
                        <div className="text-[10px] text-on-surface-variant">{row.task}</div>
                      </td>
                      <td className="py-3 text-xs">{row.stakeholder}</td>
                      <td className="py-3"><span className="text-[10px] bg-secondary/10 text-primary px-1.5 py-0.5 rounded font-bold">{row.stage}</span></td>
                      <td className="py-3"><span className={`status-pill px-2 py-0.5 text-[10px] font-bold uppercase rounded ${row.statusClass}`}>{row.status}</span></td>
                      <td className="py-3 text-right text-xs font-bold">{row.deadline}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-outline-variant/20 rounded p-6 command-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-primary flex items-center gap-2">
                    <Icon name="ads_click" className="text-sm" /> Marketing Pulse
                  </h3>
                  <span className="text-[10px] text-on-surface-variant font-bold">LAST 7 DAYS</span>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">Campaign ROAS</span>
                    <span className="font-bold text-primary">12.4x</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full">
                    <div className="h-full bg-secondary w-4/5 rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[['14k', 'Reach'], ['822', 'Clicks'], ['34', 'Leads']].map(([v, l]) => (
                      <div key={l} className="text-center p-2 bg-surface-container-low rounded">
                        <div className="text-lg font-bold text-primary">{v}</div>
                        <div className="text-[8px] uppercase font-bold opacity-60">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-primary text-white rounded p-6 command-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Icon name="trending_up" className="text-sm" /> Sales Pulse (YTD)
                  </h3>
                  <span className="text-[10px] opacity-60 font-bold">LIVE METRIC</span>
                </div>
                <div className="text-3xl font-extrabold">$124,500,000</div>
                <div className="flex items-center gap-2 text-secondary text-xs font-bold mt-2">
                  +12% Year-over-Year <Icon name="north" className="text-xs" />
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between">
                  <div>
                    <div className="text-lg font-bold text-accent">$4.2M</div>
                    <div className="text-[8px] opacity-60 uppercase font-bold">Avg Deal Size</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">29</div>
                    <div className="text-[8px] opacity-60 uppercase font-bold">Closings</div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-8">
            <section className="bg-white border border-outline-variant/20 rounded p-6 command-shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Icon name="groups" className="text-primary" />
                  <h3 className="font-bold text-sm">Hot Buyers & CRM Velocity</h3>
                </div>
                <span className="text-[10px] font-extrabold bg-accent/20 px-1.5 py-0.5 rounded text-primary">6 High Int.</span>
              </div>
              <div className="space-y-5">
                {HOT_BUYERS.map((b) => (
                  <div key={b.name} className="flex items-start gap-3 p-3 rounded bg-surface border border-transparent hover:border-outline-variant/20 cursor-pointer">
                    <div className="w-10 h-10 rounded bg-secondary/20 flex items-center justify-center font-bold text-primary">{b.initials}</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold">{b.name}</h4>
                        <span className="text-[10px] font-extrabold text-primary">{b.budget}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant">Looking: {b.looking}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${b.tagClass}`}>{b.tag}</span>
                        <span className="text-[9px] text-on-surface-variant">{b.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 py-2 border border-primary text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">Go to CRM Pipeline</button>
            </section>

            <section className="bg-white border border-outline-variant/20 rounded p-6 command-shadow">
              <div className="flex items-center gap-2 mb-6">
                <Icon name="military_tech" className="text-primary" />
                <h3 className="font-bold text-sm">Recent Team Achievements</h3>
              </div>
              <div className="space-y-4">
                {ACHIEVEMENTS.map((a) => (
                  <div key={a.initial} className="flex gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-xs font-bold">{a.initial}</div>
                      <div className="absolute -bottom-1 -right-1 bg-accent rounded-full p-0.5">
                        <Icon name={a.icon} className="!text-[10px] text-primary" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] text-on-surface-variant">{a.text}</p>
                      <p className="text-[9px] opacity-60">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <footer className="grid grid-cols-2 md:grid-cols-4 gap-4 py-8 border-t border-outline-variant/10">
          {[
            { label: 'System Health', value: 'All Systems Nominal', icon: 'check_circle', iconClass: 'text-secondary' },
            { label: 'Data Recency', value: 'Updated 4 mins ago', icon: 'sync' },
            { label: 'Active Users', value: '12 Team Members Online' },
            { label: 'Support Command', value: 'Chat with Ops-Bot', icon: 'smart_toy', iconClass: 'text-primary' },
          ].map((f) => (
            <div key={f.label} className="p-4 bg-surface-container-low rounded border border-outline-variant/10">
              <div className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">{f.label}</div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary">{f.value}</span>
                {f.icon && <Icon name={f.icon} className={`text-xs ${f.iconClass || 'text-on-surface-variant'}`} />}
              </div>
            </div>
          ))}
        </footer>
      </div>

      <button className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 z-50 group">
        <Icon name="bolt" className="text-3xl" />
        <div className="absolute right-16 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none border border-secondary/30">
          Quick Action Command
        </div>
      </button>
    </DashboardLayout>
  );
}
