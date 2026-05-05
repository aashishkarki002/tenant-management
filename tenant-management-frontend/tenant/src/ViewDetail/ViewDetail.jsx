import { useState, useEffect } from "react";
import api from "../../plugins/axios";
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Building2,
  UserCircle2,
  FileText,
  Wrench,
  Zap,
  CreditCard,
  AlertTriangle,
  ShieldCheck,
  CalendarDays,
  BookOpen,
} from "lucide-react";
import { OverviewLeaseTab } from "./components/OverviewLeaseTab";
import { DocumentsTab } from "./components/DocumentsTab";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { PaymentHistoryTab } from "./components/PaymentHistoryTab";
import { ElectricityTab } from "./components/ElectricityTab";
import { EscalationTab } from "./components/EscalationTab";
import { SecurityDepositTab } from "./components/SecurityDepositTab";
import { TenantLedgerTab } from "./components/TenantLedgerTab";
import Breadcrumb from "./components/Breadcrumb";

const DEFAULT_TABS = [
  { value: "personalInfo", label: "Overview", component: OverviewLeaseTab, icon: UserCircle2 },
  { value: "documents", label: "Documents", component: DocumentsTab, icon: FileText },
  { value: "propertyDetails", label: "Maintenance", component: MaintenanceTab, icon: Wrench },
  { value: "electricity", label: "Electricity", component: ElectricityTab, icon: Zap },
  { value: "paymentHistory", label: "Payments", component: PaymentHistoryTab, icon: CreditCard },
  { value: "escalation", label: "Escalation", component: EscalationTab, icon: AlertTriangle },
  { value: "securityDeposit", label: "Security", component: SecurityDepositTab, icon: ShieldCheck },
  { value: "ledger", label: "Ledger", component: TenantLedgerTab, icon: BookOpen },
];

function ViewDetail({ tabs: tabsProp }) {
  const tabs = tabsProp ?? DEFAULT_TABS;
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [maintenanceHistory, setMaintenanceHistory] = useState([]);
  const { id } = useParams();

  const getTenant = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/tenant/get-tenant/${id}`);
      setTenant(response.data.tenant);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { getTenant(); }, [id]);

  useEffect(() => {
    if (tenant?.documents?.length > 0) {
      const firstDocument = tenant.documents[0];
      if (firstDocument?.files?.length > 0) {
        setSelectedDocument(firstDocument);
        setSelectedFile(firstDocument.files[0]);
      }
    }
  }, [tenant]);

  const calculateLeaseProgress = () => {
    if (!tenant?.leaseStartDate || !tenant?.leaseEndDate) return { progress: 0, remainingMonths: 0 };
    const startDate = new Date(tenant.leaseStartDate);
    const endDate = new Date(tenant.leaseEndDate);
    const now = new Date();
    const totalMonths =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());
    const elapsedMonths =
      (now.getFullYear() - startDate.getFullYear()) * 12 +
      (now.getMonth() - startDate.getMonth());
    const remainingMonths = Math.max(0, totalMonths - elapsedMonths);
    const progress = Math.min(100, Math.max(0, (elapsedMonths / totalMonths) * 100));
    return { progress, remainingMonths };
  };

  const getMaintenanceHistory = async () => {
    if (!id) return;
    try {
      const response = await api.get(`/api/maintenance/get-maintenance/${id}`);
      const list = response.data?.maintenance;
      setMaintenanceHistory(Array.isArray(list) ? list : []);
    } catch {
      setMaintenanceHistory([]);
    }
  };

  useEffect(() => { getMaintenanceHistory(); }, [id]);

  const tenantMaintenance = maintenanceHistory ?? [];
  const { progress, remainingMonths } = calculateLeaseProgress();

  const getUnitLabel = () => {
    if (!tenant?.units || tenant.units.length === 0) return null;
    console.log(tenant.units);
    const firstUnit = tenant.units[0];
    if (typeof firstUnit === "object" && firstUnit !== null) {
      return tenant.units.map((u) => u.name).join(", ");
    }
    return tenant.units.join(", ");
  };

  const initials = tenant?.name
    ? tenant.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "T";

  const locationParts = [
    tenant?.block?.name,
    tenant?.innerBlock?.name,
    getUnitLabel(),
  ].filter(Boolean);

  return (
    <div className="px-2 sm:px-4 md:px-6 pb-12">
      <Breadcrumb tenantName={tenant?.name} />

      {/* ── Tenant Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 pb-6 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">

          {/* Avatar */}
          <div className="relative shrink-0 self-start">
            <Avatar className="w-14 h-14 sm:w-16 sm:h-16">
              <AvatarImage src="https://github.com/shadcn.png" alt={tenant?.name} />
              <AvatarFallback
                className="text-base font-semibold"
                style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {tenant?.status === "active" && (
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-background"
                style={{ background: "var(--color-success)" }}
              />
            )}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h1
                className="text-xl sm:text-2xl font-semibold leading-tight"
                style={{ color: "var(--color-text-strong)" }}
              >
                {tenant?.name ?? "—"}
              </h1>
              <StatusPill status={tenant?.status} />
            </div>

            {/* Meta row */}
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
              style={{ color: "var(--color-text-sub)" }}
            >
              {tenant?._id && (
                <span>#{tenant._id.slice(-8)}</span>
              )}
              {locationParts.length > 0 && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 shrink-0" />
                    {locationParts.join(" · ")}
                  </span>
                </>
              )}
              {tenant?.leaseStartDateNepali && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3 shrink-0" />
                    Since {tenant.leaseStartDateNepali} BS
                  </span>
                </>
              )}
              {tenant?.rentPaymentFrequency && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="capitalize">{tenant.rentPaymentFrequency}</span>
                </>
              )}
            </div>
          </div>

          {/* Lease progress — right-aligned on sm+ */}
          {tenant?.leaseStartDate && tenant?.leaseEndDate && (
            <div className="sm:min-w-[180px] sm:text-right">
              <div className="flex sm:justify-end items-center gap-2 mb-2">
                <span className="text-xs" style={{ color: "var(--color-text-sub)" }}>
                  Lease progress
                </span>
                <span
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: "var(--color-text-strong)" }}
                >
                  {Math.round(progress)}%
                </span>
              </div>
              <div
                className="h-1 w-full rounded-full overflow-hidden"
                style={{ background: "var(--color-muted-fill)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progress}%`, background: "var(--color-accent)" }}
                />
              </div>
              <p
                className="text-xs mt-1.5 sm:text-right"
                style={{ color: "var(--color-text-weak)" }}
              >
                {remainingMonths === 0
                  ? "Lease completed"
                  : remainingMonths === 1
                    ? "1 month remaining"
                    : `${remainingMonths} months remaining`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────────── */}
      <Tabs defaultValue={tabs[0]?.value ?? "personalInfo"} className="gap-0">
        {/* Tab list — underline style */}
        <div className="mb-6 border-b border-border overflow-x-auto">
          <TabsList className="h-auto bg-transparent rounded-none p-0 gap-0 flex w-max min-w-full">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="
                  relative flex items-center gap-1.5 px-3 sm:px-4 py-2.5
                  text-xs sm:text-sm font-medium rounded-none bg-transparent border-0
                  text-muted-foreground
                  cursor-pointer whitespace-nowrap
                  transition-colors duration-150
                "
                style={{
                  "--tw-text-opacity": 1,
                }}
              >
                {tab.icon && <tab.icon className="h-3.5 w-3.5 shrink-0" />}
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.map((tab) => {
          const Component = tab.component;
          let tabProps = {};

          if (tab.value === "personalInfo") {
            tabProps = { tenant };
          } else if (tab.value === "documents") {
            tabProps = {
              tenant,
              viewMode,
              onViewModeChange: setViewMode,
              selectedDocument,
              selectedFile,
              onSelectFile: (doc, file) => {
                setSelectedDocument(doc);
                setSelectedFile(file);
              },
            };
          } else if (tab.value === "propertyDetails") {
            tabProps = { tenantMaintenance };
          } else if (tab.value === "paymentHistory" || tab.value === "electricity") {
            tabProps = { tenantId: id };
          } else if (tab.value === "escalation") {
            tabProps = { tenantId: id };
          } else if (tab.value === "securityDeposit") {
            tabProps = {
              tenantId: id,
              blockId: tenant?.block?._id ?? tenant?.block,
              sdId: tenant?.securityDepositId ?? null,
            };
          } else if (tab.value === "ledger") {
            tabProps = { tenantId: id, tenant };
          }

          return (
            <TabsContent key={tab.value} value={tab.value}>
              <Component {...tabProps} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function StatusPill({ status }) {
  if (!status) return null;
  const s = status.toLowerCase();

  const styles = {
    active: {
      background: "var(--color-success-light)",
      color: "var(--color-success)",
      border: "1px solid var(--color-success-border)",
    },
    inactive: {
      background: "var(--color-surface)",
      color: "var(--color-text-sub)",
      border: "1px solid var(--color-border)",
    },
    vacated: {
      background: "var(--color-surface)",
      color: "var(--color-text-sub)",
      border: "1px solid var(--color-border)",
    },
  };

  const style = styles[s] ?? {
    background: "var(--color-accent-light)",
    color: "var(--color-accent)",
    border: "1px solid var(--color-accent-mid)",
  };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={style}
    >
      {status}
    </span>
  );
}

export default ViewDetail;
