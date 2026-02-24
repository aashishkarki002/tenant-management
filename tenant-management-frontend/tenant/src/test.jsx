import { useState, useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Cell, PieChart, Pie, ComposedChart, Area, CartesianGrid, Legend,
    Line,
} from "recharts";
import {
    TrendingUp, TrendingDown, AlertCircle, FileText, History,
    CheckCircle, Clock, User, Circle, ReceiptText, Plus, Building2,
    Banknote, ArrowUpRight, ArrowDownRight, GitCompare, Wallet,
    BarChart2, Download, ChevronLeft, ChevronRight, ExternalLink,
    Info, ShieldAlert,
} from "lucide-react";

// ─── DUMMY DATA ────────────────────────────────────────────────────────────────

const revenueByMonth = [
    { name: "Bai", month: 1, revenue: 142000, expenses: 68000, revenueLastYear: 118000 },
    { name: "Jes", month: 2, revenue: 158000, expenses: 71000, revenueLastYear: 131000 },
    { name: "Ash", month: 3, revenue: 134000, expenses: 82000, revenueLastYear: 125000 },
    { name: "Shr", month: 4, revenue: 171000, expenses: 65000, revenueLastYear: 148000 },
    { name: "Bha", month: 5, revenue: 189000, expenses: 79000, revenueLastYear: 162000 },
    { name: "Asw", month: 6, revenue: 203000, expenses: 88000, revenueLastYear: 179000 },
    { name: "Kar", month: 7, revenue: 0, expenses: 0, revenueLastYear: 190000 },
    { name: "Man", month: 8, revenue: 0, expenses: 0, revenueLastYear: 195000 },
    { name: "Pou", month: 9, revenue: 0, expenses: 0, revenueLastYear: 188000 },
    { name: "Mag", month: 10, revenue: 0, expenses: 0, revenueLastYear: 176000 },
    { name: "Fal", month: 11, revenue: 0, expenses: 0, revenueLastYear: 182000 },
    { name: "Cha", month: 12, revenue: 0, expenses: 0, revenueLastYear: 197000 },
];

// ① Period-toggle collection data
const collectionByPeriod = {
    thisMonth: {
        totalCollected: 203000, target: 248000, outstandingBalance: 45000,
        breakdown: [
            { label: "Rent", amount: 156000, color: "#9a3412" },
            { label: "CAM", amount: 32000, color: "#ea580c" },
            { label: "Electricity", amount: 11000, color: "#fb923c" },
            { label: "Other", amount: 4000, color: "#fed7aa" },
        ],
    },
    allTime: {
        totalCollected: 997000, target: 1240000, outstandingBalance: 243000,
        breakdown: [
            { label: "Rent", amount: 720000, color: "#9a3412" },
            { label: "CAM", amount: 156000, color: "#ea580c" },
            { label: "Electricity", amount: 78000, color: "#fb923c" },
            { label: "Other", amount: 43000, color: "#fed7aa" },
        ],
    },
};

// ③ Full overdue list
const overdueRents = [
    { id: "o1", tenant: "Sanjay Koirala", room: "Room 201", amount: 18500, dueDays: 12 },
    { id: "o2", tenant: "Mina Rai", room: "Room 114", amount: 16000, dueDays: 8 },
    { id: "o3", tenant: "Bikash Tamang", room: "Room 308", amount: 22000, dueDays: 5 },
    { id: "o4", tenant: "Rekha Shrestha", room: "Room 407", amount: 19500, dueDays: 2 },
];

// ④ P&L this month
const plThisMonth = {
    revenue: 203000, expenses: 88000, net: 115000,
    revenueItems: [
        { label: "Rent", amount: 156000 }, { label: "CAM", amount: 32000 },
        { label: "Electricity", amount: 11000 }, { label: "Other", amount: 4000 },
    ],
    expenseItems: [
        { label: "Maintenance", amount: 38000 }, { label: "Utilities", amount: 22000 },
        { label: "Staff", amount: 20000 }, { label: "Admin", amount: 8000 },
    ],
};

const recentActivities = [
    { id: 1, type: "payment", mainText: "Rent received · Rajan Sharma", details: "Room 301 · 2nd floor", amount: 18500, time: new Date(Date.now() - 3600000) },
    { id: 2, type: "expense", mainText: "Plumbing repair · Block B", details: "Maintenance logged", amount: 4200, time: new Date(Date.now() - 7200000) },
    { id: 3, type: "revenue", mainText: "CAM charges collected", details: "Common area maintenance", amount: 12000, time: new Date(Date.now() - 14400000) },
    { id: 4, type: "maintenance", mainText: "Lift servicing scheduled", details: "Annual contract · Elevator Co.", amount: null, time: new Date(Date.now() - 86400000) },
    { id: 5, type: "rent", mainText: "Upcoming: Priya Thapa", details: "Due in 3 days · Room 204", amount: 16000, time: new Date(Date.now() - 172800000) },
    { id: 6, type: "payment", mainText: "Advance deposit received", details: "New tenant · Room 108", amount: 35000, time: new Date(Date.now() - 259200000) },
];

const summaryStats = {
    occupancy: { rate: 87, occupied: 28, totalUnits: 32, vacant: 4 },
    openRequests: 3, activeTenants: 28,
};

const accountingTotals = { totalRevenue: 997000, totalExpenses: 453000, netCashFlow: 544000 };
const revenueBreakdown = [
    { name: "Rent", code: "RENT", amount: 720000 },
    { name: "CAM Charges", code: "CAM", amount: 156000 },
    { name: "Electricity", code: "ELEC", amount: 78000 },
    { name: "Parking", code: "PARK", amount: 43000 },
];
const expenseBreakdown = [
    { name: "Maintenance & Repair", code: "MNT", amount: 182000 },
    { name: "Utilities", code: "UTIL", amount: 97000 },
    { name: "Staff Salary", code: "SAL", amount: 124000 },
    { name: "Admin & Misc", code: "ADM", amount: 50000 },
];
const ledgerEntries = [
    { _id: "l1", date: "2024-10-07", description: "Advance deposit · Room 108", debit: null, credit: 35000, runningBalance: 1031100 },
    { _id: "l2", date: "2024-10-06", description: "Staff salary · Security", debit: 15000, credit: null, runningBalance: 996100 },
    { _id: "l3", date: "2024-10-05", description: "Rent · Priya Thapa (204)", debit: null, credit: 16000, runningBalance: 1011100 },
    { _id: "l4", date: "2024-10-04", description: "Electricity bill payment", debit: 9700, credit: null, runningBalance: 995100 },
    { _id: "l5", date: "2024-10-03", description: "CAM charges · Oct", debit: null, credit: 12000, runningBalance: 1004800 },
    { _id: "l6", date: "2024-10-02", description: "Plumbing repair · Block B", debit: 4200, credit: null, runningBalance: 992800 },
    { _id: "l7", date: "2024-10-01", description: "Rent · Rajan Sharma (301)", debit: null, credit: 18500, runningBalance: 997000 },
    { _id: "l8", date: "2024-09-30", description: "Lift servicing", debit: 8500, credit: null, runningBalance: 996100 },
    { _id: "l9", date: "2024-09-29", description: "Rent · Bikash Tamang (308)", debit: null, credit: 22000, runningBalance: 1004600 },
    { _id: "l10", date: "2024-09-28", description: "Internet & telecom", debit: 3200, credit: null, runningBalance: 982600 },
];
const quarterlyCompare = {
    revenue: { a: 874000, b: 997000, pct: 14.1 },
    expenses: { a: 398000, b: 453000, pct: 13.8 },
    netCashFlow: { a: 476000, b: 544000, pct: 14.3 },
};
const QUARTER_MONTHS = { 1: ["Shr", "Bha", "Asw"], 2: ["Kar", "Man", "Pou"], 3: ["Mag", "Fal", "Cha"], 4: ["Bai", "Jes", "Ash"] };

// ─── PRIMITIVES ────────────────────────────────────────────────────────────────

const COLORS = ["#9a3412", "#c2410c", "#ea580c", "#fb923c", "#fdba74", "#fed7aa"];
const ICON_MAP = { payment: CheckCircle, rent: CheckCircle, maintenance: Clock, tenant: User, revenue: TrendingUp, expense: TrendingDown, default: Circle };
const COLOR_MAP = { payment: "bg-green-500", rent: "bg-emerald-500", maintenance: "bg-blue-500", tenant: "bg-orange-500", revenue: "bg-violet-500", expense: "bg-red-400", default: "bg-gray-400" };
const BADGE_MAP = { payment: "bg-green-100 text-green-700", rent: "bg-emerald-100 text-emerald-700", maintenance: "bg-blue-100 text-blue-700", revenue: "bg-violet-100 text-violet-700", expense: "bg-red-100 text-red-700", default: "bg-gray-100 text-gray-500" };
const LABEL_MAP = { payment: "Payment", rent: "Rent", maintenance: "Maintenance", revenue: "Revenue", expense: "Expense", default: "Activity" };

function fmt(n) { return `₹${Number(n).toLocaleString("en-IN")}`; }
function fmtK(n) { return `₹${(n / 1000).toFixed(0)}k`; }
function relTime(date) {
    const d = Math.floor((Date.now() - new Date(date)) / 60000);
    if (d < 1) return "Just now"; if (d < 60) return `${d}m ago`;
    if (d < 1440) return `${Math.floor(d / 60)}h ago`; return `${Math.floor(d / 1440)}d ago`;
}

function Card({ children, className = "" }) {
    return <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>{children}</div>;
}
function Bdg({ children, className = "" }) {
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>{children}</span>;
}
function Pill({ label, active, onClick }) {
    return (
        <button onClick={onClick} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${active ? "bg-orange-900 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {label}
        </button>
    );
}
function SLabel({ children }) {
    return <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{children}</p>;
}
function InfoNote({ text }) {
    return (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-50">
            <Info className="w-3 h-3 text-gray-300 shrink-0" />
            <p className="text-[10px] text-gray-400" dangerouslySetInnerHTML={{ __html: text }} />
        </div>
    );
}

// ─── DASHBOARD CARDS ───────────────────────────────────────────────────────────

// ① ② Collection card — period toggle + Rent/CAM/Other breakdown
function CollectionCard({ onNavigate }) {
    const [period, setPeriod] = useState("thisMonth");
    const data = collectionByPeriod[period];
    const pct = Math.min(100, (data.totalCollected / data.target) * 100);
    const tot = data.breakdown.reduce((s, b) => s + b.amount, 0);

    return (
        <Card className="border-l-4 border-l-orange-800 p-5 sm:col-span-2">
            <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-orange-100"><Wallet className="w-4 h-4 text-orange-800" /></div>
                    {/* ① Toggle */}
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        {[{ id: "thisMonth", label: "This Month" }, { id: "allTime", label: "All Time" }].map(o => (
                            <button key={o.id} onClick={() => setPeriod(o.id)}
                                className={`px-2.5 py-1 text-xs font-bold transition-colors ${period === o.id ? "bg-orange-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
                {/* ⑦ Drill-down */}
                <button onClick={() => onNavigate("accounting")} className="flex items-center gap-1 text-xs text-orange-700 hover:text-orange-900 font-bold">
                    View Details <ExternalLink className="w-3 h-3" />
                </button>
            </div>

            <p className="text-2xl font-black tabular-nums text-gray-900">{fmtK(data.totalCollected)}</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
                of {fmtK(data.target)} target
                <span className="ml-2 text-orange-700 font-bold">{pct.toFixed(0)}% collected</span>
            </p>

            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-800 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>

            {/* ② Breakdown */}
            <div className="mt-4">
                <SLabel>Collection breakdown — Rent · CAM · Other</SLabel>
                <div className="flex gap-0.5 h-2 rounded-full overflow-hidden mb-3">
                    {data.breakdown.map(b => (
                        <div key={b.label} className="h-full" style={{ flex: b.amount, backgroundColor: b.color }} />
                    ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {data.breakdown.map(b => (
                        <div key={b.label} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-700 truncate">{b.label}</p>
                                <p className="text-[11px] text-gray-400">{((b.amount / tot) * 100).toFixed(0)}% · {fmtK(b.amount)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {/* ⑥ */}
            <InfoNote text='<b class="text-gray-500">Collection</b> = rent/CAM payments received. See Accounting for full ledger Revenue.' />
        </Card>
    );
}

// ③ Overdue card — full list, expandable
function OverdueCard({ onNavigate }) {
    const [expanded, setExpanded] = useState(false);
    const total = overdueRents.reduce((s, r) => s + r.amount, 0);
    const shown = expanded ? overdueRents : overdueRents.slice(0, 2);

    return (
        <Card className="border-l-4 border-l-rose-500 p-5">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-rose-100"><ShieldAlert className="w-4 h-4 text-rose-600" /></div>
                    <Bdg className="bg-rose-100 text-rose-700">{overdueRents.length} overdue</Bdg>
                </div>
                <button onClick={() => onNavigate("accounting")} className="flex items-center gap-1 text-xs text-rose-700 hover:text-rose-900 font-bold">
                    View all <ExternalLink className="w-3 h-3" />
                </button>
            </div>
            <p className="text-2xl font-black tabular-nums text-rose-700">{fmtK(total)}</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">Total overdue balance</p>

            <div className="mt-4 space-y-2">
                <SLabel>Overdue Tenants</SLabel>
                {shown.map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{r.tenant}</p>
                            <p className="text-xs text-gray-400">{r.room} · <span className="text-rose-500 font-semibold">{r.dueDays}d overdue</span></p>
                        </div>
                        <span className="text-sm font-bold text-rose-600 tabular-nums shrink-0 ml-2">{fmt(r.amount)}</span>
                    </div>
                ))}
                {overdueRents.length > 2 && (
                    <button onClick={() => setExpanded(p => !p)} className="text-xs font-bold text-gray-400 hover:text-gray-600 pt-1">
                        {expanded ? "Show less" : `+${overdueRents.length - 2} more tenants`}
                    </button>
                )}
            </div>
        </Card>
    );
}

// Occupancy card
function OccupancyCard() {
    const s = summaryStats.occupancy;
    return (
        <Card className="border-l-4 border-l-emerald-500 p-5">
            <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-emerald-100"><Building2 className="w-4 h-4 text-emerald-700" /></div>
                <Bdg className="bg-emerald-100 text-emerald-700">{s.vacant} vacant</Bdg>
            </div>
            <p className="text-2xl font-black tabular-nums text-gray-900">{s.rate}%</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">{s.occupied} of {s.totalUnits} units occupied</p>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.rate}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
                {[{ label: "Total", val: s.totalUnits, c: "text-gray-800" }, { label: "Occupied", val: s.occupied, c: "text-emerald-700" }, { label: "Vacant", val: s.vacant, c: "text-orange-700" }].map(x => (
                    <div key={x.label} className="text-center">
                        <p className={`text-lg font-black tabular-nums ${x.c}`}>{x.val}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{x.label}</p>
                    </div>
                ))}
            </div>
        </Card>
    );
}

// ④ P&L mini card
function PLHintCard() {
    const margin = ((plThisMonth.net / plThisMonth.revenue) * 100).toFixed(1);
    return (
        <Card className="border-l-4 border-l-violet-500 p-5">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-violet-100"><BarChart2 className="w-4 h-4 text-violet-700" /></div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">This Month P&amp;L</span>
                </div>
                <Bdg className="bg-emerald-100 text-emerald-700">
                    <TrendingUp className="w-3 h-3 mr-1" />{margin}% margin
                </Bdg>
            </div>

            {/* Mini bar visualization */}
            <div className="flex gap-2 items-end mb-4 h-14">
                {[
                    { label: "Revenue", val: plThisMonth.revenue, color: "bg-emerald-400" },
                    { label: "Expenses", val: plThisMonth.expenses, color: "bg-rose-400" },
                    { label: "Net", val: plThisMonth.net, color: "bg-violet-500" },
                ].map(b => {
                    const h = Math.round((b.val / plThisMonth.revenue) * 100);
                    return (
                        <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                            <p className="text-[10px] font-bold text-gray-500">{fmtK(b.val)}</p>
                            <div className="w-full flex flex-col justify-end bg-gray-100 rounded-t-sm" style={{ height: "36px" }}>
                                <div className={`w-full ${b.color} rounded-t-sm`} style={{ height: `${h}%` }} />
                            </div>
                            <p className="text-[9px] text-gray-400 font-medium">{b.label}</p>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {[{ title: "Revenue", items: plThisMonth.revenueItems }, { title: "Expenses", items: plThisMonth.expenseItems }].map(col => (
                    <div key={col.title}>
                        <SLabel>{col.title}</SLabel>
                        {col.items.map(x => (
                            <div key={x.label} className="flex justify-between text-xs py-0.5">
                                <span className="text-gray-500">{x.label}</span>
                                <span className="font-semibold text-gray-700">{fmtK(x.amount)}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            {/* ⑥ */}
            <InfoNote text='<b class="text-gray-500">Revenue</b> here may include ledger entries beyond collected payments.' />
        </Card>
    );
}

// ⑤ Revenue bar chart — YoY tooltip + fiscal quarter filter + ⑦ export link
function RevenueBarChart({ onNavigate }) {
    const [period, setPeriod] = useState("thisYear");
    const [qView, setQView] = useState(null);
    const CURRENT_MONTH = 6;

    const data = useMemo(() => {
        const base = revenueByMonth.map(d => ({
            ...d,
            rev: period === "thisYear" ? d.revenue : d.revenueLastYear,
            revY: period === "thisYear" ? d.revenueLastYear : d.revenue,
        }));
        if (!qView) return base;
        return base.filter(d => QUARTER_MONTHS[qView].includes(d.name));
    }, [period, qView]);

    const totalRev = data.reduce((s, d) => s + d.rev, 0);
    const filled = data.filter(d => d.rev > 0).length;

    return (
        <Card className="overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-5 pb-3">
                <div>
                    <h3 className="text-base font-semibold text-gray-900">Revenue Trend</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {fmt(totalRev)} across {filled} months
                        {qView && <span className="ml-1 text-orange-700 font-bold">· Q{qView}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap self-start">
                    {/* ⑦ Accounting report link */}
                    <button onClick={() => onNavigate("accounting")} className="flex items-center gap-1 text-xs font-bold text-orange-700 hover:text-orange-900 border border-orange-200 rounded-md px-2.5 py-1.5 bg-orange-50 transition-colors">
                        <ExternalLink className="w-3 h-3" /> Accounting Report
                    </button>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        {["thisYear", "lastYear"].map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-xs font-bold transition-colors ${period === p ? "bg-orange-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                                {p === "thisYear" ? "This Year" : "Last Year"}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ⑤ Quarter quick-filter */}
            <div className="flex items-center gap-2 px-5 mb-3 flex-wrap">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quarter:</span>
                {[{ label: "All", v: null }, { label: "Q1·Shr-Asw", v: 1 }, { label: "Q2·Kar-Pou", v: 2 }, { label: "Q3·Mag-Cha", v: 3 }, { label: "Q4·Bai-Ash", v: 4 }].map(q => (
                    <button key={String(q.v)} onClick={() => setQView(q.v)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${qView === q.v ? "bg-orange-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                        {q.label}
                    </button>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 mb-2 text-xs text-gray-400 flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-orange-800" />Current month</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-slate-300" />Other months</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block border border-dashed border-gray-300" />No data</span>
                <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 inline-block bg-blue-400 opacity-70 align-middle" />Last year (line)</span>
            </div>

            <div className="h-64 px-2 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 4 }} barCategoryGap="22%">
                        <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0}
                            tick={({ x, y, payload }) => {
                                const pt = data.find(d => d.name === payload.value);
                                const hi = pt?.month === CURRENT_MONTH && period === "thisYear";
                                const empty = !pt?.rev;
                                return (
                                    <g transform={`translate(${x},${y})`}>
                                        <text x={0} y={0} dy={14} textAnchor="middle"
                                            fill={hi ? "#9a3412" : empty ? "#cbd5e1" : "#64748b"} fontSize={10} fontWeight={hi ? 700 : 400}>
                                            {payload.value}
                                        </text>
                                    </g>
                                );
                            }}
                        />
                        <YAxis hide />
                        {/* ⑤ YoY comparison line */}
                        <Line type="monotone" dataKey="revY" stroke="#93c5fd" strokeWidth={1.5}
                            dot={false} strokeDasharray="4 2" name="Last Year" />
                        <Tooltip
                            cursor={{ fill: "#f8fafc", radius: 4 }}
                            content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const pt = data.find(d => d.name === label);
                                const cur = pt?.rev ?? 0, prev = pt?.revY ?? 0;
                                const diff = cur - prev, pct = prev ? ((diff / prev) * 100).toFixed(1) : null;
                                return (
                                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2.5 text-sm min-w-[170px]">
                                        <p className="font-bold text-gray-800 mb-2">{label}</p>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between gap-4">
                                                <span className="text-gray-400 text-xs">{period === "thisYear" ? "This year" : "Last year"}</span>
                                                <span className="font-bold text-orange-800 text-xs">{cur ? fmt(cur) : "No data"}</span>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <span className="text-gray-400 text-xs">{period === "thisYear" ? "Last year" : "This year"}</span>
                                                <span className="font-semibold text-blue-400 text-xs">{prev ? fmt(prev) : "—"}</span>
                                            </div>
                                            {/* ⑤ YoY delta */}
                                            {pct && cur && (
                                                <div className={`flex items-center gap-1 pt-1.5 border-t border-gray-100 text-xs font-bold ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                    {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    {Math.abs(pct)}% YoY {diff >= 0 ? "increase" : "decrease"}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }}
                        />
                        <Bar dataKey="rev" radius={[4, 4, 0, 0]} maxBarSize={40} minPointSize={3}>
                            {data.map((e, i) => (
                                <Cell key={i}
                                    fill={!e.rev ? "#f1f5f9" : e.month === CURRENT_MONTH && period === "thisYear" ? "#9a3412" : "#cbd5e1"}
                                    stroke={!e.rev ? "#e2e8f0" : "none"} strokeWidth={!e.rev ? 1 : 0} />
                            ))}
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

function RecentTransactions() {
    return (
        <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3">
                <h3 className="text-base font-semibold text-gray-900">Recent Transactions</h3>
                <button className="text-xs font-bold text-orange-700 hover:text-orange-900 uppercase tracking-wide">View All</button>
            </div>
            <div className="px-5 pb-5">
                <div className="relative">
                    <div className="absolute left-[13px] top-2 bottom-2 w-px bg-gray-100" />
                    <div className="space-y-5">
                        {recentActivities.map(a => {
                            const Icon = ICON_MAP[a.type] ?? ICON_MAP.default;
                            return (
                                <div key={a.id} className="relative flex items-start gap-3">
                                    <div className={`relative z-10 ${COLOR_MAP[a.type] ?? COLOR_MAP.default} rounded-full p-1.5 shrink-0 shadow-sm ring-2 ring-white mt-0.5`}>
                                        <Icon className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0 pb-1">
                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                            <p className="text-sm font-medium text-gray-900 truncate">{a.mainText}</p>
                                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${BADGE_MAP[a.type] ?? BADGE_MAP.default}`}>
                                                {LABEL_MAP[a.type] ?? LABEL_MAP.default}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400">{a.details} · {relTime(a.time)}</p>
                                    </div>
                                    {a.amount != null && (
                                        <span className="text-xs font-semibold text-gray-700 tabular-nums mt-0.5 shrink-0">Rs.&nbsp;{Number(a.amount).toLocaleString()}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Card>
    );
}

function MaintenanceCard() {
    const hasOpen = summaryStats.openRequests > 0;
    return (
        <Card className="overflow-hidden">
            <div className="p-5 pb-3"><h3 className="text-base font-semibold text-gray-900">Maintenance Overview</h3></div>
            <div className="px-5 pb-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-lg p-4 ${hasOpen ? "bg-orange-800 text-white shadow-sm" : "border-2 border-gray-200 bg-gray-50"}`}>
                        <div className="flex items-start justify-between">
                            <p className={`text-3xl font-bold ${hasOpen ? "text-white" : "text-gray-900"}`}>{summaryStats.openRequests}</p>
                            {hasOpen && <AlertCircle className="w-4 h-4 text-orange-300 mt-1" />}
                        </div>
                        <p className={`text-sm font-medium mt-1 ${hasOpen ? "text-orange-100" : "text-gray-700"}`}>Open Requests</p>
                        <p className={`text-xs font-bold uppercase tracking-wide mt-0.5 ${hasOpen ? "text-orange-300" : "text-gray-400"}`}>{hasOpen ? "Action Required" : "All clear"}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <p className="text-3xl font-bold text-gray-900">{summaryStats.activeTenants}</p>
                        <p className="text-sm font-medium text-gray-700 mt-1">Active Tenants</p>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mt-0.5">Current Cycle</p>
                    </div>
                </div>
                <div>
                    <SLabel>Quick Shortcuts</SLabel>
                    <div className="grid grid-cols-2 gap-2">
                        {[{ icon: FileText, label: "New Ticket" }, { icon: History, label: "Log Book" }].map(({ icon: I, label }) => (
                            <button key={label} className="flex flex-col sm:flex-row items-center gap-2 rounded-lg border border-gray-200 p-3 hover:bg-orange-50 hover:border-orange-200 transition-colors group">
                                <div className="rounded-md bg-orange-100 p-2 group-hover:bg-orange-200 transition-colors"><I className="w-4 h-4 text-orange-800" /></div>
                                <span className="text-xs sm:text-sm font-medium text-gray-800 text-center">{label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Card>
    );
}

function DashboardPage({ onNavigate }) {
    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="p-4 sm:p-6 pb-4">
                <p className="text-2xl sm:text-3xl font-bold text-orange-900 leading-tight">
                    Good afternoon, <span className="text-orange-800">Aarav Shrestha</span>
                </p>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-1">
                    <p className="text-sm text-gray-500">Here&apos;s what&apos;s happening in your building today</p>
                    <div className="flex gap-2 flex-wrap">
                        <button className="flex items-center gap-2 px-3 py-2 bg-white text-gray-800 border border-gray-300 rounded-lg hover:bg-orange-50 text-sm font-medium transition-colors">
                            <ReceiptText className="w-4 h-4" /> Record Payment
                        </button>
                        <button className="flex items-center gap-2 px-3 py-2 bg-orange-900 text-white rounded-lg hover:bg-orange-800 text-sm font-medium transition-colors">
                            <Plus className="w-4 h-4" /> Add Tenant
                        </button>
                    </div>
                </div>
            </div>

            {/* ① ② ③ ④ Cards row */}
            <div className="px-4 sm:px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <CollectionCard onNavigate={onNavigate} />
                <OverdueCard onNavigate={onNavigate} />
                <OccupancyCard />
                <PLHintCard />
            </div>

            {/* ⑤ Revenue trend */}
            <div className="px-4 sm:px-6 pb-4">
                <RevenueBarChart onNavigate={onNavigate} />
            </div>

            {/* Bottom */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 sm:px-6 pb-6">
                <RecentTransactions />
                <MaintenanceCard />
            </div>
        </div>
    );
}

// ─── ACCOUNTING PAGE ───────────────────────────────────────────────────────────

function MetricCard({ title, value, sub, icon: Icon, accentColor, bgColor, textColor }) {
    return (
        <div className={`relative flex flex-col gap-3 rounded-xl border border-gray-100 p-5 overflow-hidden shadow-sm ${bgColor}`}>
            <div className={`absolute left-0 top-0 w-1 h-full rounded-l-xl ${accentColor}`} />
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest pl-1">{title}</span>
                <div className={`p-2 rounded-lg border border-black/5 ${bgColor}`}><Icon className={`w-4 h-4 ${textColor}`} /></div>
            </div>
            <div className="pl-1">
                <p className={`text-3xl font-black tabular-nums tracking-tight ${textColor}`}>{fmt(value)}</p>
                {sub && <p className="text-xs text-gray-400 mt-1 font-medium">{sub}</p>}
            </div>
        </div>
    );
}

function DonutChart({ data, title }) {
    const total = data.reduce((s, d) => s + d.amount, 0);
    return (
        <Card className="overflow-hidden">
            <div className="p-5 pb-2">
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(total)}</p>
            </div>
            <div className="px-5 pb-5">
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie data={data.map(d => ({ name: d.name, value: d.amount }))} cx="50%" cy="50%"
                            innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value"
                            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 grid grid-cols-1 gap-2">
                    {data.map((item, i) => (
                        <div key={item.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-sm font-medium text-gray-700">{item.name}</span>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-sm">{fmt(item.amount)}</p>
                                <p className="text-xs text-gray-400">{((item.amount / total) * 100).toFixed(1)}%</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
}

function RevExpChart({ data }) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" fill="#fef3c7" stroke="#f59e0b" strokeWidth={2} name="Revenue" />
                <Bar dataKey="expenses" fill="#9a3412" radius={[4, 4, 0, 0]} maxBarSize={36} name="Expenses" opacity={0.85} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

function LedgerTable({ entries }) {
    const [page, setPage] = useState(1);
    const perPage = 5, total = Math.ceil(entries.length / perPage);
    const paged = entries.slice((page - 1) * perPage, page * perPage);
    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            {["Date", "Description", "Debit", "Credit", "Running Balance"].map(h => (
                                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(e => (
                            <tr key={e._id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                                <td className="py-3 px-4 text-gray-400 text-xs">{new Date(e.date).toLocaleDateString()}</td>
                                <td className="py-3 px-4 text-gray-700 font-medium">{e.description}</td>
                                <td className="py-3 px-4 text-rose-600 font-semibold">{e.debit ? fmt(e.debit) : "—"}</td>
                                <td className="py-3 px-4 text-emerald-600 font-semibold">{e.credit ? fmt(e.credit) : "—"}</td>
                                <td className="py-3 px-4 text-right font-bold text-gray-900">{fmt(e.runningBalance)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {total > 1 && (
                <div className="flex items-center justify-between mt-4 px-4 pb-4">
                    <span className="text-xs text-gray-400">Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, entries.length)} of {entries.length}</span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                        {Array.from({ length: total }, (_, i) => i + 1).map(p => (
                            <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded text-xs font-medium ${p === page ? "bg-orange-900 text-white" : "border border-gray-200 hover:bg-gray-50 text-gray-600"}`}>{p}</button>
                        ))}
                        <button onClick={() => setPage(p => Math.min(total, p + 1))} disabled={page === total} className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
            )}
        </>
    );
}

function ComparisonStats({ stats }) {
    const rows = [
        { title: "Revenue", key: "revenue", aColor: "text-emerald-600", bColor: "text-cyan-600" },
        { title: "Expenses", key: "expenses", aColor: "text-rose-500", bColor: "text-orange-500" },
        { title: "Net Cash Flow", key: "netCashFlow", aColor: "text-gray-900", bColor: "text-gray-900" },
    ];
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            {rows.map(({ title, key, aColor, bColor }) => {
                const s = stats[key], up = s.pct >= 0;
                return (
                    <div key={key} className="border border-dashed border-gray-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
                        <div className="flex items-end justify-between gap-2 mb-3">
                            <div><p className="text-[10px] text-gray-400">Q1 (prev)</p><p className={`text-base font-bold tabular-nums ${aColor}`}>{fmt(s.a)}</p></div>
                            <span className="text-gray-300 text-lg pb-1">→</span>
                            <div className="text-right"><p className="text-[10px] text-gray-400">Q1 (curr)</p><p className={`text-base font-bold tabular-nums ${bColor}`}>{fmt(s.b)}</p></div>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${up ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {Math.abs(s.pct).toFixed(1)}%
                            </span>
                            <span className="text-xs text-gray-400">{up ? "increase" : "decrease"}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function AccountingPage() {
    const [activeTab, setActiveTab] = useState("summary");
    const [selectedQuarter, setSelectedQuarter] = useState(null);
    const [compareMode, setCompareMode] = useState(false);

    const quarters = [
        { label: "All", value: null },
        { label: "Q1 · Shr–Asw", value: 1 },
        { label: "Q2 · Kar–Pou", value: 2 },
        { label: "Q3 · Mag–Cha", value: 3 },
        { label: "Q4 · Bai–Ash", value: 4 },
    ];
    const chartData = revenueByMonth.filter(d => d.revenue || d.expenses);
    const margin = ((accountingTotals.netCashFlow / accountingTotals.totalRevenue) * 100).toFixed(1);

    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="p-4 sm:p-6 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Accounting</p>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">Financial Overview</h1>
                        <p className="text-sm text-gray-500 mt-1">Nepali Fiscal Year 2081–82</p>
                    </div>
                    {/* ⑦ Export */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                        <button className="flex items-center gap-2 px-3 py-2 bg-orange-900 text-white rounded-lg text-sm font-medium hover:bg-orange-800 transition-colors">
                            <Plus className="w-4 h-4" /> Add Entry
                        </button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        {quarters.map(q => (
                            <Pill key={String(q.value)} label={q.label} active={selectedQuarter === q.value} onClick={() => setSelectedQuarter(q.value)} />
                        ))}
                    </div>
                    <button onClick={() => setCompareMode(p => !p)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${compareMode ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                        <GitCompare className="w-4 h-4" /> {compareMode ? "Exit Compare" : "Compare"}
                    </button>
                </div>

                {compareMode && (
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Period A in emerald ·
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block mx-0.5" />Period B in cyan
                    </p>
                )}

                {/* ⑥ Terminology banner */}
                <div className="flex items-start gap-2 mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-600 leading-relaxed">
                        <span className="font-bold">Collection</span> (on Dashboard) = payments received: rent, CAM, electricity. &nbsp;
                        <span className="font-bold">Revenue</span> here = full ledger entries, which may include non-collection income sources. Both figures may differ.
                    </p>
                </div>
            </div>

            <div className="px-4 sm:px-6">
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
                    {[{ id: "summary", label: "Summary" }, { id: "revenue", label: "Revenue" }, { id: "expenses", label: "Expenses" }].map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {activeTab === "summary" && (
                    <div className="space-y-6 pb-8">
                        {!compareMode && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <MetricCard title="Gross Revenue" value={accountingTotals.totalRevenue}
                                    sub={`Period: ${selectedQuarter ? `Q${selectedQuarter}` : "All"} · FY 2081-82`}
                                    icon={ArrowUpRight} accentColor="bg-emerald-500" bgColor="bg-emerald-50/60" textColor="text-emerald-700" />
                                <MetricCard title="Total Expenses" value={accountingTotals.totalExpenses}
                                    sub="All categories combined"
                                    icon={ArrowDownRight} accentColor="bg-rose-500" bgColor="bg-rose-50/60" textColor="text-rose-600" />
                                <MetricCard title="Net Cash Flow" value={accountingTotals.netCashFlow}
                                    sub={null}
                                    icon={Banknote} accentColor="bg-blue-500" bgColor="bg-blue-50/40" textColor="text-blue-700" />
                            </div>
                        )}

                        {!compareMode && (
                            <div className="flex items-center gap-3">
                                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <TrendingUp className="w-3 h-3" /> {margin}% margin
                                </span>
                                <span className="text-xs text-gray-400">Net margin for selected period</span>
                                {/* ⑦ Pre-filled export */}
                                <button className="flex items-center gap-1 text-xs font-bold text-orange-700 hover:text-orange-900 ml-auto border border-orange-200 px-2.5 py-1 rounded-md bg-orange-50">
                                    <Download className="w-3 h-3" /> Export period
                                </button>
                            </div>
                        )}

                        <Card>
                            <div className="flex items-start justify-between p-5 pb-2 flex-wrap gap-2">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">{compareMode ? "Period Comparison" : "Revenue vs Expenses"}</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">{selectedQuarter ? `Q${selectedQuarter} (FY 2081-82)` : "All periods · FY 2081-82"}</p>
                                </div>
                                {compareMode && (
                                    <div className="flex items-center gap-2">
                                        <Bdg className="bg-emerald-100 text-emerald-700"><span className="w-2 h-2 rounded-sm bg-emerald-500 mr-1.5" />A: Q1 (prev)</Bdg>
                                        <Bdg className="bg-cyan-100 text-cyan-700"><span className="w-2 h-2 rounded-sm bg-cyan-500 mr-1.5" />B: Q1 (curr)</Bdg>
                                    </div>
                                )}
                            </div>
                            <div className="px-5 pb-5 pt-2">
                                <RevExpChart data={chartData} />
                                {compareMode && <ComparisonStats stats={quarterlyCompare} />}
                            </div>
                        </Card>

                        <Card>
                            <div className="flex items-center justify-between p-5 pb-3">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">General Ledger</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">All transactions · {selectedQuarter ? `Q${selectedQuarter}` : "All periods"}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Bdg className="bg-gray-100 text-gray-600">{ledgerEntries.length} entries</Bdg>
                                    {/* ⑦ Ledger export */}
                                    <button className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50">
                                        <Download className="w-3 h-3" /> Export
                                    </button>
                                </div>
                            </div>
                            <LedgerTable entries={ledgerEntries} />
                        </Card>
                    </div>
                )}

                {activeTab === "revenue" && (
                    <div className="space-y-6 pb-8">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Revenue Breakdown</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Full ledger · includes rent, CAM, and other income</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"><Download className="w-3 h-3" /> Export</button>
                                <button className="flex items-center gap-2 px-3 py-2 bg-orange-900 text-white rounded-lg text-sm font-medium hover:bg-orange-800"><Plus className="w-4 h-4" /> Add Revenue</button>
                            </div>
                        </div>
                        <DonutChart data={revenueBreakdown} title="Revenue by Source" />
                    </div>
                )}

                {activeTab === "expenses" && (
                    <div className="space-y-6 pb-8">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Expense Breakdown</h2>
                                <p className="text-xs text-gray-400 mt-0.5">All expense categories for selected period</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"><Download className="w-3 h-3" /> Export</button>
                                <button className="flex items-center gap-2 px-3 py-2 bg-orange-900 text-white rounded-lg text-sm font-medium hover:bg-orange-800"><Plus className="w-4 h-4" /> Add Expense</button>
                            </div>
                        </div>
                        <DonutChart data={expenseBreakdown} title="Expenses by Category" />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────

export default function App() {
    const [page, setPage] = useState("dashboard");
    return (
        <div className="font-sans max-w-5xl mx-auto">
            <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
                <div className="flex items-center justify-between px-4 sm:px-6 py-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-orange-900 rounded-lg flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-gray-900">PropMgmt</span>
                    </div>
                    <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                        {[{ id: "dashboard", label: "Dashboard" }, { id: "accounting", label: "Accounting" }].map(n => (
                            <button key={n.id} onClick={() => setPage(n.id)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${page === n.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                                {n.label}
                            </button>
                        ))}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-800 font-bold text-sm">A</div>
                </div>
            </div>
            {page === "dashboard" ? <DashboardPage onNavigate={setPage} /> : <AccountingPage />}
        </div>
    );
}