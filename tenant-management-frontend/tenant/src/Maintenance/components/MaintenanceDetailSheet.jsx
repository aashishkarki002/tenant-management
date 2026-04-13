import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  CheckCircle2,
  User,
  Phone,
  Wrench,
  Building2,
  FileText,
  MapPin,
  Tag,
  Banknote,
  CreditCard,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toBSDate } from "../../Loans/loan.constants";
import { formatDate, formatStatus, generateWorkOrderId } from "../utils/maintenance.utils";
import { getPriorityStyle, STATUS_SELECT_COLORS } from "../constants/maintenance.constants";

const fmtRs = (rupees) =>
  `रू ${Math.round(rupees ?? 0).toLocaleString("en-IN")}`;

const PAYMENT_METHOD_LABELS = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  MOBILE_WALLET: "Mobile Wallet",
};

const CONTRACTOR_TYPE_LABELS = {
  CONTRACTOR: "Contractor",
  VENDOR: "Vendor",
  UTILITY: "Utility",
  OTHER: "Other",
};

export function MaintenanceDetailSheet({ item, onClose }) {
  if (!item) return null;

  const status = (item.status || "OPEN").toUpperCase();
  const statusColor = STATUS_SELECT_COLORS[status] ?? STATUS_SELECT_COLORS.OPEN;
  const workOrderId = generateWorkOrderId(item);

  const scheduledDate = item.scheduledDate ? new Date(item.scheduledDate) : null;
  const completedAt = item.completedAt ? new Date(item.completedAt) : null;

  const durationDays =
    completedAt && scheduledDate
      ? Math.max(0, Math.round((completedAt - scheduledDate) / 86400000))
      : null;

  const durationLabel =
    durationDays === null
      ? status === "COMPLETED"
        ? "—"
        : "Ongoing"
      : durationDays === 0
        ? "Same day"
        : `${durationDays} day${durationDays !== 1 ? "s" : ""}`;

  const estimatedAmount = item.amount ?? 0;
  const paidAmount = item.paidAmount ?? 0;
  const paidPct =
    estimatedAmount > 0
      ? Math.min(100, Math.round((paidAmount / estimatedAmount) * 100))
      : 0;

  const isOverdue = (() => {
    if (status === "COMPLETED" || status === "CANCELLED") return false;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(item.scheduledDate);
      d.setHours(0, 0, 0, 0);
      return d < today;
    } catch {
      return false;
    }
  })();

  return (
    <Sheet open={!!item} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-lg p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* ── Header ── */}
        <SheetHeader className="shrink-0 px-6 py-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground mb-1">{workOrderId}</p>
              <SheetTitle className="text-[15px] font-semibold text-foreground leading-snug">
                {item.title}
              </SheetTitle>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium",
                  statusColor,
                )}
              >
                {formatStatus(item.status)}
              </span>
              {item.priority && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase",
                    getPriorityStyle(item.priority),
                  )}
                >
                  {item.priority}
                </span>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* ── Scrollable Body ── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-6">

            {/* ── Timeline ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
                Timeline
              </p>

              <div className="space-y-0">
                {/* Node 1: Reported */}
                <TimelineRow
                  dotClass="bg-blue-500"
                  showLine
                  label="Reported"
                  dateStr={item.createdAt}
                />

                {/* Node 2: Scheduled */}
                <TimelineRow
                  dotClass={isOverdue ? "bg-red-400" : "bg-amber-400"}
                  showLine
                  label="Scheduled"
                  dateStr={item.scheduledDate}
                  badge={
                    isOverdue
                      ? { text: "Overdue", cls: "bg-red-100 text-red-700" }
                      : null
                  }
                />

                {/* Node 3: Completed */}
                <TimelineRow
                  dotClass={completedAt ? "bg-emerald-500" : ""}
                  emptyRing={!completedAt}
                  showLine={false}
                  label="Completed"
                  dateStr={item.completedAt}
                  duration={durationLabel}
                />
              </div>
            </div>

            {/* ── Overview ── */}
            <Section title="Overview">
              <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                <DetailRow icon={Tag} label="Type" value={item.type || "—"} />
                <DetailRow
                  icon={MapPin}
                  label="Scope"
                  value={item.scope?.replace(/_/g, " ") || "—"}
                />
                {item.unit?.name && (
                  <DetailRow icon={Building2} label="Unit" value={item.unit.name} />
                )}
                {item.block?.name && (
                  <DetailRow icon={Building2} label="Block" value={item.block.name} />
                )}
                {item.tenant?.name && (
                  <DetailRow icon={User} label="Tenant" value={item.tenant.name} />
                )}
                {item.sourceType && (
                  <DetailRow
                    icon={FileText}
                    label="Source"
                    value={
                      item.sourceType.charAt(0) +
                      item.sourceType.slice(1).toLowerCase()
                    }
                  />
                )}
              </div>
            </Section>

            {/* ── Financials ── */}
            <Section title="Financials">
              <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                <DetailRow
                  icon={Banknote}
                  label="Estimated cost"
                  value={fmtRs(estimatedAmount)}
                />
                <DetailRow
                  icon={Banknote}
                  label="Paid amount"
                  value={fmtRs(paidAmount)}
                  valueClass={
                    paidAmount > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : undefined
                  }
                />
                {estimatedAmount > 0 && (
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-muted-foreground">
                        Payment progress
                      </span>
                      <span className="text-[11px] font-semibold text-foreground tabular-nums">
                        {paidPct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          paidPct >= 100
                            ? "bg-emerald-500"
                            : "bg-[var(--color-accent)]",
                        )}
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                  </div>
                )}
                {item.paymentStatus && (
                  <DetailRow
                    icon={CreditCard}
                    label="Payment status"
                    value={item.paymentStatus.replace(/_/g, " ")}
                    valueClass={cn(
                      "capitalize",
                      item.paymentStatus === "paid"
                        ? "text-emerald-600"
                        : item.paymentStatus === "overpaid"
                          ? "text-orange-600"
                          : "text-muted-foreground",
                    )}
                  />
                )}
                {item.paymentMethod && (
                  <DetailRow
                    icon={CreditCard}
                    label="Method"
                    value={
                      PAYMENT_METHOD_LABELS[item.paymentMethod] ??
                      item.paymentMethod
                    }
                  />
                )}
              </div>
            </Section>

            {/* ── Service Providers ── */}
            <Section title="Service Providers">
              <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                {/* Assigned staff */}
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <UserCheck size={12} className="text-muted-foreground shrink-0" />
                    <span className="text-[12px] text-muted-foreground">Assigned to</span>
                  </div>
                  <span
                    className={cn(
                      "text-[12px] font-medium text-right max-w-[200px] truncate",
                      item.assignedTo?.name
                        ? "text-foreground"
                        : "text-muted-foreground/50 italic",
                    )}
                  >
                    {item.assignedTo?.name || "Unassigned"}
                  </span>
                </div>

                {/* Contractor */}
                {item.contractor?.name ? (
                  <div className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 shrink-0">
                        <Wrench size={12} className="text-muted-foreground shrink-0" />
                        <span className="text-[12px] text-muted-foreground">
                          Vendor / Contractor
                        </span>
                      </div>
                      {item.contractor.type && (
                        <span className="text-[10px] font-medium rounded-full bg-muted px-2 py-0.5 text-muted-foreground shrink-0">
                          {CONTRACTOR_TYPE_LABELS[item.contractor.type] ??
                            item.contractor.type}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] font-semibold text-foreground pl-[22px]">
                      {item.contractor.name}
                    </p>
                    {item.contractor.phone && (
                      <div className="flex items-center gap-1.5 pl-[22px]">
                        <Phone size={11} className="text-muted-foreground shrink-0" />
                        <span className="text-[12px] text-muted-foreground">
                          {item.contractor.phone}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-2.5 shrink-0">
                      <Wrench size={12} className="text-muted-foreground shrink-0" />
                      <span className="text-[12px] text-muted-foreground">
                        Vendor / Contractor
                      </span>
                    </div>
                    <span className="text-[12px] text-muted-foreground/50 italic">
                      None assigned
                    </span>
                  </div>
                )}

                {/* Reported by */}
                {item.createdBy?.name && (
                  <DetailRow
                    icon={User}
                    label="Reported by"
                    value={item.createdBy.name}
                  />
                )}
              </div>
            </Section>

            {/* ── Description ── */}
            {item.description && (
              <Section title="Description">
                <div className="rounded-2xl border border-border bg-card px-4 py-3">
                  <p className="text-[13px] text-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </Section>
            )}

            {/* ── Completion Notes ── */}
            {item.completionNotes && (
              <Section title="Completion Notes">
                <div className="rounded-2xl border border-border bg-card px-4 py-3">
                  <p className="text-[13px] text-foreground leading-relaxed">
                    {item.completionNotes}
                  </p>
                </div>
              </Section>
            )}

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2.5">
        {title}
      </p>
      {children}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, valueClass }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-2.5 shrink-0">
        {Icon && <Icon size={12} className="text-muted-foreground shrink-0" />}
        <span className="text-[12px] text-muted-foreground">{label}</span>
      </div>
      <span
        className={cn(
          "text-[12px] font-medium text-foreground text-right max-w-[200px] truncate",
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TimelineRow({ dotClass, emptyRing, showLine, label, dateStr, badge, duration }) {
  return (
    <div className="flex gap-3">
      {/* Dot + vertical connector */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            "w-3.5 h-3.5 rounded-full mt-0.5",
            emptyRing
              ? "border-2 border-muted-foreground/30 bg-background"
              : dotClass,
          )}
        />
        {showLine && (
          <div className="flex-1 w-px bg-border mt-1 min-h-[28px]" />
        )}
      </div>

      {/* Content */}
      <div className={cn("min-w-0", showLine ? "pb-4" : "pb-0")}>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[12px] font-semibold text-foreground">{label}</p>
          {badge && (
            <span
              className={cn(
                "text-[9px] font-semibold rounded-full px-1.5 py-0.5",
                badge.cls,
              )}
            >
              {badge.text}
            </span>
          )}
        </div>
        {dateStr ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {toBSDate(dateStr)} · {formatDate(dateStr)}
          </p>
        ) : (
          <p className="mt-0.5 text-[11px] text-muted-foreground/40 italic">—</p>
        )}
        {duration !== undefined && (
          <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {duration}
          </span>
        )}
      </div>
    </div>
  );
}
