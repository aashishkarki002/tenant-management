import { useState, useEffect } from "react";
import api from "../../plugins/axios";
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  MapPin,
} from "lucide-react";
import { OverviewLeaseTab } from "./components/OverviewLeaseTab";
import { DocumentsTab } from "./components/DocumentsTab";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { PaymentHistoryTab } from "./components/PaymentHistoryTab";
import { ElectricityTab } from "./components/ElectricityTab";
import { EscalationTab } from "./components/EscalationTab";
import { SecurityDepositTab } from "./components/SecurityDepositTab";
import Breadcrumb from "./components/Breadcrumb";

const DEFAULT_TABS = [
  {
    value: "personalInfo",
    label: "Overview",
    component: OverviewLeaseTab,
    icon: UserCircle2,
  },
  {
    value: "documents",
    label: "Documents",
    component: DocumentsTab,
    icon: FileText,
  },
  {
    value: "propertyDetails",
    label: "Maintenance",
    component: MaintenanceTab,
    icon: Wrench,
  },
  {
    value: "electricity",
    label: "Electricity",
    component: ElectricityTab,
    icon: Zap,
  },
  {
    value: "paymentHistory",
    label: "Payments",
    component: PaymentHistoryTab,
    icon: CreditCard,
  },
  {
    value: "escalation",
    label: "Escalation",
    component: EscalationTab,
    icon: AlertTriangle,
  },
  {
    value: "securityDeposit",
    label: "Security",
    component: SecurityDepositTab,
    icon: ShieldCheck,
  },
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

  useEffect(() => {
    getTenant();
  }, [id]);

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
    if (!tenant?.leaseStartDate || !tenant?.leaseEndDate) {
      return { progress: 0, remainingMonths: 0 };
    }
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

  useEffect(() => {
    getMaintenanceHistory();
  }, [id]);

  const tenantMaintenance = maintenanceHistory ?? [];
  const { progress, remainingMonths } = calculateLeaseProgress();

  const getUnitLabel = () => {
    if (!tenant?.units || tenant.units.length === 0) return "—";
    const firstUnit = tenant.units[0];
    if (typeof firstUnit === "object" && firstUnit !== null) {
      return tenant.units.map((unit) => unit.name).join(", ");
    }
    return tenant.units.join(", ");
  };

  const initials = tenant?.name
    ? tenant.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "T";

  return (
    <div className="px-2 sm:px-4 md:px-6 pb-8">
      <Breadcrumb tenantName={tenant?.name} />

      {/* ── Tenant Profile Card ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden mb-4">
        {/* Accent top strip */}
        <div className="h-1 w-full " />

        <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

            {/* Left: avatar + identity */}
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="relative shrink-0">
                <Avatar className="w-12 h-12 sm:w-14 sm:h-14 ring-2 ring-primary ring-offset-2">
                  <AvatarImage src="https://github.com/shadcn.png" alt={tenant?.name} />
                  <AvatarFallback className="text-sm font-bold bg-primary-50 text-blue-700">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {tenant?.status === "active" && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 ring-2 ring-background" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-lg sm:text-xl font-semibold leading-tight text-foreground">
                    {tenant?.name ?? "—"}
                  </h1>
                  <StatusBadge status={tenant?.status} />
                  {tenant?.rentPaymentFrequency && (
                    <Badge
                      variant="outline"
                      className="text-xs font-normal border-amber-300 text-amber-700 bg-amber-50"
                    >
                      {tenant.rentPaymentFrequency === "monthly" ? "Monthly" : "Quarterly"}
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-2">
                  ID #{tenant?._id?.slice(-8) ?? "—"}
                </p>

                <div className="flex flex-col gap-1">
                  {(tenant?.block?.name || tenant?.innerBlock?.name) && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {[tenant?.block?.name, tenant?.innerBlock?.name]
                          .filter(Boolean)
                          .join(", ")}
                        {getUnitLabel() !== "—" ? ` — ${getUnitLabel()}` : ""}
                      </span>
                    </div>
                  )}
                  {tenant?.leaseStartDateNepali && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                      <span>Since {tenant.leaseStartDateNepali} BS</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: lease progress */}
            {tenant?.leaseStartDate && tenant?.leaseEndDate && (
              <div className="sm:min-w-[200px] sm:max-w-[240px] w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">Lease Progress</span>
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
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
      </div>

      {/* ── Tab Navigation ──────────────────────────────────────────────────── */}
      <Tabs defaultValue={tabs[0]?.value ?? "personalInfo"} className="gap-0">
        <div className="mb-4">
          <TabsList className="w-full h-auto bg-background border border-border rounded-xl p-1 overflow-x-auto flex gap-0.5">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="
                  flex-1 min-w-[64px] flex items-center justify-center gap-1.5
                  px-2 py-2 text-xs sm:text-sm rounded-lg
                  text-muted-foreground font-medium
                  transition-all duration-150 cursor-pointer
                  data-[state=active]:bg-primary data-[state=active]:text-primary-foreground
                  data-[state=active]:shadow-sm hover:bg-muted/60
                "
              >
                {tab.icon && <tab.icon className="h-3.5 w-3.5 shrink-0" />}
                <span className="hidden xs:inline sm:inline whitespace-nowrap">
                  {tab.label}
                </span>
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

function StatusBadge({ status }) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "active") {
    return (
      <Badge variant="outline" className="text-xs font-medium border-green-300 text-success bg-success-light">
        Active
      </Badge>
    );
  }
  if (s === "inactive" || s === "vacated") {
    return (
      <Badge variant="outline" className="text-xs font-medium border-border text-muted-foreground bg-muted">
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs capitalize">
      {status}
    </Badge>
  );
}

export default ViewDetail;
