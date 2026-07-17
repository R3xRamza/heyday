import { useState, useEffect, useCallback, Fragment, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';
import ListPagination from '../components/shared/ListPagination';
import DateText from '../components/shared/DateText';
import PriceInput from '../components/shared/PriceInput';
import { formatCurrency, shortAddress } from '../utils/format';
import { useAgentScope } from '../context/AgentScopeContext';
import { appendAgentScope } from '../utils/agentScope';

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAGE_SIZE = 50;

function formatMoney(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(value) % 1 > 0 ? 2 : 0,
  }).format(value);
}

function PlanBadge({ plan }) {
  if (!plan) return null;
  const beforeCap = plan === 'before_cap';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
      beforeCap ? 'bg-feather/10 text-feather' : 'bg-secondary/15 text-secondary'
    }`}
    >
      {beforeCap ? 'Before cap' : 'After cap'}
    </span>
  );
}

function BreakdownLines({ breakdown }) {
  return (
    <div className="rounded-lg bg-surface-container-low/60 border border-primary/5 px-4 py-3">
      <div className="flex justify-between text-xs font-bold text-primary mb-2">
        <span>Gross commission</span>
        <span>{formatMoney(breakdown.gci)}</span>
      </div>
      <ul className="space-y-1 border-t border-primary/5 pt-2">
        {breakdown.lines.map((line) => (
          <li key={line.key} className="flex justify-between text-[11px]">
            <span className="text-on-surface-variant">{line.label}</span>
            <span className={line.amount < 0 ? 'text-error font-semibold' : 'text-on-surface-variant'}>
              {line.amount === 0 ? '$0' : formatMoney(line.amount)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between text-sm font-black text-secondary border-t border-primary/10 mt-2 pt-2">
        <span>Net to Meredith</span>
        <span>{formatMoney(breakdown.net)}</span>
      </div>
    </div>
  );
}

function GciEditor({ deal, onSave }) {
  const [value, setValue] = useState(deal.gross_commission ?? '');
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.stopPropagation();
    setSaving(true);
    await onSave(deal.id, value);
    setSaving(false);
  }

  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <PriceInput
        value={value}
        onChange={setValue}
        placeholder="GCI"
        className="w-24 px-2 py-1 bg-white border border-outline-variant/30 rounded text-xs text-right"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving || value === '' || value == null}
        className="px-2 py-1 bg-lemon text-feather rounded text-[10px] font-bold disabled:opacity-40"
      >
        {saving ? '…' : 'Set'}
      </button>
    </span>
  );
}

function DealsTable({ title, icon, headerClass, deals, emptyText, onSaveGci, projected }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    setExpanded(null);
  }, [deals]);

  const visibleDeals = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return deals.slice(start, start + PAGE_SIZE);
  }, [deals, page]);

  return (
    <section className="bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden">
      <div className={`${headerClass} px-4 py-2.5 flex items-center justify-between`}>
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <Icon name={icon} className="text-lemon !text-[18px]" />
          {title}
        </h3>
        <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">{deals.length}</span>
      </div>
      {deals.length === 0 ? (
        <p className="px-4 py-6 text-xs text-on-surface-variant">{emptyText}</p>
      ) : (
        <>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low border-b border-primary/5">
              {['Property', 'Close Date', 'Sale Price', 'GCI', 'Plan', projected ? 'Projected Net' : 'Net'].map((h) => (
                <th key={h} className="px-4 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {visibleDeals.map((deal) => (
              <Fragment key={deal.id}>
                <tr
                  onClick={() => deal.hasGci && setExpanded(expanded === deal.id ? null : deal.id)}
                  className={`transition-colors ${deal.hasGci ? 'cursor-pointer hover:bg-secondary-fixed/10' : 'bg-lemon/10'}`}
                >
                  <td className="px-4 py-2.5">
                    <span
                      role="link"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); navigate(`/transactions/${deal.id}`); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/transactions/${deal.id}`); }}
                      className="font-semibold text-xs text-primary hover:text-secondary hover:underline"
                    >
                      {shortAddress(deal.address)}
                    </span>
                    <p className="text-[10px] text-on-surface-variant">{deal.client_name || deal.city || '—'}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    {deal.close_date ? <DateText value={deal.close_date} /> : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{formatCurrency(deal.value)}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold">
                    {deal.hasGci ? formatMoney(deal.breakdown.gci) : <GciEditor deal={deal} onSave={onSaveGci} />}
                  </td>
                  <td className="px-4 py-2.5">
                    {deal.hasGci ? <PlanBadge plan={deal.breakdown.plan} /> : (
                      <span className="text-[9px] font-bold uppercase text-feather/60">Needs GCI</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-black text-secondary whitespace-nowrap">
                    {deal.hasGci ? formatMoney(deal.breakdown.net) : '—'}
                    {deal.hasGci && (
                      <Icon
                        name={expanded === deal.id ? 'expand_less' : 'expand_more'}
                        className="!text-[16px] text-on-surface-variant/50 ml-1 align-middle"
                      />
                    )}
                  </td>
                </tr>
                {expanded === deal.id && deal.hasGci && (
                  <tr className="bg-surface-container-low/30">
                    <td colSpan={6} className="px-4 py-3">
                      <BreakdownLines breakdown={deal.breakdown} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        <ListPagination page={page} total={deals.length} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}

function MonthlyChart({ monthly }) {
  const max = Math.max(1, ...monthly.map((m) => m.gci));
  const [hovered, setHovered] = useState(null);

  return (
    <section className="bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden">
      <div className="bg-surface-container-high px-4 py-2.5 flex items-center gap-2 border-b border-primary/5">
        <Icon name="bar_chart" className="text-secondary !text-[18px]" />
        <h3 className="text-sm font-bold text-primary">Monthly Earnings</h3>
        <div className="ml-auto flex items-center gap-3 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky/50" /> GCI</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-secondary" /> Net</span>
        </div>
      </div>
      <div className="px-4 pt-5 pb-3">
        <div className="h-40 flex items-end gap-1.5">
          {monthly.map((m, i) => (
            <div
              key={m.month}
              className="flex-1 h-full flex flex-col justify-end items-center gap-0 relative"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i && m.gci > 0 && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full z-10 whitespace-nowrap rounded-lg bg-feather text-white text-[10px] px-2.5 py-1.5 shadow-executive">
                  <span className="font-bold">{MONTH_NAMES[i]}</span>
                  {' · '}GCI {formatMoney(m.gci)}
                  {' · '}Net <span className="font-bold text-lemon">{formatMoney(m.net)}</span>
                </div>
              )}
              <div className="w-full relative flex items-end justify-center h-full">
                <div
                  className="w-full rounded-t bg-sky/50 transition-all"
                  style={{ height: `${(m.gci / max) * 100}%` }}
                />
                <div
                  className="w-full rounded-t bg-secondary absolute bottom-0 left-0 transition-all"
                  style={{ height: `${(m.net / max) * 100}%` }}
                />
              </div>
              <span className={`text-[9px] font-bold mt-1 ${hovered === i ? 'text-secondary' : 'text-on-surface-variant'}`}>
                {MONTH_LABELS[i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DistributionPanel({ summary }) {
  const rows = [
    { label: 'Net to Meredith', amount: summary?.net ?? 0, className: 'bg-secondary', emphasis: true },
    { label: 'eXp splits & fees', amount: (summary?.expSplit ?? 0) + (summary?.fees ?? 0), className: 'bg-feather' },
    { label: 'Tessa', amount: summary?.tessa ?? 0, className: 'bg-sky' },
    { label: 'Margaret', amount: summary?.margaret ?? 0, className: 'bg-lemon' },
  ];
  const total = Math.max(1, rows.reduce((acc, r) => acc + r.amount, 0));

  return (
    <section className="bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden">
      <div className="bg-surface-container-high px-4 py-2.5 flex items-center gap-2 border-b border-primary/5">
        <Icon name="donut_small" className="text-secondary !text-[18px]" />
        <h3 className="text-sm font-bold text-primary">Where the GCI Went</h3>
      </div>
      <div className="p-4">
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-surface-container-low mb-4">
          {rows.map((r) => (
            r.amount > 0 && (
              <div key={r.label} className={r.className} style={{ width: `${(r.amount / total) * 100}%` }} />
            )
          ))}
        </div>
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${r.className}`} />
              <span className={`text-xs flex-1 ${r.emphasis ? 'font-bold text-primary' : 'text-on-surface-variant'}`}>{r.label}</span>
              <span className={`text-xs ${r.emphasis ? 'font-black text-secondary' : 'font-semibold text-primary'}`}>
                {formatMoney(r.amount)}
              </span>
              <span className="text-[10px] text-on-surface-variant w-10 text-right">
                {Math.round((r.amount / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-primary/10 mt-3 pt-2.5 text-xs">
          <span className="font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">Total GCI</span>
          <span className="font-black text-primary">{formatMoney(summary?.gci ?? 0)}</span>
        </div>
      </div>
    </section>
  );
}

export default function RevenueAnalytics() {
  const [data, setData] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const { scope } = useAgentScope();

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(appendAgentScope(`/api/revenue?year=${year}`, scope), { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [year, scope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveGci = useCallback(async (dealId, value) => {
    const res = await fetch(`/api/revenue/deals/${dealId}/gci`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ gross_commission: value }),
    });
    if (res.ok) fetchData();
  }, [fetchData]);

  const s = data?.summary;
  const capPct = s ? Math.min(100, Math.round((s.capPaid / s.capAmount) * 100)) : 0;

  return (
    <DashboardLayout title="Revenue" className="p-5 md:p-6">
      <div className="space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Icon name="payments" className="text-secondary !text-[20px]" />
            <h2 className="text-base font-bold text-primary">Meredith&apos;s Commission</h2>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {s?.anniversaryStart && s?.anniversaryEnd && (
              <span className="text-[11px] text-on-surface-variant hidden sm:inline">
                Dec 1 anniversary · {s.anniversaryStart.slice(0, 7)} → {s.anniversaryEnd}
              </span>
            )}
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-outline-variant/30 rounded-lg text-sm font-semibold text-primary"
              title="Anniversary year ending Nov 30"
            >
              {(data?.years ?? [year]).map((y) => (
                <option key={y} value={y}>{y} (ends Nov 30)</option>
              ))}
            </select>
          </div>
        </div>

        {loading && !data ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-outline-variant/15 shadow-executive animate-pulse h-[7.5rem] bg-white" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
              <div className="relative overflow-hidden bg-gradient-to-br from-secondary/20 to-secondary/5 p-4 rounded-xl border border-white/60 shadow-executive">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg shadow-sm bg-secondary text-white mb-3">
                  <Icon name="account_balance_wallet" className="!text-[20px]" />
                </span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Net Income {s?.year}</p>
                <h2 className="text-2xl font-bold text-primary leading-tight mt-0.5">{formatMoney(s?.net ?? 0)}</h2>
                <p className="text-[11px] text-on-surface-variant mt-1">{s?.closedCount ?? 0} closed · {formatCurrency(s?.closedVolume ?? 0)} volume</p>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-feather/15 to-sky/10 p-4 rounded-xl border border-white/60 shadow-executive">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg shadow-sm bg-feather text-lemon mb-3">
                  <Icon name="paid" className="!text-[20px]" />
                </span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Gross Commission</p>
                <h2 className="text-2xl font-bold text-primary leading-tight mt-0.5">{formatMoney(s?.gci ?? 0)}</h2>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  {s?.gci > 0 ? `${Math.round(((s?.net ?? 0) / s.gci) * 100)}% kept after splits & fees` : 'No closings yet'}
                </p>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-lemon/40 to-lemon/10 p-4 rounded-xl border border-white/60 shadow-executive">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg shadow-sm bg-lemon text-feather mb-3">
                  <Icon name="speed" className="!text-[20px]" />
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">eXp Cap</p>
                  {s?.capped && (
                    <span className="px-1.5 py-0.5 rounded-full bg-secondary text-white text-[8px] font-black uppercase">Capped</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-primary leading-tight mt-0.5">
                  {formatMoney(s?.capPaid ?? 0)}
                  <span className="text-sm font-semibold text-on-surface-variant"> / {formatCurrency(s?.capAmount ?? 0)}</span>
                </h2>
                <div className="w-full bg-white/70 h-1.5 rounded-full overflow-hidden mt-2">
                  <div className="bg-secondary h-full rounded-full transition-all" style={{ width: `${capPct}%` }} />
                </div>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-sky/25 to-secondary/10 p-4 rounded-xl border border-white/60 shadow-executive">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg shadow-sm bg-sky text-feather mb-3">
                  <Icon name="trending_up" className="!text-[20px]" />
                </span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Pipeline (Pending)</p>
                <h2 className="text-2xl font-bold text-primary leading-tight mt-0.5">{formatMoney(s?.pipelineNet ?? 0)}</h2>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  {s?.pipelineCount ?? 0} under contract · {formatMoney(s?.pipelineGci ?? 0)} GCI
                </p>
              </div>
            </div>

            {s?.missingGci > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-lemon/25 border border-lemon px-3 py-2">
                <Icon name="warning" className="text-feather !text-[18px]" />
                <p className="text-xs font-semibold text-feather">
                  {s.missingGci} closed deal{s.missingGci === 1 ? '' : 's'} missing gross commission — enter GCI below to include in totals.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 items-start">
              <div className="lg:col-span-8">
                <MonthlyChart monthly={data?.monthly ?? []} />
              </div>
              <div className="lg:col-span-4">
                <DistributionPanel summary={s} />
              </div>
            </div>

            <DealsTable
              title={`Closed ${s?.year ?? ''}`}
              icon="task_alt"
              headerClass="bg-feather text-white"
              deals={data?.deals ?? []}
              emptyText="No closed deals this year."
              onSaveGci={saveGci}
            />

            <DealsTable
              title="Pipeline — Under Contract"
              icon="hourglass_top"
              headerClass="bg-tertiary text-white"
              deals={data?.pipeline ?? []}
              emptyText="Nothing under contract."
              onSaveGci={saveGci}
              projected
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
