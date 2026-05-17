/**
 * IMPROVED EDIT TENANT COMPONENT
 * 
 * Key Improvements:
 * - Side-by-side comparison of original vs edited values
 * - Visual indicators for changed fields
 * - Real-time validation with error messages
 * - Better document management with preview
 * - Loading states and error handling
 * - Confirmation dialogs for destructive actions
 * 
 * Industry Standards Applied:
 * - Controlled components
 * - Optimistic UI updates
 * - Progressive disclosure
 * - Accessibility (ARIA labels, keyboard navigation)
 */

"use client";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Save,
  X,
  ArrowLeft,
  Info,
  FileText,
  DollarSign,
  Calendar,
  User,
  Building2,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Import sub-components (we'll create these)
import TenantBasicInfo from "./components/TenantBasicInfo";
import TenantLeaseInfo from "./components/TenantLeaseInfo";
import TenantFinancials from "./components/TenantFinancials";
import TenantDocuments from "./components/TenantDocument";
import TenantPropertyAssignment from "./components/TenantPropertyAssignment";
import Breadcrumb from "./components/Breadcrumb";
import RentFrequencyModal from "./components/RentFrequencyModal";

// Import custom hooks
import { useTenantEdit } from "./hooks/useTenantEdit";

// Import utilities
import { formatMoney, paisaToRupees } from "./utils/formatting";

// Validation schema
const validationSchema = Yup.object({
  name: Yup.string()
    .required("Name is required")
    .min(2, "Name must be at least 2 characters"),
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
  phone: Yup.string()
    .required("Phone is required")
    .matches(/^[0-9+\-\s()]+$/, "Invalid phone number"),
  address: Yup.string().required("Address is required"),
  leaseStartDate: Yup.date()
    .required("Lease start date is required")
    .nullable(),
  leaseEndDate: Yup.date()
    .required("Lease end date is required")
    .min(Yup.ref("leaseStartDate"), "End date must be after start date")
    .nullable(),
  leasedSquareFeet: Yup.number()
    .required("Leased square feet is required")
    .positive("Must be positive")
    .nullable(),
  pricePerSqft: Yup.number()
    .required("Price per sqft is required")
    .positive("Must be positive")
    .nullable(),
  camRatePerSqft: Yup.number()
    .required("CAM rate is required")
    .min(0, "Cannot be negative")
    .nullable(),
  securityDeposit: Yup.number()
    .required("Security deposit is required")
    .min(0, "Cannot be negative")
    .nullable(),
});

function EditTenant() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Custom hook for tenant editing logic
  const {
    tenant,
    originalTenant,
    isLoading,
    isSaving,
    error,
    fetchTenant,
    updateTenant,
    hasChanges,
    changedFields,
  } = useTenantEdit(id);

  const [showComparison, setShowComparison] = useState(true);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);

  // Initialize formik
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      // Basic Info
      name: tenant?.name || "",
      email: tenant?.email || "",
      phone: tenant?.phone || "",
      address: tenant?.address || "",
      status: tenant?.status || "active",

      // Lease Info
      leaseStartDate: tenant?.leaseStartDate || "",
      leaseEndDate: tenant?.leaseEndDate || "",
      dateOfAgreementSigned: tenant?.dateOfAgreementSigned || "",
      keyHandoverDate: tenant?.keyHandoverDate || "",
      spaceHandoverDate: tenant?.spaceHandoverDate || "",
      spaceReturnedDate: tenant?.spaceReturnedDate || "",

      // Financials
      leasedSquareFeet: tenant?.leasedSquareFeet || "",
      pricePerSqft: paisaToRupees(tenant?.pricePerSqftPaisa) || "",
      camRatePerSqft: paisaToRupees(tenant?.camRatePerSqftPaisa) || "",
      securityDeposit: paisaToRupees(tenant?.securityDepositPaisa) || "",

      // Property relationships
      unitNumber: tenant?.units?.map((u) => String(u._id || u)) || [],
      block: tenant?.block?._id || tenant?.block || "",
      innerBlock: tenant?.innerBlock?._id || tenant?.innerBlock || "",

      // Documents
      documents: {},
      existingDocuments: tenant?.documents || [],
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        await updateTenant(values);
        toast.success("Tenant updated successfully");
        navigate("/tenants");
      } catch (error) {
        toast.error(error.message || "Failed to update tenant");
      }
    },
  });

  // Load tenant data
  useEffect(() => {
    fetchTenant();
  }, [id]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges(formik.values)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [formik.values, hasChanges]);

  // Calculate financial summary
  const financialSummary = {
    monthlyRent: paisaToRupees(tenant?.totalRentPaisa || 0),
    monthlyCam: paisaToRupees(tenant?.camChargesPaisa || 0),
    monthlyTotal: paisaToRupees(tenant?.monthlyTotalPaisa || 0),
    tds: paisaToRupees(tenant?.tdsPaisa || 0),
  };

  const handleCancel = () => {
    if (hasChanges(formik.values)) {
      setShowUnsavedWarning(true);
    } else {
      navigate("/tenants");
    }
  };

  const handleConfirmCancel = () => {
    setShowUnsavedWarning(false);
    navigate("/tenants");
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <Breadcrumb tenantName={tenant?.name} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/tenants")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Tenant</h1>
            <p className="text-muted-foreground">
              Update tenant information and lease details
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4">
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Monthly Total</div>
            <div className="text-xl font-bold">
              Rs.{" "}
              {(financialSummary.monthlyTotal || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Status</div>
            <Badge
              variant={tenant?.status === "active" ? "default" : "secondary"}
            >
              {tenant?.status}
            </Badge>
          </Card>
        </div>
      </div>

      {/* Changes Indicator */}
      {hasChanges(formik.values) && (
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Changes are highlighted in yellow.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Form */}
      <form onSubmit={formik.handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Basic Information</CardTitle>
            </div>
            <CardDescription>
              Personal and contact details of the tenant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TenantBasicInfo
              formik={formik}
              originalTenant={originalTenant}
              showComparison={showComparison}
              changedFields={changedFields}
            />
          </CardContent>
        </Card>

        {/* Section 2: Property Assignment */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Property Assignment</CardTitle>
            </div>
            <CardDescription>
              Which building, floor, and units this tenant occupies — changes here affect billing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TenantPropertyAssignment
              formik={formik}
              originalTenant={originalTenant}
              showComparison={showComparison}
              changedFields={changedFields}
            />
          </CardContent>
        </Card>

        {/* Section 3: Lease Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Lease Information</CardTitle>
            </div>
            <CardDescription>
              Lease dates and important milestones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TenantLeaseInfo
              formik={formik}
              originalTenant={originalTenant}
              showComparison={showComparison}
              changedFields={changedFields}
            />
          </CardContent>
        </Card>

        {/* Section 4: Financial Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <CardTitle>Financial Details</CardTitle>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowFrequencyModal(true)}
                className="shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Change Frequency
                {tenant?.rentPaymentFrequency && (
                  <Badge variant="secondary" className="ml-2 text-xs capitalize">
                    {tenant.rentPaymentFrequency}
                  </Badge>
                )}
              </Button>
            </div>
            <CardDescription>
              Rent, CAM charges, and security deposit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TenantFinancials
              formik={formik}
              originalTenant={originalTenant}
              showComparison={showComparison}
              changedFields={changedFields}
              financialSummary={financialSummary}
            />
          </CardContent>
        </Card>

        {/* Section 5: Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>Documents</CardTitle>
            </div>
            <CardDescription>
              Manage tenant documents and agreements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TenantDocuments
              formik={formik}
              tenantId={id}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          <div className="flex gap-3">
            {hasChanges(formik.values) && (
              <Badge variant="secondary">
                {Object.values(changedFields).filter(Boolean).length} field(s) changed
              </Badge>
            )}

            <Button
              type="submit"
              disabled={isSaving || !formik.isValid || !hasChanges(formik.values)}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>

      {/* Rent Frequency Change Modal */}
      <RentFrequencyModal
        open={showFrequencyModal}
        onOpenChange={setShowFrequencyModal}
        tenantId={id}
        currentFrequency={tenant?.rentPaymentFrequency ?? "monthly"}
        onSuccess={() => fetchTenant()}
      />

      {/* Unsaved Changes Warning Dialog */}
      <Dialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have{" "}
              {Object.values(changedFields).filter(Boolean).length} unsaved change(s).
              Leaving now will discard all of them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnsavedWarning(false)}>
              Continue Editing
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EditTenant;