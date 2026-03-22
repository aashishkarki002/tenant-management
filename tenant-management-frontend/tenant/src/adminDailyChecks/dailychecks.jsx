/**
 * DailyChecks.jsx
 *
 * Architecture: Status-board — one card per inspection category (7 fixed).
 * Drawer: two tabs → Report (swappable via history) + History (sparkline + log).
 *
 * APIs:
 *   GET /api/property/get-property
 *   GET /api/checklists?category=X&propertyId=Y&limit=1   → latest per category
 *   GET /api/checklists/:id                                → full report detail
 *   GET /api/checklists?category=X&propertyId=Y&limit=30  → history tab
 *   POST /api/checklists/create                            → seed from template
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Camera, Zap, Droplets, Building2, Car, Flame, Waves,
  Plus, CheckCircle2, XCircle, AlertTriangle, ChevronRight,
  Calendar, User, RefreshCw, ClipboardList, Shield, Clock,
  ChevronDown, ChevronUp, FileText, History, BarChart2,
  ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import api       from '../../plugins/axios';
import { toast } from 'sonner';

/* ── Design constants ─────────────────────────────────────── */

const CATEGORIES = [
  { key: 'CCTV',        label: 'CCTV',          Icon: Camera,    iconColor: '#1A5276', bg: '#EBF5FB', border: '#AED6F1', accent: '#1A5276' },
  { key: 'ELECTRICAL',  label: 'Electrical',    Icon: Zap,       iconColor: '#92400e', bg: '#FEF9C3', border: '#FDE68A', accent: '#b45309' },
  { key: 'SANITARY',    label: 'Sanitary',      Icon: Droplets,  iconColor: '#0e7490', bg: '#CFFAFE', border: '#A5F3FC', accent: '#0e7490' },
  { key: 'COMMON_AREA', label: 'Common Area',   Icon: Building2, iconColor: '#5b21b6', bg: '#EDE9FE', border: '#C4B5FD', accent: '#5b21b6' },
  { key: 'PARKING',     label: 'Parking',       Icon: Car,       iconColor: '#374151', bg: '#F3F4F6', border: '#D1D5DB', accent: '#4b5563' },
  { key: 'FIRE',        label: 'Fire & Safety', Icon: Flame,     iconColor: '#991b1b', bg: '#FEE2E2', border: '#FECACA', accent: '#dc2626' },
  { key: 'WATER_TANK',  label: 'Water Tank',    Icon: Waves,     iconColor: '#0369a1', bg: '#E0F2FE', border: '#BAE6FD', accent: '#0284c7' },
];

const CAT = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

const STATUS_CFG = {
  PENDING:     { label: 'Pending',     bg: 'var(--color-warning-bg)', text: 'var(--color-warning)',  bd: 'var(--color-warning-border)' },
  IN_PROGRESS: { label: 'In Progress', bg: 'var(--color-info-bg)',    text: 'var(--color-info)',     bd: 'var(--color-info-border)'    },
  COMPLETED:   { label: 'Completed',   bg: 'var(--color-success-bg)', text: 'var(--color-success)',  bd: 'var(--color-success-border)' },
  INCOMPLETE:  { label: 'Incomplete',  bg: 'var(--color-danger-bg)',  text: 'var(--color-danger)',   bd: 'var(--color-danger-border)'  },
};

const FREQ = { DAILY: 'Daily', WEEKLY_TWICE: 'Twice Weekly', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };

/* ── Utilities ─────────────────────────────────────────────── */

const pRate  = c => (!c?.totalItems ? 0 : Math.round((c.passedItems / c.totalItems) * 100));
const rColor = r => r === 100 ? 'var(--color-success)' : r >= 70 ? 'var(--color-warning)' : 'var(--color-danger)';
const fDate  = d => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return '—'; } };
const fShort = d => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return '—'; } };
const fails  = c => (c?.sections || []).flatMap(s => (s.items || []).filter(i => !i.isOk).map(i => ({ ...i, sectionLabel: s.sectionLabel })));

/* ── Pass Rate Ring ─────────────────────────────────────────── */

function Ring({ rate = 0, size = 40, sw = 3.5 }) {
  const r = (size - sw * 2) / 2, circ = 2 * Math.PI * r, fill = Math.max(0, Math.min(1, rate / 100)) * circ;
  const col = rColor(rate);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={sw}
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size < 44 ? '9px' : '11px', fontWeight: 700, color: col,
      }}>{rate}%</div>
    </div>
  );
}

/* ── Sparkline bar chart ────────────────────────────────────── */

function Sparkline({ history = [], max = 10 }) {
  const slice   = [...history].reverse().slice(-max);
  const padded  = Array(Math.max(0, max - slice.length)).fill(null).concat(slice);
  const rates   = slice.map(c => pRate(c));
  const latest  = rates.at(-1) ?? null;
  const prev    = rates.at(-2) ?? null;
  const delta   = latest !== null && prev !== null ? latest - prev : null;
  const TIcon   = delta === null ? Minus : delta > 2 ? TrendingUp : delta < -2 ? TrendingDown : Minus;
  const tCol    = delta === null ? 'var(--color-text-weak)' : delta > 2 ? 'var(--color-success)' : delta < -2 ? 'var(--color-danger)' : 'var(--color-text-sub)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '32px' }}>
        {padded.map((c, i) => {
          if (!c) return <div key={i} style={{ width: 7, height: 7, borderRadius: '999px', backgroundColor: 'var(--color-muted)', alignSelf: 'center', opacity: 0.35, flexShrink: 0 }} />;
          const r = pRate(c), h = Math.max(7, Math.round((r / 100) * 32));
          return (
            <div key={i} title={`${fShort(c.checkDate)} — ${r}%`} style={{
              width: 7, height: h, borderRadius: '999px 999px 2px 2px', flexShrink: 0,
              backgroundColor: rColor(r), alignSelf: 'flex-end',
              opacity: i === padded.length - 1 ? 1 : 0.6, transition: 'height 0.3s ease',
            }} />
          );
        })}
        <div style={{ marginLeft: 6, alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 3 }}>
          <TIcon size={12} color={tCol} />
          {delta !== null && <span style={{ fontSize: 10, fontWeight: 700, color: tCol }}>{delta > 0 ? '+' : ''}{delta.toFixed(0)}%</span>}
        </div>
      </div>
      {slice.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, color: 'var(--color-text-weak)' }}>{fShort(slice[0]?.checkDate)}</span>
          <span style={{ fontSize: 9, color: 'var(--color-text-weak)' }}>{fShort(slice.at(-1)?.checkDate)}</span>
        </div>
      )}
    </div>
  );
}

/* ── Category icon badge ────────────────────────────────────── */

function CatIcon({ catKey, size = 36 }) {
  const c = CAT[catKey]; if (!c) return null;
  const { Icon } = c;
  return (
    <div style={{ width: size, height: size, borderRadius: 11, flexShrink: 0, backgroundColor: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={Math.round(size * 0.44)} color={c.iconColor} strokeWidth={2} />
    </div>
  );
}

/* ── Status badge ───────────────────────────────────────────── */

function StatusBadge({ status }) {
  const s = STATUS_CFG[status] || STATUS_CFG.PENDING;
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, flexShrink: 0, backgroundColor: s.bg, color: s.text, border: `1px solid ${s.bd}` }}>{s.label}</span>;
}

/* ── Category Card (the status-board tile) ──────────────────── */

function CategoryCard({ catKey, checklist, loading, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const c       = CAT[catKey];
  const rate    = checklist ? pRate(checklist) : null;
  const failed  = checklist ? fails(checklist) : [];
  const preview = failed.slice(0, 3);
  const hasData = !!checklist;

  return (
    <div
      role="button" tabIndex={0}
      onClick={() => hasData && onOpen(catKey, checklist._id)}
      onKeyDown={e => e.key === 'Enter' && hasData && onOpen(catKey, checklist._id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: 'var(--color-surface-raised)',
        border: `1.5px solid ${hovered && hasData ? (checklist?.hasIssues ? 'var(--color-danger-border)' : c.border) : 'var(--color-border)'}`,
        borderRadius: 16, padding: 20,
        cursor: hasData ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        boxShadow: hovered && hasData ? '0 8px 24px rgba(28,25,23,0.10)' : '0 1px 3px rgba(28,25,23,0.06)',
        transform: hovered && hasData ? 'translateY(-2px)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 14,
        outline: 'none', position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Accent strip */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: c.accent, opacity: hasData ? 1 : 0.18, borderRadius: '16px 16px 0 0' }} />

      {/* Row 1: icon + label + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CatIcon catKey={catKey} size={36} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-strong)' }}>{c.label}</div>
            {checklist && <div style={{ fontSize: 11, color: 'var(--color-text-sub)', marginTop: 1 }}>{FREQ[checklist.checklistType] || '—'}</div>}
          </div>
        </div>
        {loading
          ? <Loader2 size={14} color="var(--color-text-weak)" style={{ animation: 'spin 1s linear infinite' }} />
          : checklist
          ? <StatusBadge status={checklist.status} />
          : <span style={{ fontSize: 11, color: 'var(--color-text-weak)', fontStyle: 'italic' }}>No check yet</span>
        }
      </div>

      {/* No data */}
      {!loading && !checklist && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0', gap: 6 }}>
          <ClipboardList size={22} color="var(--color-text-weak)" opacity={0.35} />
          <span style={{ fontSize: 12, color: 'var(--color-text-weak)' }}>No inspection recorded</span>
        </div>
      )}

      {/* Pass rate ring + bar */}
      {hasData && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Ring rate={rate} size={48} sw={4} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ height: 5, backgroundColor: 'var(--color-muted)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${rate}%`, backgroundColor: rColor(rate), borderRadius: 999, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-sub)' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{checklist.passedItems ?? 0}</span> passed
              {' · '}
              {checklist.hasIssues
                ? <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{checklist.failedItems ?? 0} failed</span>
                : <span style={{ color: 'var(--color-text-weak)' }}>0 failed</span>
              }
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--color-text-weak)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={9} /> {fDate(checklist.checkDate)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><User size={9} /> {checklist.submittedBy?.name || '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Hover-reveal: failure preview */}
      {hasData && (
        <div style={{ maxHeight: hovered && checklist?.hasIssues ? 200 : 0, overflow: 'hidden', transition: 'max-height 0.28s ease' }}>
          <div style={{ borderTop: '1px dashed var(--color-danger-border)', paddingTop: 11, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <AlertTriangle size={9} /> Issues Found
            </div>
            {preview.map((fi, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', backgroundColor: 'var(--color-danger-bg)', borderRadius: 7, padding: '6px 9px', border: '1px solid var(--color-danger-border)' }}>
                <XCircle size={11} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-danger)', lineHeight: 1.35 }}>{fi.label}</div>
                  {fi.notes && <div style={{ fontSize: 10, color: 'var(--color-text-sub)', marginTop: 2, fontStyle: 'italic' }}>"{fi.notes}"</div>}
                </div>
              </div>
            ))}
            {failed.length > 3 && <div style={{ fontSize: 10, color: 'var(--color-text-sub)', textAlign: 'center', paddingTop: 2 }}>+{failed.length - 3} more — click to see all</div>}
          </div>
        </div>
      )}

      {/* View affordance */}
      {hasData && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, opacity: hovered ? 1 : 0, transition: 'opacity 0.2s' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.accent, display: 'flex', alignItems: 'center', gap: 3 }}>View Report <ChevronRight size={11} /></span>
        </div>
      )}
    </div>
  );
}

/* ── Report Tab ─────────────────────────────────────────────── */

function ReportTab({ checklist, loading }) {
  const [exp, setExp] = useState({});

  useEffect(() => {
    if (!checklist) return;
    const next = {};
    (checklist.sections || []).forEach(s => { next[s._id || s.sectionKey] = s.items?.some(i => !i.isOk) ?? false; });
    setExp(next);
  }, [checklist?._id]);

  const toggle = k => setExp(p => ({ ...p, [k]: !p[k] }));
  const rate   = checklist ? pRate(checklist) : 0;
  const rcol   = rColor(rate);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 56 }}>
      <Loader2 size={22} color="var(--color-text-weak)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (!checklist) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 56, gap: 8 }}>
      <ClipboardList size={28} color="var(--color-text-weak)" opacity={0.3} />
      <span style={{ fontSize: 13, color: 'var(--color-text-sub)' }}>Select an inspection from History</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Meta bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', backgroundColor: 'var(--color-surface)', borderRadius: 10, border: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-text-sub)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} /> {fDate(checklist.checkDate)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><User size={11} /> {checklist.submittedBy?.name || '—'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {FREQ[checklist.checklistType] || '—'}</span>
        </div>
        <StatusBadge status={checklist.status} />
      </div>

      {/* KPI trio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {[
          { label: 'Total',  val: checklist.totalItems  ?? 0, col: 'var(--color-text-strong)' },
          { label: 'Passed', val: checklist.passedItems ?? 0, col: 'var(--color-success)'     },
          { label: 'Failed', val: checklist.failedItems ?? 0, col: checklist.hasIssues ? 'var(--color-danger)' : 'var(--color-text-weak)' },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.col, lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-sub)', marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Pass rate bar */}
      <div style={{ padding: '10px 13px', backgroundColor: 'var(--color-surface)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-sub)' }}>Pass Rate</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: rcol }}>{rate}%</span>
        </div>
        <div style={{ height: 5, backgroundColor: 'var(--color-muted)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${rate}%`, backgroundColor: rcol, borderRadius: 999, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* Overall notes */}
      {checklist.overallNotes && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 12px' }}>
          <FileText size={12} color="var(--color-text-sub)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 12, color: 'var(--color-text-body)', lineHeight: 1.6, fontStyle: 'italic' }}>"{checklist.overallNotes}"</span>
        </div>
      )}

      {/* Pending warning */}
      {checklist.status === 'PENDING' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 8, padding: '8px 12px' }}>
          <Clock size={12} color="var(--color-warning)" />
          <span style={{ fontSize: 12, color: 'var(--color-warning)', fontWeight: 500 }}>Pending — results not yet submitted.</span>
        </div>
      )}

      {/* Sections */}
      {(checklist.sections || []).map(sec => {
        const key    = sec._id || sec.sectionKey;
        const failed = (sec.items || []).filter(i => !i.isOk);
        const passed = (sec.items || []).filter(i => i.isOk);
        const open   = exp[key] !== false;
        const hasFail = failed.length > 0;

        return (
          <div key={key} style={{ backgroundColor: 'var(--color-surface-raised)', border: `1px solid ${hasFail ? 'var(--color-danger-border)' : 'var(--color-border)'}`, borderRadius: 10, overflow: 'hidden' }}>
            <button onClick={() => toggle(key)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', backgroundColor: hasFail ? 'rgba(153,27,27,0.03)' : 'var(--color-surface)', border: 'none', cursor: 'pointer', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                {hasFail ? <AlertTriangle size={12} color="var(--color-danger)" style={{ flexShrink: 0 }} /> : <CheckCircle2 size={12} color="var(--color-success)" style={{ flexShrink: 0 }} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-strong)', textAlign: 'left' }}>{sec.sectionLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                {hasFail && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: 20, padding: '1px 7px' }}>
                    {failed.length} issue{failed.length > 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ fontSize: 10, color: 'var(--color-text-weak)' }}>{passed.length}/{sec.items?.length ?? 0}</span>
                {open ? <ChevronUp size={11} color="var(--color-text-sub)" /> : <ChevronDown size={11} color="var(--color-text-sub)" />}
              </div>
            </button>

            {open && (
              <div style={{ padding: '6px 13px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {failed.map((it, i) => (
                  <div key={`f${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
                    <XCircle size={12} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-danger)', lineHeight: 1.4 }}>
                        {it.label}
                        {it.quantity != null && <span style={{ fontSize: 10, color: 'var(--color-text-sub)', marginLeft: 5, fontWeight: 400 }}>({it.quantity})</span>}
                      </div>
                      {it.notes && <div style={{ fontSize: 11, color: 'var(--color-text-sub)', marginTop: 4, fontStyle: 'italic', lineHeight: 1.5, backgroundColor: 'rgba(153,27,27,0.06)', borderRadius: 4, padding: '3px 6px' }}>"{it.notes}"</div>}
                      {it.linkedMaintenanceId && (
                        <div style={{ marginTop: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid var(--color-info-border)', borderRadius: 20 }}>Repair task created</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {passed.map((it, i) => (
                  <div key={`p${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 10px', borderRadius: 6 }}>
                    <CheckCircle2 size={11} color="var(--color-success)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--color-text-sub)', lineHeight: 1.4 }}>
                      {it.label}
                      {it.quantity != null && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>({it.quantity})</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* All-clear */}
      {!checklist.hasIssues && checklist.status === 'COMPLETED' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 10, backgroundColor: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)' }}>
          <CheckCircle2 size={18} color="var(--color-success)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>All clear</div>
            <div style={{ fontSize: 11, color: 'var(--color-success)', opacity: 0.75, marginTop: 1 }}>Every item passed in this inspection.</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── History Tab ────────────────────────────────────────────── */

function HistoryTab({ catKey, propertyId, activeCL, onViewReport }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page,    setPage]    = useState(1);
  const PAGE = 15;

  const fetch = useCallback(async (pg = 1) => {
    if (!catKey) return;
    setLoading(true);
    try {
      const params = { category: catKey, limit: PAGE, page: pg, ...(propertyId ? { propertyId } : {}) };
      const res    = await api.get('/api/checklists', { params });
      const data   = res.data?.data || [];
      setHistory(pg === 1 ? data : prev => [...prev, ...data]);
      setHasMore(data.length === PAGE);
      setPage(pg);
    } catch { toast.error('Failed to load history'); }
    finally  { setLoading(false); }
  }, [catKey, propertyId]);

  useEffect(() => { fetch(1); }, [fetch]);

  if (loading && history.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 56 }}>
      <Loader2 size={22} color="var(--color-text-weak)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );
  if (!loading && history.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 56, gap: 8 }}>
      <History size={28} color="var(--color-text-weak)" opacity={0.3} />
      <span style={{ fontSize: 13, color: 'var(--color-text-sub)' }}>No history found</span>
    </div>
  );

  const c = CAT[catKey] || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Sparkline */}
      {history.length > 1 && (
        <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-sub)', marginBottom: 8, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Pass Rate — Last {Math.min(history.length, 10)} Checks
          </div>
          <Sparkline history={history} max={10} />
        </div>
      )}

      {/* History rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {history.map((cl, i) => {
          const r         = pRate(cl);
          const failCount = cl.failedItems || 0;
          const isActive  = activeCL?._id === cl._id;

          return (
            <div key={cl._id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${isActive ? 'var(--color-accent-mid)' : 'var(--color-border)'}`,
              backgroundColor: isActive ? 'var(--color-accent-light)' : 'var(--color-surface-raised)',
              transition: 'all 0.15s',
            }}>
              {/* Rank badge */}
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                backgroundColor: i === 0 ? c.bg : 'var(--color-muted)',
                border: `1px solid ${i === 0 ? c.border : 'var(--color-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700,
                color: i === 0 ? c.iconColor : 'var(--color-text-weak)',
              }}>{i + 1}</div>

              {/* Date + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-strong)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {fDate(cl.checkDate)}
                  {i === 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: c.bg, color: c.iconColor, border: `1px solid ${c.border}` }}>Latest</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-sub)', marginTop: 2, display: 'flex', gap: 7 }}>
                  <span>{cl.submittedBy?.name || '—'}</span>
                  {failCount > 0
                    ? <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{failCount} issue{failCount > 1 ? 's' : ''}</span>
                    : cl.status === 'COMPLETED' && <span style={{ color: 'var(--color-success)' }}>All clear</span>
                  }
                </div>
              </div>

              {/* Mini ring */}
              <Ring rate={r} size={30} sw={2.5} />

              {/* View button */}
              <button
                onClick={() => onViewReport(cl._id)}
                style={{
                  height: 28, padding: '0 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, flexShrink: 0,
                  backgroundColor: isActive ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: isActive ? '#fff' : 'var(--color-text-sub)',
                  border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {isActive ? 'Viewing' : 'View'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <button onClick={() => fetch(page + 1)} disabled={loading} style={{ width: '100%', height: 34, borderRadius: 8, fontSize: 12, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-sub)', cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {loading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />} Load more
        </button>
      )}
    </div>
  );
}

/* ── The Drawer ─────────────────────────────────────────────── */

function Drawer({ open, onClose, catKey, latestId, propertyId }) {
  const [tab,          setTab]     = useState('report');
  const [activeCL,     setActive]  = useState(null);
  const [reportLoading, setRLoad]  = useState(false);
  const c = CAT[catKey] || {};

  useEffect(() => {
    if (open && latestId) { setTab('report'); loadReport(latestId); }
    if (!open) setActive(null);
  }, [open, latestId]);

  const loadReport = useCallback(async id => {
    if (!id) return;
    setRLoad(true); setTab('report');
    try {
      const res = await api.get(`/api/checklists/${id}`);
      setActive(res.data?.data || null);
    } catch { toast.error('Failed to load report'); }
    finally { setRLoad(false); }
  }, []);

  const isLatest = activeCL?._id === latestId;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" style={{ width: 500, maxWidth: '95vw', backgroundColor: 'var(--color-bg)', borderLeft: '1px solid var(--color-border)', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', backgroundColor: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <CatIcon catKey={catKey} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-strong)' }}>{c.label} Inspection</div>
              {activeCL && !isLatest
                ? <div style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 500, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> Viewing historical record</div>
                : activeCL && <div style={{ fontSize: 11, color: 'var(--color-text-sub)', marginTop: 2 }}>Most recent inspection</div>
              }
            </div>
            {activeCL && !isLatest && (
              <button onClick={() => loadReport(latestId)} style={{ height: 28, padding: '0 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)', border: '1px solid var(--color-accent-mid)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <ArrowLeft size={11} /> Latest
              </button>
            )}
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 2, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3 }}>
            {[{ key: 'report', label: 'Report', Icon: BarChart2 }, { key: 'history', label: 'History', Icon: History }].map(t => {
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, height: 30, borderRadius: 8, fontSize: 12, fontWeight: 600, backgroundColor: active ? 'var(--color-surface-raised)' : 'transparent', color: active ? 'var(--color-text-strong)' : 'var(--color-text-sub)', border: active ? '1px solid var(--color-border)' : '1px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, boxShadow: active ? 'var(--shadow-card)' : 'none', transition: 'all 0.15s' }}>
                  <t.Icon size={12} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 28px' }}>
          {tab === 'report'  && <ReportTab  checklist={activeCL} loading={reportLoading} />}
          {tab === 'history' && <HistoryTab catKey={catKey} propertyId={propertyId} activeCL={activeCL} onViewReport={loadReport} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Create Dialog ──────────────────────────────────────────── */

function CreateDialog({ open, onOpenChange, properties, defaultCat, onCreated }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ propertyId: '', blockId: '', category: defaultCat || 'ELECTRICAL', checklistType: 'DAILY', checkDate: new Date().toISOString().slice(0, 10) });
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => { if (defaultCat) setF('category', defaultCat); }, [defaultCat]);

  const prop   = properties.find(p => p._id === form.propertyId);
  const blocks = prop?.blocks || [];

  const submit = async () => {
    if (!form.propertyId || !form.checkDate) { toast.error('Property and date are required'); return; }
    setLoading(true);
    try {
      await api.post('/api/checklists/create', { propertyId: form.propertyId, blockId: form.blockId || undefined, category: form.category, checklistType: form.checklistType, checkDate: new Date(form.checkDate).toISOString() });
      toast.success('Checklist created'); onOpenChange(false); onCreated?.();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to create checklist'); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-strong)' }}>New Inspection Checklist</DialogTitle>
          <p style={{ fontSize: 13, color: 'var(--color-text-sub)', marginTop: 4 }}>Seeds from the built-in template for the selected category.</p>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
          <div>
            <Label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-strong)' }}>Property *</Label>
            <Select value={form.propertyId} onValueChange={v => setF('propertyId', v)}>
              <SelectTrigger className="mt-1.5 bg-surface-raised border-muted-fill"><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>{properties.map(p => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {blocks.length > 0 && (
            <div>
              <Label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-strong)' }}>Block</Label>
              <Select value={form.blockId} onValueChange={v => setF('blockId', v)}>
                <SelectTrigger className="mt-1.5 bg-surface-raised border-muted-fill"><SelectValue placeholder="All blocks (optional)" /></SelectTrigger>
                <SelectContent>{blocks.map(b => <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <Label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-strong)' }}>Category *</Label>
              <Select value={form.category} onValueChange={v => setF('category', v)}>
                <SelectTrigger className="mt-1.5 bg-surface-raised border-muted-fill"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-strong)' }}>Frequency</Label>
              <Select value={form.checklistType} onValueChange={v => setF('checklistType', v)}>
                <SelectTrigger className="mt-1.5 bg-surface-raised border-muted-fill"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FREQ).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-strong)' }}>Check Date *</Label>
            <Input type="date" value={form.checkDate} onChange={e => setF('checkDate', e.target.value)} className="mt-1.5 bg-surface-raised border-muted-fill" />
          </div>
        </div>

        <DialogFooter style={{ gap: 8, marginTop: 8 }}>
          <DialogClose asChild><Button variant="outline" style={{ fontSize: 13 }}>Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={loading} style={{ backgroundColor: 'var(--color-accent)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none' }}>
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create Checklist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Overview KPI bar ───────────────────────────────────────── */

function OverviewBar({ cards }) {
  const populated = cards.filter(c => c.checklist);
  const issues    = populated.filter(c => c.checklist.hasIssues).length;
  const avgRate   = populated.length ? Math.round(populated.reduce((s, c) => s + pRate(c.checklist), 0) / populated.length) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
      {[
        { label: 'Systems Checked', value: `${populated.length} / ${CATEGORIES.length}`, sub: `${CATEGORIES.length - populated.length} not yet recorded`, Icon: ClipboardList, vc: 'var(--color-text-strong)' },
        { label: 'Areas With Issues', value: issues, sub: issues === 0 ? 'All systems clear ✓' : `${issues} need attention`, Icon: AlertTriangle, vc: issues > 0 ? 'var(--color-danger)' : 'var(--color-success)' },
        { label: 'Avg Pass Rate', value: populated.length ? `${avgRate}%` : '—', sub: 'Across recorded systems', Icon: Shield, vc: avgRate === 100 ? 'var(--color-success)' : avgRate >= 70 ? 'var(--color-warning)' : 'var(--color-danger)' },
      ].map(k => (
        <div key={k.label} style={{ backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 3px rgba(28,25,23,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-sub)', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: k.vc, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-sub)', marginTop: 5 }}>{k.sub}</div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.Icon size={14} color="var(--color-text-sub)" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */

export default function DailyChecks() {
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('ALL');
  const [cards,      setCards]      = useState(CATEGORIES.map(c => ({ catKey: c.key, checklist: null, loading: true })));

  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [drawerCat,   setDrawerCat]   = useState(null);
  const [drawerLatest, setDrawerLatest] = useState(null);
  const [createOpen,  setCreateOpen]  = useState(false);

  // Load properties
  useEffect(() => {
    (async () => {
      try { const r = await api.get('/api/property/get-property'); setProperties(r.data?.property || []); }
      catch { /* silent */ }
    })();
  }, []);

  // Fetch latest check per category — parallel
  const refresh = useCallback(async () => {
    setCards(CATEGORIES.map(c => ({ catKey: c.key, checklist: null, loading: true })));
    const results = await Promise.allSettled(
      CATEGORIES.map(cat => api.get('/api/checklists', { params: { category: cat.key, limit: 1, page: 1, ...(propertyId && propertyId !== 'ALL' ? { propertyId } : {}) } }))
    );
    setCards(CATEGORIES.map((cat, i) => {
      const r = results[i];
      return { catKey: cat.key, checklist: r.status === 'fulfilled' ? (r.value?.data?.data?.[0] || null) : null, loading: false };
    }));
  }, [propertyId]);

  useEffect(() => { refresh(); }, [refresh]);

  const openDrawer = (catKey, id) => { setDrawerCat(catKey); setDrawerLatest(id); setDrawerOpen(true); };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', padding: '28px 32px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-strong)', margin: 0 }}>Daily Checks</h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-sub)', marginTop: 5, margin: '5px 0 0' }}>
              One card per system — hover to preview issues, click for full report and history.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger style={{ height: 36, width: 200, fontSize: 13, backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', borderRadius: 10 }}>
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Properties</SelectItem>
                {properties.map(p => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <button onClick={refresh} style={{ height: 36, padding: '0 14px', borderRadius: 10, fontSize: 13, backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={() => setCreateOpen(true)} style={{ height: 36, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> New Checklist
            </button>
          </div>
        </div>

        {/* KPI bar */}
        <OverviewBar cards={cards} />

        {/* Status board grid — 7 fixed cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
          {cards.map(({ catKey, checklist, loading }) => (
            <CategoryCard key={catKey} catKey={catKey} checklist={checklist} loading={loading} onOpen={openDrawer} />
          ))}
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} catKey={drawerCat} latestId={drawerLatest} propertyId={propertyId} />

      <CreateDialog open={createOpen} onOpenChange={setCreateOpen} properties={properties} defaultCat={null} onCreated={refresh} />
    </>
  );
}