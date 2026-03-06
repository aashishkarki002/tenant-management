import React, { useState } from 'react';
import {
  Wallet, Building2, AlertCircle, Wrench, ChevronRight,
  TrendingUp, CheckCircle2, Clock, AlertTriangle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val) {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n.toLocaleString()}`;
}

function pct(a, b) {
  if (!b || !a) return 0;
  return Math.min(100, Math.round((Number(a) / Number(b)) * 100));
}

function Bone({ w = 'w-full', h = 'h-4', dark = false }) {
  return <div className={`animate-pulse rounded-md ${w} ${h} ${dark ? 'bg-white/10' : 'bg-[#EEE9E5]'}`} />;
}

function Card({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col ${className}`}
      style={{ borderColor: '#DDD6D0', ...style }}>
      {children}
    </div>
  );
}

// ─── 1. MONEY IN ─────────────────────────────────────────────────────────────

function RevenueCard({ stats, loading }) {
  const [view, setView] = useState('month');
  const rentSummary = stats?.rentSummary ?? {};
  const collected = rentSummary.totalCollected ?? null;
  const target = rentSummary.totalRent ?? null;
  const breakdown = stats?.revenueBreakdownThisMonth ?? stats?.revenueBreakdown ?? [];
  const thisMonth = breakdown.reduce((s, r) => s + (r.amount ?? 0), 0);
  const display = thisMonth > 0 ? thisMonth : collected;
  const collPct = pct(display, target);

  const yearData = stats?.revenueThisYear ?? [];
  const npMonth = stats?.npMonth ?? null;
  const elapsed = yearData.filter(m => npMonth == null || m.month <= npMonth);
  const ytd = elapsed.reduce((s, m) => s + (m.total ?? 0), 0);
  const ytdTarget = target != null && elapsed.length > 0 ? target * elapsed.length : null;
  const ytdPct = pct(ytd, ytdTarget);
  const hitMonths = elapsed.filter(m => (m.total ?? 0) > 0).length;
  const missedMonths = elapsed.length - hitMonths;
  const avgMonthly = elapsed.length > 0 ? ytd / elapsed.length : 0;

  return (
    <Card style={{ background: '#3D1414', borderColor: '#521C1C' }}>
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-1.5"
            style={{ color: '#8B3030' }}>Revenue</p>
          {loading ? <Bone dark w="w-32" h="h-10" /> : (
            <p className="text-4xl font-bold tabular-nums leading-none" style={{ color: 'white' }}>
              {view === 'month'
                ? (display != null ? `₹${Number(display).toLocaleString()}` : '—')
                : `₹${Number(ytd).toLocaleString()}`}
            </p>
          )}
          {!loading && <p className="text-xs mt-1.5" style={{ color: '#C47272' }}>
            {view === 'month' ? 'Collected this month' : `YTD · ${elapsed.length} months`}
          </p>}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-white/10 text-[11px] font-semibold mt-1 shrink-0">
          {[['month', 'Month'], ['year', 'YTD']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 transition-all"
              style={view === v ? { background: '#F0DADA', color: '#3D1414' } : { background: 'transparent', color: 'rgba(240,218,218,0.4)' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {!loading && target != null && target > 0 && (
        <div className="px-5 pb-4 space-y-1.5">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#521C1C' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${view === 'month' ? collPct : ytdPct}%`, background: '#DDA8A8' }} />
          </div>
          <p className="text-[11px]" style={{ color: '#C47272' }}>
            {view === 'month' ? `${collPct}% of ${fmt(target)} target` : `${ytdPct}% of ${fmt(ytdTarget)} prorated`}
          </p>
        </div>
      )}
      {loading && <div className="px-5 pb-4 space-y-2"><Bone dark h="h-2" /><Bone dark w="w-24" h="h-3" /></div>}

      <div className="flex-1 px-5 pb-5">
        {loading ? (
          <div className="space-y-2.5"><Bone dark /><Bone dark w="w-5/6" /><Bone dark w="w-4/6" /></div>
        ) : view === 'month' ? (
          breakdown.length > 0 && (
            <div className="space-y-2 border-t pt-3" style={{ borderColor: '#521C1C' }}>
              <p className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: '#8B3030' }}>Breakdown</p>
              {breakdown.map(item => (
                <div key={item.code} className="flex justify-between items-center gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-1 h-1 rounded-full shrink-0" style={{ background: '#948472' }} />
                    <span className="text-xs truncate" style={{ color: '#DDA8A8' }}>{item.name}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: '#F0DADA' }}>
                    {fmt(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: '#521C1C' }}>
              {[
                { val: fmt(avgMonthly), label: 'Avg / mo', color: '#F0DADA' },
                { val: hitMonths, label: 'Months hit', color: '#6EE7B7' },
                { val: missedMonths, label: 'Missed', color: missedMonths > 0 ? '#FCA5A5' : '#F0DADA' },
              ].map((s, i) => (
                <div key={i}>
                  <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: '#8B3030' }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 max-h-[130px] overflow-y-auto">
              {elapsed.map(m => {
                const has = (m.total ?? 0) > 0;
                const cur = m.month === npMonth;
                return (
                  <div key={m.month} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: cur ? '#F0DADA' : has ? '#6EE7B7' : '#521C1C' }} />
                      <span className="text-xs truncate"
                        style={{ color: cur ? '#F0DADA' : '#C47272', fontWeight: cur ? 600 : 400 }}>
                        {m.name}{cur ? ' · now' : ''}
                      </span>
                    </span>
                    <span className="text-xs font-medium tabular-nums shrink-0"
                      style={{ color: has ? '#F0DADA' : '#521C1C' }}>
                      {has ? `₹${Number(m.total).toLocaleString()}` : 'no data'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Link to="/rent-payment"
        className="flex items-center justify-between px-5 py-3 border-t text-xs font-semibold
                   transition-all hover:opacity-75 group"
        style={{ borderColor: '#521C1C', color: '#DDA8A8' }}>
        View all transactions
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </Card>
  );
}

// ─── 2. MONEY RISK ────────────────────────────────────────────────────────────

function MoneyRiskCard({ stats, loading }) {
  const rentSummary = stats?.rentSummary ?? {};
  const outstanding = rentSummary.totalOutstanding ?? null;
  const target = rentSummary.totalRent ?? null;
  const attention = stats?.attention ?? {};
  const overdueCount = attention.overdueCount ?? 0;
  const overdueAmount = attention.overdueAmount ?? 0;
  const overdueTenants = attention.overdueTenants ?? [];
  const collectedPct = pct((target ?? 0) - (outstanding ?? 0), target);
  const allClear = outstanding != null && Number(outstanding) <= 0;

  return (
    <Card>
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#EEE9E5' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-1.5"
              style={{ color: '#948472' }}>Outstanding</p>
            {loading ? <Bone w="w-28" h="h-10" /> : (
              <p className="text-4xl font-bold tabular-nums leading-none"
                style={{ color: allClear ? '#2E7A4A' : '#B02020' }}>
                {outstanding != null ? `₹${Number(outstanding).toLocaleString()}` : '—'}
              </p>
            )}
            {!loading && <p className="text-xs mt-1.5" style={{ color: '#948472' }}>
              {allClear ? 'All dues cleared' : `${overdueCount} tenant${overdueCount !== 1 ? 's' : ''} overdue`}
            </p>}
          </div>
          <div className="rounded-xl p-2.5 mt-1"
            style={{ background: allClear ? '#D4EDE0' : '#F5D5D5' }}>
            {allClear
              ? <CheckCircle2 className="w-5 h-5" style={{ color: '#2E7A4A' }} />
              : <AlertCircle className="w-5 h-5" style={{ color: '#B02020' }} />}
          </div>
        </div>

        {!loading && target != null && target > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F5D5D5' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${collectedPct}%`,
                  background: collectedPct >= 80 ? '#2E7A4A' : collectedPct >= 50 ? '#C4721A' : '#B02020'
                }} />
            </div>
            <div className="flex justify-between text-[11px]" style={{ color: '#948472' }}>
              <span>{collectedPct}% collected of {fmt(target)}</span>
              <span style={{ color: outstanding > 0 ? '#B02020' : '#2E7A4A' }}>{fmt(outstanding)} left</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 px-5 py-4">
        {loading ? (
          <div className="space-y-2.5"><Bone /><Bone w="w-5/6" /><Bone w="w-4/6" /></div>
        ) : overdueTenants.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5"
              style={{ color: '#948472' }}>Overdue tenants</p>
            {overdueTenants.slice(0, 4).map((t, i) => (
              <div key={t._id ?? i}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 border"
                style={{ background: '#FFF8F8', borderColor: 'rgba(176,32,32,0.15)' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                    style={{ background: '#F5D5D5', color: '#B02020' }}>
                    {(t.name ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: '#1C1A18' }}>{t.name}</p>
                    <p className="text-[10px]" style={{ color: '#948472' }}>{t.unit ?? `Unit ${t.unitNumber ?? ''}`}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-bold tabular-nums" style={{ color: '#B02020' }}>
                    {fmt(t.amount ?? t.outstanding)}
                  </p>
                  {t.daysOverdue != null && (
                    <p className="text-[10px]" style={{ color: '#C47272' }}>{t.daysOverdue}d overdue</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="w-8 h-8 mb-2" style={{ color: '#2E7A4A' }} />
            <p className="text-sm font-semibold" style={{ color: '#1D4A2E' }}>No overdue payments</p>
            <p className="text-xs mt-0.5" style={{ color: '#948472' }}>All tenants are up to date</p>
          </div>
        )}
      </div>

      <Link to="/dashboard/transactions"
        className="flex items-center justify-between px-5 py-3 border-t text-xs font-semibold
                   transition-all hover:bg-[#F8F5F2] group"
        style={{ borderColor: '#EEE9E5', color: '#3D1414' }}>
        View all payments
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </Card>
  );
}

// ─── 3. BUILDING STATUS ───────────────────────────────────────────────────────

function BuildingCard({ stats, loading }) {
  const occ = stats?.occupancy ?? {};
  const rate = occ.occupancyRate ?? occ.rate ?? 0;
  const occupied = occ.occupiedUnits ?? occ.occupied ?? 0;
  const total = occ.totalUnits ?? occ.total ?? 0;
  const vacant = occ.vacantUnits ?? occ.vacant ?? Math.max(0, total - occupied);
  const contracts = stats?.contractsEndingSoon ?? [];

  const rateColor = rate >= 80 ? '#2E7A4A' : rate >= 50 ? '#C4721A' : '#B02020';
  const rateBg = rate >= 80 ? '#D4EDE0' : rate >= 50 ? '#FAEBD3' : '#F5D5D5';
  const rateLabel = rate >= 80 ? 'Healthy' : rate >= 50 ? 'Moderate' : 'Low';
  const gridSize = Math.min(total, 30);
  const dots = Array.from({ length: gridSize }, (_, i) => i < occupied);

  return (
    <Card>
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#EEE9E5' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-1.5"
              style={{ color: '#948472' }}>Occupancy</p>
            {loading ? <Bone w="w-24" h="h-10" /> : (
              <p className="text-4xl font-bold tabular-nums leading-none" style={{ color: rateColor }}>
                {rate}%
              </p>
            )}
            {!loading && <p className="text-xs mt-1.5" style={{ color: '#948472' }}>
              {occupied} occupied · {vacant} vacant of {total}
            </p>}
          </div>
          <div className="flex flex-col items-end gap-2 mt-1">
            <div className="rounded-xl p-2.5" style={{ background: '#EEE9E5' }}>
              <Building2 className="w-5 h-5" style={{ color: '#3D1414' }} />
            </div>
            {!loading && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: rateBg, color: rateColor }}>{rateLabel}</span>
            )}
          </div>
        </div>

        {/* Visual unit grid */}
        {!loading && total > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-1">
              {dots.map((isOcc, i) => (
                <div key={i} className="w-3 h-3 rounded-sm transition-colors"
                  style={{ background: isOcc ? '#3D1414' : '#EEE9E5' }} />
              ))}
              {total > 30 && <span className="text-[10px] self-center ml-1" style={{ color: '#AFA097' }}>+{total - 30}</span>}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              {[['#3D1414', 'Occupied'], ['#EEE9E5', 'Vacant']].map(([bg, label]) => (
                <span key={label} className="flex items-center gap-1.5 text-[10px]" style={{ color: '#948472' }}>
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: bg }} />{label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 px-5 py-4">
        {loading ? (
          <div className="space-y-2"><Bone /><Bone w="w-5/6" /></div>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5 flex items-center gap-1.5"
              style={{ color: '#948472' }}>
              <Clock className="w-3 h-3" />Leases ending soon
            </p>
            {contracts.length > 0 ? (
              <div className="space-y-2">
                {contracts.slice(0, 3).map((c, i) => (
                  <div key={c._id ?? i}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 border"
                    style={{ background: '#F8F5F2', borderColor: '#EEE9E5' }}>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: '#1C1A18' }}>{c.name}</p>
                      <p className="text-[10px]" style={{ color: '#948472' }}>{c.unit ?? ''}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ml-2"
                      style={c.daysUntilEnd <= 7
                        ? { background: '#F5D5D5', color: '#B02020' }
                        : c.daysUntilEnd <= 14
                          ? { background: '#FAEBD3', color: '#C4721A' }
                          : { background: '#EEE9E5', color: '#756F67' }}>
                      {c.daysUntilEnd}d left
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs py-2" style={{ color: '#AFA097' }}>No leases expiring soon</p>
            )}
          </>
        )}
      </div>

      <Link to="/dashboard/units"
        className="flex items-center justify-between px-5 py-3 border-t text-xs font-semibold
                   transition-all hover:bg-[#F8F5F2] group"
        style={{ borderColor: '#EEE9E5', color: '#3D1414' }}>
        Manage units
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </Card>
  );
}

// ─── 4. ACTION QUEUE ──────────────────────────────────────────────────────────

function ActionCard({ stats, loading }) {
  const navigate = useNavigate();
  const attention = stats?.attention ?? {};
  const overdueCount = attention.overdueCount ?? 0;
  const overdueAmount = attention.overdueAmount ?? 0;
  const maintenanceCount = attention.maintenanceCount ?? stats?.maintenanceOpen ?? 0;
  const maintenanceDetail = attention.maintenanceDetail
    ?? (maintenanceCount > 0 ? `${maintenanceCount} open request${maintenanceCount !== 1 ? 's' : ''}` : 'No open requests');
  const expiring = (stats?.contractsEndingSoon ?? []).filter(c => c.daysUntilEnd <= 14);
  const urgentTotal = (overdueCount > 0 ? 1 : 0) + (maintenanceCount > 0 ? 1 : 0) + (expiring.length > 0 ? 1 : 0);
  const allClear = urgentTotal === 0;

  const rows = [
    {
      id: 'overdue', route: '/dashboard/transactions',
      label: overdueCount > 0 ? `${overdueCount} overdue payment${overdueCount !== 1 ? 's' : ''}` : 'Payments up to date',
      sub: overdueCount > 0 ? `${fmt(overdueAmount)} total pending` : 'No overdue rent',
      icon: AlertCircle, urgent: overdueCount > 0,
      urgentBg: 'rgba(176,32,32,0.07)', urgentBorder: 'rgba(176,32,32,0.22)',
      iconBg: overdueCount > 0 ? '#F5D5D5' : '#EEE9E5',
      iconColor: overdueCount > 0 ? '#B02020' : '#948472',
      labelColor: overdueCount > 0 ? '#5C1414' : '#413D38',
      amount: overdueCount > 0 ? fmt(overdueAmount) : null,
      amountColor: '#B02020',
      cta: overdueCount > 0 ? 'Collect' : null,
      ctaStyle: { background: '#F5D5D5', color: '#B02020' },
    },
    {
      id: 'maintenance', route: '/maintenance',
      label: maintenanceCount > 0 ? `${maintenanceCount} maintenance request${maintenanceCount !== 1 ? 's' : ''}` : 'No maintenance issues',
      sub: maintenanceDetail,
      icon: Wrench, urgent: maintenanceCount > 0,
      urgentBg: 'rgba(196,114,26,0.07)', urgentBorder: 'rgba(196,114,26,0.22)',
      iconBg: maintenanceCount > 0 ? '#FAEBD3' : '#EEE9E5',
      iconColor: maintenanceCount > 0 ? '#C4721A' : '#948472',
      labelColor: maintenanceCount > 0 ? '#5C3A10' : '#413D38',
      amount: null, amountColor: null,
      cta: maintenanceCount > 0 ? 'Review' : null,
      ctaStyle: { background: '#FAEBD3', color: '#C4721A' },
    },
    {
      id: 'contracts', route: '/dashboard/units',
      label: expiring.length > 0 ? `${expiring.length} lease${expiring.length !== 1 ? 's' : ''} expiring ≤14d` : 'No leases expiring',
      sub: expiring.length > 0 ? expiring.slice(0, 2).map(c => c.name).join(', ') : 'All leases current',
      icon: Clock, urgent: expiring.length > 0,
      urgentBg: 'rgba(46,90,140,0.06)', urgentBorder: 'rgba(46,90,140,0.2)',
      iconBg: expiring.length > 0 ? '#D4E4F5' : '#EEE9E5',
      iconColor: expiring.length > 0 ? '#2E5A8C' : '#948472',
      labelColor: expiring.length > 0 ? '#1A2E4A' : '#413D38',
      amount: null, amountColor: null,
      cta: expiring.length > 0 ? 'Renew' : null,
      ctaStyle: { background: '#D4E4F5', color: '#1A2E4A' },
    },
  ];

  return (
    <Card style={{ borderColor: urgentTotal > 0 ? 'rgba(176,32,32,0.28)' : '#DDD6D0' }}>
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#EEE9E5' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-1.5"
              style={{ color: '#948472' }}>Action Queue</p>
            {loading ? <Bone w="w-40" h="h-7" /> : (
              <p className="text-2xl font-bold leading-none"
                style={{ color: allClear ? '#2E7A4A' : '#1C1A18' }}>
                {allClear ? 'All clear' : `${urgentTotal} item${urgentTotal !== 1 ? 's' : ''} need attention`}
              </p>
            )}
          </div>
          {!loading && urgentTotal > 0 && (
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 mt-1"
              style={{ background: '#F5D5D5' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#B02020' }} />
              <span className="text-[11px] font-bold" style={{ color: '#B02020' }}>{urgentTotal} urgent</span>
            </div>
          )}
          {!loading && allClear && (
            <div className="rounded-xl p-2.5 mt-1" style={{ background: '#D4EDE0' }}>
              <CheckCircle2 className="w-5 h-5" style={{ color: '#2E7A4A' }} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-5 py-4 space-y-2.5">
        {loading ? (
          <div className="space-y-2.5"><Bone h="h-16" /><Bone h="h-16" /><Bone h="h-16" /></div>
        ) : rows.map(r => {
          const Icon = r.icon;
          return (
            <Link key={r.id} to={r.route}
              className="flex items-center justify-between rounded-xl px-3.5 py-3 border
                         transition-all duration-150 group hover:shadow-sm"
              style={r.urgent
                ? { background: r.urgentBg, borderColor: r.urgentBorder }
                : { background: '#F8F5F2', borderColor: '#EEE9E5' }}>
              <div className="flex items-center gap-3">
                <div className="rounded-full p-2 shrink-0" style={{ background: r.iconBg }}>
                  <Icon className="w-4 h-4" style={{ color: r.iconColor }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: r.labelColor }}>{r.label}</p>
                  <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#948472' }}>{r.sub}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {r.amount && <span className="text-sm font-bold tabular-nums" style={{ color: r.amountColor }}>{r.amount}</span>}
                {r.cta && (
                  <span className="hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                    style={r.ctaStyle}>{r.cta}</span>
                )}
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                  style={{ color: '#C8BDB6' }} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick-add footer */}
      <div className="px-5 py-3 border-t flex items-center gap-2"
        style={{ borderColor: '#EEE9E5', background: '#F8F5F2' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mr-auto" style={{ color: '#AFA097' }}>
          Quick add
        </p>
        {[
          { label: '+ Payment', route: '/rent-payment?action=new' },
          { label: '+ Maintenance', route: '/maintenance?action=new' },
        ].map(b => (
          <button key={b.label} onClick={() => navigate(b.route)}
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all
                       hover:border-[#3D1414] hover:text-[#3D1414] hover:bg-white active:scale-95"
            style={{ borderColor: '#DDD6D0', color: '#756F67', background: 'white' }}>
            {b.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function SummaryCard({ stats, loading, error, onRetry }) {
  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-2xl border px-6 py-5"
          style={{ background: '#F5D5D5', borderColor: 'rgba(176,32,32,0.3)' }}>
          <p className="text-sm font-medium mb-3" style={{ color: '#B02020' }}>{error}</p>
          {onRetry && (
            <button onClick={onRetry}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: '#B02020', color: '#B02020' }}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
      <RevenueCard stats={stats} loading={loading} />
      <MoneyRiskCard stats={stats} loading={loading} />
      <BuildingCard stats={stats} loading={loading} />
      <ActionCard stats={stats} loading={loading} />
    </div>
  );
}