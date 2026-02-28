import { useState, useEffect } from "react";
import api from "../../plugins/axios";
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { OverviewLeaseTab } from "./OverviewLeaseTab";
import { DocumentsTab } from "./DocumentsTab";
import { MaintenanceTab } from "./MaintenanceTab";
import { PaymentHistoryTab } from "./PaymentHistoryTab";
import { ElectricityTab } from "./ElectricityTab";
import { EscalationTab } from "./EscalationTab";
import Breadcrumb from "./Breadcrumb";

const DEFAULT_TABS = [
  {
    value: "personalInfo",
    label: "Overview & Lease",
    shortLabel: "Overview",
    component: OverviewLeaseTab,
    icon: UserCircle2,
  },
  {
    value: "documents",
    label: "Documents",
    shortLabel: "Documents",
    component: DocumentsTab,
    icon: FileText,
  },
  {
    value: "propertyDetails",
    label: "Maintenance",
    shortLabel: "Maintenance",
    component: MaintenanceTab,
    icon: Wrench,
  },
  {
    value: "electricity",
    label: "Electricity",
    shortLabel: "Electricity",
    component: ElectricityTab,
    icon: Zap,
  },
  {
    value: "paymentHistory",
    label: "Payment History",
    shortLabel: "Payments",
    component: PaymentHistoryTab,
    icon: CreditCard,
  },
  {
    value: "escalation",
    label: "Escalation",
    shortLabel: "Escalation",
    component: EscalationTab,
    icon: AlertTriangle,
  },
];

function ViewDetail({ tabs: tabsProp }) {
  const tabs = tabsProp ?? DEFAULT_TABS;
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "timeline"
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

  // Auto-select first document when tenant data loads
  useEffect(() => {
    if (tenant?.documents?.length > 0) {
      const firstDocument = tenant.documents[0];
      if (firstDocument?.files?.length > 0) {
        setSelectedDocument(firstDocument);
        setSelectedFile(firstDocument.files[0]);
      }
    }
  }, [tenant]);


  // Calculate lease progress
  const calculateLeaseProgress = () => {
    if (!tenant?.leaseStartDate || !tenant?.leaseEndDate) {
      return { progress: 0, remainingMonths: 0 };
    }

    const startDate = new Date(tenant.leaseStartDate);
    const endDate = new Date(tenant.leaseEndDate);
    const now = new Date();

    // Calculate total lease duration in months
    const totalMonths =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());

    // Calculate elapsed time in months
    const elapsedMonths =
      (now.getFullYear() - startDate.getFullYear()) * 12 +
      (now.getMonth() - startDate.getMonth());

    // Calculate remaining months
    const remainingMonths = Math.max(0, totalMonths - elapsedMonths);

    // Calculate progress percentage (0-100)
    const progress = Math.min(
      100,
      Math.max(0, (elapsedMonths / totalMonths) * 100)
    );

    return { progress, remainingMonths };
  };
  const getMaintenanceHistory = async () => {
    if (!id) return;
    try {
      const response = await api.get(`/api/maintenance/get-maintenance/${id}`);
      const list = response.data?.maintenance;
      setMaintenanceHistory(Array.isArray(list) ? list : []);
    } catch (err) {
      setMaintenanceHistory([]);
    }
  };
  useEffect(() => {
    getMaintenanceHistory();
  }, [id]);

  // Maintenance for this tenant (fetched by tenant id from API)
  const tenantMaintenance = maintenanceHistory ?? [];

  const { progress, remainingMonths } = calculateLeaseProgress();

  const getUnitLabel = () => {
    if (!tenant?.units || tenant.units.length === 0) return "—";

    const firstUnit = tenant.units[0];

    // If units are objects with name
    if (typeof firstUnit === "object" && firstUnit !== null) {
      return tenant.units.map((unit) => unit.name).join(", ");
    }

    // If units are just ids/strings
    return tenant.units.join(", ");
  };

  return (
    <div className="px-2 sm:px-4 md:px-6">
      <Breadcrumb tenantName={tenant?.name} />
      <Card className="border border-border shadow-sm rounded-xl bg-gray-50">
        <CardHeader className="space-y-4 p-4 sm:p-6">
          {/* Header Row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <Avatar className="w-10 h-10 sm:w-12 sm:h-12">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback className="text-base sm:text-lg font-semibold">
                  {tenant?.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg sm:text-xl md:text-2xl font-semibold leading-tight">
                    {tenant?.name}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="border-green-600 text-green-700 bg-green-50 text-xs"
                  >
                    {tenant?.status}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-yellow-600 text-yellow-700 bg-yellow-50 text-xs"
                  >
                    {tenant?.rentPaymentFrequency === "monthly"
                      ? "Monthly Rent"
                      : "Quarterly Rent"}
                  </Badge>
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  Tenant ID: #{tenant?._id?.slice(-8)}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            {tenant?.leaseStartDate && tenant?.leaseEndDate && (
              <div className="w-full sm:w-auto sm:min-w-[200px]">
                <Progress
                  value={progress}
                  className="h-2.5 mb-2 [&>div]:bg-blue-600"
                />
                <p className="text-xs text-muted-foreground">
                  {remainingMonths === 0
                    ? "Lease completed"
                    : remainingMonths === 1
                      ? "1 month remaining"
                      : `${remainingMonths} months remaining`}
                </p>
              </div>
            )}
          </div>

          {/* Meta Info */}
          <CardDescription className="flex flex-col gap-2 text-xs sm:text-sm">
            <div className="flex items-start gap-2 text-muted-foreground">
              <Building2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="break-words">
                {tenant?.block?.name}, {tenant?.innerBlock?.name} —{" "}
                {getUnitLabel()}
              </span>
            </div>

            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">Since:</span>{" "}
              {tenant?.leaseStartDateNepali
                ? tenant?.leaseStartDateNepali
                : "—"}
            </div>
          </CardDescription>
        </CardHeader>
      </Card>
      <Tabs defaultValue={tabs[0]?.value ?? "personalInfo"} className="mt-4 gap-2">
        <TabsList
          className="flex w-full h-auto overflow-x-auto gap-1 rounded-lg bg-muted/40 p-1"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-1 min-w-[56px] text-xs sm:text-sm px-2 py-2"
            >
              <div className="flex flex-col items-center justify-center gap-1 w-full">
                {tab.icon && <tab.icon className="h-4 w-4 sm:hidden" />}
                <span className="hidden sm:inline">{tab.label}</span>
              </div>
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => {
          const Component = tab.component;
          const tabProps =
            tab.value === "personalInfo"
              ? { tenant }
              : tab.value === "documents"
                ? {
                  tenant,
                  viewMode,
                  onViewModeChange: setViewMode,
                  selectedDocument,
                  selectedFile,
                  onSelectFile: (doc, file) => {
                    setSelectedDocument(doc);
                    setSelectedFile(file);
                  },
                }
                : tab.value === "propertyDetails"
                  ? { tenantMaintenance }
                  : tab.value === "paymentHistory" || tab.value === "electricity"
                    ? { tenantId: id }
                    : tab.value === "escalation" ? { tenantId: id } : {};
          return (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              {tab.value === "escalation" ? (
                <EscalationTab tenantId={id} />
              ) : (
                <Component {...tabProps} />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

export default ViewDetail;
