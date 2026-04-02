import NepaliDate from "nepali-datetime";

// ─── Nepali calendar ──────────────────────────────────────────────────────────
export const BS_MONTHS = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

export function toBSDate(v) {
  if (!v) return "—";
  try {
    const nd = new NepaliDate(new Date(v));
    return `${nd.getDate()} ${BS_MONTHS[nd.getMonth()]} ${nd.getYear()}`;
  } catch {
    return "—";
  }
}

export function getCurrentBSDate() {
  try {
    const nd = new NepaliDate();
    return `${nd.getDate()} ${BS_MONTHS[nd.getMonth()]} ${nd.getYear()}`;
  } catch {
    return "—";
  }
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
export const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface-raised)",
  surfaceAlt: "var(--color-surface)",
  border: "var(--color-border)",
  text: "var(--color-text-strong)",
  textMid: "var(--color-text-body)",
  textMuted: "var(--color-text-sub)",
  accent: "var(--color-accent)",
  positive: "var(--color-success)",
  positiveBg: "var(--color-success-bg)",
  negative: "var(--color-danger)",
  negativeBg: "var(--color-danger-bg)",
  amber: "var(--color-warning)",
  amberBg: "var(--color-warning-bg)",
  info: "var(--color-info)",
  infoBg: "var(--color-info-bg)",
};

// ─── Formatting ────────────────────────────────────────────────────────────────
export const fmtN = (n = 0) => Math.abs(Math.round(n)).toLocaleString("en-IN");

export function fmtK(rupees) {
  const a = Math.abs(rupees ?? 0);
  const s = rupees < 0 ? "−" : "";
  if (a >= 10_000_000) return `${s}रू ${(a / 10_000_000).toFixed(2)} Cr`;
  if (a >= 100_000) return `${s}रू ${(a / 100_000).toFixed(2)} L`;
  if (a >= 1_000) return `${s}रू ${(a / 1_000).toFixed(1)}K`;
  return `${s}रू ${a}`;
}

export const paisaToRupees = (paisa) => Math.round((paisa ?? 0) / 100);

export function fmtRupees(paisa) {
  return `रू ${fmtN((paisa ?? 0) / 100)}`;
}

// ─── Status config ─────────────────────────────────────────────────────────────
export const STATUS = {
  ACTIVE: { label: "Active", bg: C.infoBg, color: C.info },
  CLOSED: { label: "Closed", bg: C.positiveBg, color: C.positive },
  DEFAULTED: { label: "Defaulted", bg: C.negativeBg, color: C.negative },
  PENDING: { label: "Pending", bg: C.amberBg, color: C.amber },
};

export const LOAN_TYPE_LABELS = {
  HOME_LOAN: "Home Loan",
  MORTGAGE: "Mortgage",
  PERSONAL: "Personal Loan",
  OVERDRAFT: "Overdraft",
  BUSINESS: "Business Loan",
};

// ─── entityId resolution ───────────────────────────────────────────────────────
export const HARDCODED_ENTITY_ID = "69b11f16ce3a098bb6ba5424"; // TODO: remove when entity context is wired
