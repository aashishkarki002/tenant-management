import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ClipboardListIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TAB_KEYS } from "./constants/tenant.constant";
import { useTenantForm } from "./hooks/useTenantForm";
import { useUnits } from "../../hooks/use-units";
import useProperty from "../../hooks/use-property";
import { useBankAccounts } from "../../Accounts/hooks/useAccounting";
import { PersonalInfoTab } from "./components/PersonalInfoTab";
import { LeaseDetailsTab } from "./components/LeaseDetailsTab";
import { FinancialTab } from "./components/FinancialTab";
import { DocumentsTab } from "./components/DocumentsTab";
import { StepProgressBar } from "./components/StepProgressBar";

const STEPS = [
  { key: TAB_KEYS.PERSONAL_INFO, label: "Personal Info" },
  { key: TAB_KEYS.LEASE_DETAILS, label: "Lease Details" },
  { key: TAB_KEYS.FINANCIAL, label: "Financial" },
  { key: TAB_KEYS.DOCUMENTS, label: "Documents" },
];

const STEP_KEYS = STEPS.map((s) => s.key);

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

function getStepValidation(stepKey, values) {
  const selectedUnitIds = Array.isArray(values.unitNumber) ? values.unitNumber : [];
  const unitFinancials = values.unitFinancials || {};

  switch (stepKey) {
    case TAB_KEYS.PERSONAL_INFO: {
      const errors = [];
      if (!isNonEmptyString(values.name)) errors.push("Tenant name is required.");
      if (!isNonEmptyString(values.phone)) errors.push("Phone number is required.");
      if (!isNonEmptyString(values.block)) errors.push("Building is required.");
      return { ok: errors.length === 0, errors, touch: ["name", "phone", "block"] };
    }

    case TAB_KEYS.LEASE_DETAILS: {
      const errors = [];
      if (!Array.isArray(values.unitNumber) || values.unitNumber.length === 0)
        errors.push("Please select at least one unit.");
      if (!isNonEmptyString(values.dateOfAgreementSigned))
        errors.push("Date of agreement signed is required.");
      if (!isNonEmptyString(values.leaseStartDate)) errors.push("Lease start date is required.");
      if (!isNonEmptyString(values.leaseEndDate)) errors.push("Lease end date is required.");
      return {
        ok: errors.length === 0, errors,
        touch: ["unitNumber", "dateOfAgreementSigned", "leaseStartDate", "leaseEndDate"],
      };
    }

    case TAB_KEYS.FINANCIAL: {
      const errors = [];
      if (!isNonEmptyString(values.paymentMethod)) errors.push("Rent payment method is required.");

      if (values.paymentMethod === "cheque") {
        if (!isNonEmptyString(String(values.chequeAmount ?? "")))
          errors.push("Cheque amount is required.");
        if (!isNonEmptyString(values.chequeNumber))
          errors.push("Cheque number is required.");
      }

      selectedUnitIds.forEach((unitId) => {
        const uf = unitFinancials?.[unitId] || unitFinancials?.[String(unitId)] || {};
        if (!isNonEmptyString(String(uf.sqft ?? "")))
          errors.push("Sqft is required for all selected units.");
        if (!isNonEmptyString(String(uf.pricePerSqft ?? "")))
          errors.push("Price/Sqft is required for all selected units.");
        if (!isNonEmptyString(String(uf.camPerSqft ?? "")))
          errors.push("CAM/Sqft is required for all selected units.");
      });

      if (!isNonEmptyString(values.sdPaymentMethod))
        errors.push("Security deposit payment mode is required.");

      const sdMode = values.sdPaymentMethod;
      if ((sdMode === "bank_transfer" || sdMode === "cheque") && !isNonEmptyString(values.sdBankAccountId))
        errors.push("Security deposit bank account is required.");

      if (sdMode === "bank_guarantee" && !values.bankGuaranteePhoto)
        errors.push("Bank guarantee document is required.");

      return {
        ok: errors.length === 0, errors,
        touch: ["paymentMethod", "chequeAmount", "chequeNumber", "unitFinancials", "sdPaymentMethod", "sdBankAccountId", "bankGuaranteePhoto"],
      };
    }

    default:
      return { ok: true, errors: [], touch: [] };
  }
}

function AddTenants() {
  const navigate = useNavigate();
  const { units } = useUnits();
  const { property } = useProperty();
  const { bankAccounts } = useBankAccounts();

  const [activeTab, setActiveTab] = useState(STEP_KEYS[0]);
  const [visitedKeys, setVisitedKeys] = useState([STEP_KEYS[0]]);

  // Persistent errors for the currently active step — shown inside the tab card
  const [activeStepErrors, setActiveStepErrors] = useState([]);

  // Discard confirmation dialog
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const handleSuccess = () => navigate("/tenants");
  const { formik, isLoading } = useTenantForm(property, handleSuccess);

  // Prefill sqft from unit.actualSquareFeet when a unit is selected
  const prevUnitIdsRef = useRef([]);
  useEffect(() => {
    const selectedIds = Array.isArray(formik.values.unitNumber) ? formik.values.unitNumber : [];
    const prevIds = prevUnitIdsRef.current;
    const newlyAdded = selectedIds.filter((id) => !prevIds.includes(id));

    if (newlyAdded.length > 0 && units) {
      const patch = { ...formik.values.unitFinancials };
      let changed = false;
      newlyAdded.forEach((unitId) => {
        const unit = units.find((u) => u._id === unitId);
        if (unit?.actualSquareFeet && !patch[unitId]?.sqft) {
          patch[unitId] = { ...patch[unitId], sqft: String(unit.actualSquareFeet) };
          changed = true;
        }
      });
      if (changed) formik.setFieldValue("unitFinancials", patch);
    }

    prevUnitIdsRef.current = selectedIds;
  }, [formik.values.unitNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step error state for the progress bar ───────────────────────────────
  // Build a map of stepKey → boolean for visited steps that currently fail validation
  const stepErrorMap = visitedKeys.reduce((acc, key) => {
    if (key === activeTab) return acc; // active step handled separately
    const { ok } = getStepValidation(key, formik.values);
    acc[key] = !ok;
    return acc;
  }, {});

  // ── Navigation helpers ───────────────────────────────────────────────────

  const validateStepOrToast = async (stepKey) => {
    const { ok, errors, touch } = getStepValidation(stepKey, formik.values);

    if (touch?.length) {
      const patch = touch.reduce((acc, k) => { acc[k] = true; return acc; }, {});
      await formik.setTouched({ ...(formik.touched || {}), ...patch }, true);
    }

    // Persist errors in the card (don't rely solely on toasts)
    setActiveStepErrors(ok ? [] : Array.from(new Set(errors)));

    if (!ok) {
      // Still fire one summarising toast so the user notices
      toast.error(`Please complete all required fields before continuing.`);
    }

    return ok;
  };

  const goToStep = (key) => {
    const currentIndex = STEP_KEYS.indexOf(activeTab);
    const targetIndex = STEP_KEYS.indexOf(key);

    if (targetIndex > currentIndex) {
      validateStepOrToast(activeTab).then((ok) => {
        if (!ok) return;
        setActiveStepErrors([]);
        setActiveTab(key);
        setVisitedKeys((prev) => prev.includes(key) ? prev : [...prev, key]);
      });
      return;
    }

    setActiveStepErrors([]);
    setActiveTab(key);
    setVisitedKeys((prev) => prev.includes(key) ? prev : [...prev, key]);
  };

  const handleNext = () => {
    validateStepOrToast(activeTab).then((ok) => {
      if (!ok) return;
      setActiveStepErrors([]);
      const currentIndex = STEP_KEYS.indexOf(activeTab);
      if (currentIndex < STEP_KEYS.length - 1) {
        goToStep(STEP_KEYS[currentIndex + 1]);
      }
    });
  };

  const handlePrevious = () => {
    setActiveStepErrors([]);
    const currentIndex = STEP_KEYS.indexOf(activeTab);
    if (currentIndex > 0) goToStep(STEP_KEYS[currentIndex - 1]);
  };

  // Show discard dialog instead of immediately resetting
  const handleClose = () => setShowDiscardDialog(true);

  const confirmDiscard = () => {
    formik.resetForm();
    setActiveTab(STEP_KEYS[0]);
    setVisitedKeys([STEP_KEYS[0]]);
    setActiveStepErrors([]);
    setShowDiscardDialog(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex justify-center items-start min-h-screen bg-background px-3 sm:px-4 py-4">
      <div className="w-full max-w-5xl">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
          <ClipboardListIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            Add New Tenant
          </h1>
        </div>

        {/* Progress Bar — now receives stepErrorMap */}
        <StepProgressBar
          steps={STEPS}
          activeKey={activeTab}
          onStepClick={goToStep}
          completedKeys={visitedKeys}
          stepErrors={stepErrorMap}
        />

        {/* Form */}
        <form onSubmit={formik.handleSubmit}>
          <Tabs value={activeTab} onValueChange={goToStep}>

            <TabsContent value={TAB_KEYS.PERSONAL_INFO}>
              <PersonalInfoTab
                formik={formik}
                property={property}
                onNext={handleNext}
                stepErrors={activeTab === TAB_KEYS.PERSONAL_INFO ? activeStepErrors : []}
              />
            </TabsContent>

            <TabsContent value={TAB_KEYS.LEASE_DETAILS}>
              <LeaseDetailsTab
                formik={formik}
                property={property}
                units={units}
                onNext={handleNext}
                onPrevious={handlePrevious}
                stepErrors={activeTab === TAB_KEYS.LEASE_DETAILS ? activeStepErrors : []}
              />
            </TabsContent>

            <TabsContent value={TAB_KEYS.FINANCIAL}>
              <FinancialTab
                formik={formik}
                units={units}
                bankAccounts={bankAccounts}
                onNext={handleNext}
                onPrevious={handlePrevious}
                stepErrors={activeTab === TAB_KEYS.FINANCIAL ? activeStepErrors : []}
              />
            </TabsContent>

            <TabsContent value={TAB_KEYS.DOCUMENTS}>
              <DocumentsTab
                formik={formik}
                isLoading={isLoading}
                onPrevious={handlePrevious}
                onClose={handleClose}
              />
            </TabsContent>

          </Tabs>
        </form>

        {/* Discard confirmation dialog */}
        <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard all changes?</AlertDialogTitle>
              <AlertDialogDescription>
                All tenant information entered across all steps will be lost.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={confirmDiscard}
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}

export default AddTenants;