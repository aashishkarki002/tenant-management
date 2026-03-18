import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ClipboardListIcon } from "lucide-react";
import { toast } from "sonner";
import { TAB_KEYS } from "./constants/tenant.constant";
import { useTenantForm } from "./hooks/useTenantForm";
import { useUnits } from "../../hooks/use-units";
import useProperty from "../../hooks/use-property";
import { useBankAccounts } from "../../Accounts/hooks/useAccounting";
import { PersonalInfoTab } from "./components/PersonalInfoTab";
import { LeaseDetailsTab } from "./components/LeaseDetailsTab";
import { FinancialTab } from "./components/FinancialTab";
import { DocumentsTab } from "./components/DocumentsTab";
import { FinancialTotalsDisplay } from "./components/FinancialTotalsDisplay";
import { StepProgressBar } from "./components/StepProgressBar";

// ── Step definitions ────────────────────────────────────────────────────────
// Order matters — it drives both the progress bar and Next/Previous navigation.
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
      return {
        ok: errors.length === 0,
        errors,
        touch: ["name", "phone", "block"],
      };
    }

    case TAB_KEYS.LEASE_DETAILS: {
      const errors = [];
      if (!Array.isArray(values.unitNumber) || values.unitNumber.length === 0) {
        errors.push("Please select at least one unit.");
      }
      if (!isNonEmptyString(values.dateOfAgreementSigned)) {
        errors.push("Date of agreement signed is required.");
      }
      if (!isNonEmptyString(values.leaseStartDate)) errors.push("Lease start date is required.");
      if (!isNonEmptyString(values.leaseEndDate)) errors.push("Lease end date is required.");
      return {
        ok: errors.length === 0,
        errors,
        touch: ["unitNumber", "dateOfAgreementSigned", "leaseStartDate", "leaseEndDate"],
      };
    }

    case TAB_KEYS.FINANCIAL: {
      const errors = [];
      if (!isNonEmptyString(values.paymentMethod)) errors.push("Rent payment method is required.");

      if (values.paymentMethod === "cheque") {
        if (!isNonEmptyString(String(values.chequeAmount ?? ""))) {
          errors.push("Cheque amount is required.");
        }
        if (!isNonEmptyString(values.chequeNumber)) errors.push("Cheque number is required.");
      }

      // Require per-unit financials for every selected unit.
      // (Lease details already enforces at least one unit.)
      selectedUnitIds.forEach((unitId) => {
        const uf = unitFinancials?.[unitId] || unitFinancials?.[String(unitId)] || {};
        if (!isNonEmptyString(String(uf.sqft ?? ""))) {
          errors.push("Sqft is required for all selected units.");
        }
        if (!isNonEmptyString(String(uf.pricePerSqft ?? ""))) {
          errors.push("Price/Sqft is required for all selected units.");
        }
        if (!isNonEmptyString(String(uf.camPerSqft ?? ""))) {
          errors.push("CAM/Sqft is required for all selected units.");
        }
      });

      if (!isNonEmptyString(values.sdPaymentMethod)) {
        errors.push("Security deposit payment mode is required.");
      }

      const sdMode = values.sdPaymentMethod;
      const sdNeedsBankDetails = sdMode === "bank_transfer" || sdMode === "cheque";
      if (sdNeedsBankDetails && !isNonEmptyString(values.sdBankAccountId)) {
        errors.push("Security deposit bank account is required.");
      }

      if (sdMode === "bank_guarantee" && !values.bankGuaranteePhoto) {
        errors.push("Bank guarantee document is required.");
      }

      return {
        ok: errors.length === 0,
        errors,
        touch: [
          "paymentMethod",
          "chequeAmount",
          "chequeNumber",
          "unitFinancials",
          "sdPaymentMethod",
          "sdBankAccountId",
          "bankGuaranteePhoto",
        ],
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

  // Track every step the user has visited so completed circles show a checkmark
  // and are clickable for back-navigation.
  const [visitedKeys, setVisitedKeys] = useState([STEP_KEYS[0]]);

  const handleSuccess = () => {
    navigate("/tenants");
  };

  const { formik, isLoading } = useTenantForm(property, handleSuccess);

  // ── Navigation helpers ───────────────────────────────────────────────────

  const validateStepOrToast = async (stepKey) => {
    const { ok, errors, touch } = getStepValidation(stepKey, formik.values);
    if (ok) return true;

    // Mark the step’s fields as touched so any inline errors (if present)
    // can show immediately.
    if (touch?.length) {
      const touchedPatch = touch.reduce((acc, k) => {
        acc[k] = true;
        return acc;
      }, {});
      await formik.setTouched({ ...(formik.touched || {}), ...touchedPatch }, true);
    }

    // Avoid spamming duplicate messages (e.g. per-unit loops).
    const uniqueErrors = Array.from(new Set(errors));
    uniqueErrors.forEach((msg) => toast.error(msg));
    return false;
  };

  const goToStep = (key) => {
    const currentIndex = STEP_KEYS.indexOf(activeTab);
    const targetIndex = STEP_KEYS.indexOf(key);

    // Allow moving backwards freely. When moving forward, the current step
    // must be valid (prevents skipping required fields).
    if (targetIndex > currentIndex) {
      validateStepOrToast(activeTab).then((ok) => {
        if (!ok) return;
        setActiveTab(key);
        setVisitedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      });
      return;
    }

    setActiveTab(key);
    // Mark the destination as visited (union — never remove visited keys)
    setVisitedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const handleNext = () => {
    validateStepOrToast(activeTab).then((ok) => {
      if (!ok) return;
      const currentIndex = STEP_KEYS.indexOf(activeTab);
      if (currentIndex < STEP_KEYS.length - 1) {
        goToStep(STEP_KEYS[currentIndex + 1]);
      }
    });
  };

  const handlePrevious = () => {
    const currentIndex = STEP_KEYS.indexOf(activeTab);
    if (currentIndex > 0) {
      goToStep(STEP_KEYS[currentIndex - 1]);
    }
  };

  const handleClose = () => {
    formik.resetForm();
    setActiveTab(STEP_KEYS[0]);
    setVisitedKeys([STEP_KEYS[0]]);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex justify-center items-start min-h-screen bg-gray-50 px-3 sm:px-4 py-4">
      <div className="w-full max-w-5xl">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
          <ClipboardListIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            Add New Tenant
          </h1>
        </div>

        {/* ── Progress Bar ── */}
        <StepProgressBar
          steps={STEPS}
          activeKey={activeTab}
          onStepClick={goToStep}
          completedKeys={visitedKeys}
        />

        {/* ── Form ── */}
        <form onSubmit={formik.handleSubmit}>
          {/*
            We keep shadcn <Tabs> for its TabsContent visibility logic,
            but we no longer render TabsList / TabsTrigger — the
            StepProgressBar above handles all navigation instead.
          */}
          <Tabs value={activeTab} onValueChange={goToStep}>

            <TabsContent value={TAB_KEYS.PERSONAL_INFO}>
              <PersonalInfoTab
                formik={formik}
                property={property}
                onNext={handleNext}
                isNextDisabled={!getStepValidation(TAB_KEYS.PERSONAL_INFO, formik.values).ok}
              />
            </TabsContent>

            <TabsContent value={TAB_KEYS.LEASE_DETAILS}>
              <LeaseDetailsTab
                formik={formik}
                property={property}
                units={units}
                onNext={handleNext}
                onPrevious={handlePrevious}
                isNextDisabled={!getStepValidation(TAB_KEYS.LEASE_DETAILS, formik.values).ok}
              />
            </TabsContent>

            <TabsContent value={TAB_KEYS.FINANCIAL}>
              <FinancialTab
                formik={formik}
                units={units}
                bankAccounts={bankAccounts}
                onNext={handleNext}
                onPrevious={handlePrevious}
                isNextDisabled={!getStepValidation(TAB_KEYS.FINANCIAL, formik.values).ok}
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
      </div>
    </div>
  );
}

export default AddTenants;