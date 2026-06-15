import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';

const METRICS = [
  { icon: 'payments', change: '+12.5%', changeClass: 'text-secondary', label: 'Total Sales Revenue', value: '$4.28M', iconBg: 'text-secondary bg-secondary/5' },
  { icon: 'real_estate_agent', change: '-2.1%', changeClass: 'text-error', label: 'Active Closings', value: '142', iconBg: 'text-primary-container bg-primary-container/5' },
  { icon: 'query_stats', change: '+8.4%', changeClass: 'text-secondary', label: 'Market Velocity', value: '18 Days', iconBg: 'text-purple bg-purple/5' },
];

const CHART = [
  { month: 'JAN', height: '40%', value: '$1.8M Jan', actual: true },
  { month: 'FEB', height: '55%', value: '$2.4M Feb', actual: true },
  { month: 'MAR', height: '48%', value: '$2.1M Mar', actual: true },
  { month: 'APR', height: '75%', value: '$3.2M Apr', actual: true },
  { month: 'MAY', height: '90%', value: '$4.1M May', actual: true, highlight: true },
  { month: 'JUN', height: '82%', value: '$3.8M Jun (Est)', actual: false },
];

const REGIONS = [
  { name: 'Upper East Side', pct: 42, color: 'bg-primary-container' },
  { name: 'Tribeca Central', pct: 28, color: 'bg-secondary' },
  { name: 'Chelsea Lofts', pct: 15, color: 'bg-purple' },
];

const TRANSACTIONS = [
  { property: '742 Evergreen Terrace, Manhattan', agent: 'JD', agentName: 'Julian D.', value: '$2,450,000', status: 'CLOSED', statusClass: 'bg-feather-alt/15 text-feather-alt', date: 'May 24, 2024' },
  { property: 'The Heights Penthouse, Brooklyn', agent: 'ML', agentName: 'Marcus L.', value: '$1,890,000', status: 'PENDING', statusClass: 'bg-lemon/15 text-[#8a892b]', date: 'May 26, 2024' },
  { property: 'Riverside Commons, Unit 4B', agent: 'SC', agentName: 'Sarah C.', value: '$945,000', status: 'MARKETING', statusClass: 'bg-purple/15 text-purple', date: 'May 27, 2024' },
];

const AI_SUGGESTIONS = [
  { icon: 'query_stats', text: 'Analyze Q2 market data trends' },
  { icon: 'warning', text: 'Identify bottlenecks' },
  { icon: 'trending_up', text: 'Forecast Q3 revenue growth' },
];

export default function RevenueAnalytics() {
  return (
    <DashboardLayout title="Revenue Dashboard" className="pb-10 px-8 pt-8 pr-[22rem]">
      <header className="mb-8">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-semibold text-primary-container mb-1">Revenue Dashboard</h2>
            <p className="text-on-surface-variant">Real-time performance analytics and automated forecasting.</p>
          </div>
          <div className="flex gap-2">
            <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary" /> Live Updates
            </span>
            <span className="bg-outline-variant/10 text-outline px-3 py-1 rounded-full text-xs font-semibold">Q2 FY2024</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {METRICS.map((m) => (
            <div key={m.label} className="bg-white border border-outline-variant/10 p-6 rounded-xl shadow-executive hover:-translate-y-1 transition-transform">
              <div className="flex justify-between items-start mb-4">
                <Icon name={m.icon} className={`p-2 rounded-lg ${m.iconBg}`} />
                <span className={`font-bold text-xs ${m.changeClass}`}>{m.change}</span>
              </div>
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">{m.label}</p>
              <h3 className="text-3xl font-extrabold text-primary-container">{m.value}</h3>
            </div>
          ))}
        </div>

        <div className="col-span-12 lg:col-span-8 bg-white border border-outline-variant/10 p-6 rounded-xl shadow-executive">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-xl font-semibold text-primary-container">Revenue Trends</h4>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-primary-container" /> Actual</label>
              <label className="flex items-center gap-2 text-on-surface-variant"><span className="w-3 h-3 rounded-full bg-secondary-container" /> Projected</label>
            </div>
          </div>
          <div className="relative h-64 w-full flex items-end justify-between px-4 pb-6 border-b border-l border-outline-variant/20">
            <div className="absolute inset-0 flex flex-col justify-between py-2 text-[10px] text-outline opacity-50">
              {['5.0M', '4.0M', '3.0M', '2.0M', '1.0M', '0'].map((v) => <span key={v}>{v}</span>)}
            </div>
            {CHART.map((bar) => (
              <div
                key={bar.month}
                className={`w-12 rounded-t-sm hover:brightness-110 transition-all cursor-pointer relative group ${bar.actual ? 'bg-primary-container' : 'bg-secondary-container'} ${bar.highlight ? 'border-t-4 border-secondary' : ''} ${!bar.actual ? 'border-t-4 border-dashed border-secondary' : ''}`}
                style={{ height: bar.height }}
              >
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{bar.value}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-xs text-on-surface-variant font-bold">
            {CHART.map((b) => <span key={b.month}>{b.month}</span>)}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white border border-outline-variant/10 p-6 rounded-xl shadow-executive">
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Regional Distribution</h4>
            <div className="space-y-4">
              {REGIONS.map((r) => (
                <div key={r.name} className="space-y-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{r.name}</span><span className="font-bold">{r.pct}%</span>
                  </div>
                  <div className="h-2 w-full bg-surface-container-high rounded-full">
                    <div className={`h-full ${r.color} rounded-full`} style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-primary-container p-6 rounded-xl text-white relative overflow-hidden group shadow-executive">
            <div className="relative z-10">
              <h4 className="text-xl font-semibold mb-2">Portfolio Growth</h4>
              <p className="text-secondary-fixed opacity-80 mb-4">Your current trajectory indicates a 15% increase by year end.</p>
              <button className="text-xs font-bold flex items-center gap-2 group-hover:gap-4 transition-all uppercase tracking-widest">
                View Full Report <Icon name="arrow_forward" />
              </button>
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl group-hover:scale-110 transition-transform" />
          </div>
        </div>

        <div className="col-span-12 bg-white border border-outline-variant/10 rounded-xl shadow-executive overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
            <h4 className="text-xl font-semibold text-primary-container">Recent Transactions</h4>
            <button className="text-secondary font-bold text-xs hover:underline">Download CSV</button>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                {['Property Asset', 'Agent', 'Value', 'Status', 'Date'].map((h) => (
                  <th key={h} className="px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRANSACTIONS.map((t) => (
                <tr key={t.property} className="border-b border-outline-variant/5 hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-bold text-primary-container">{t.property}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-secondary-container/30 flex items-center justify-center text-[10px] font-bold">{t.agent}</div>
                      {t.agentName}
                    </div>
                  </td>
                  <td className="px-6 py-4">{t.value}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${t.statusClass}`}>{t.status}</span>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="fixed right-0 top-0 bottom-0 w-[22rem] bg-surface-container-low border-l border-outline-variant/10 flex flex-col z-30 shadow-executive">
        <div className="p-6 border-b border-outline-variant/10 bg-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-primary-container rounded-lg flex items-center justify-center">
              <Icon name="smart_toy" className="text-white !text-[20px]" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-primary-container">Heyday AI</h3>
              <p className="text-[10px] text-on-surface-variant flex items-center gap-1 uppercase tracking-widest font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" /> Research Agent Active
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-2">
            <div className="bg-primary-container text-white p-4 rounded-xl rounded-tl-none shadow-executive text-sm">
              Hello Tessa. I&apos;ve finished scanning the Q2 market trends. Revenue is up by 12.5%, largely driven by the high-velocity sales in the Upper East Side. Would you like a breakdown of specific property bottlenecks?
            </div>
            <span className="text-[10px] text-on-surface-variant px-2">9:41 AM</span>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-bold text-on-surface-variant uppercase">Recommended Actions</p>
            {AI_SUGGESTIONS.map((s) => (
              <button key={s.text} className="w-full text-left p-3 border border-outline-variant/20 bg-white rounded-lg hover:border-secondary hover:text-secondary transition-all text-sm flex items-center gap-3 group">
                <Icon name={s.icon} className="!text-[18px] opacity-50 group-hover:opacity-100" />
                {s.text}
              </button>
            ))}
          </div>
          <div className="bg-off-white border border-outline-variant/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2 text-secondary">
              <Icon name="info" className="!text-[18px]" />
              <span className="text-xs font-bold">Insight Alert</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed italic">
              &quot;Market velocity for luxury lofts has decreased by 4 days this month. Consider re-evaluating price points in the Chelsea sector.&quot;
            </p>
          </div>
        </div>
        <div className="p-6 bg-white border-t border-outline-variant/10">
          <div className="relative">
            <textarea className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none resize-none" placeholder="Ask AI about revenue..." rows={1} />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-secondary text-white rounded-lg hover:brightness-110">
              <Icon name="send" />
            </button>
          </div>
          <p className="mt-2 text-[10px] text-center text-outline-variant">Powered by Heyday Intelligence Engine v4.2</p>
        </div>
      </aside>
    </DashboardLayout>
  );
}
