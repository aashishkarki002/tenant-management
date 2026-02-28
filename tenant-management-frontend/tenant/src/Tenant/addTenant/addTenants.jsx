import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ClipboardListIcon } from "lucide-react";
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

function AddTenants() {
  const { units } = useUnits();
  const { property } = useProperty();
  const { bankAccounts } = useBankAccounts();

  const [activeTab, setActiveTab] = useState(STEP_KEYS[0]);

  // Track every step the user has visited so completed circles show a checkmark
  // and are clickable for back-navigation.
  const [visitedKeys, setVisitedKeys] = useState([STEP_KEYS[0]]);

  const handleSuccess = (data) => {
    console.log("Tenant created:", data);
  };

  const { formik, isLoading } = useTenantForm(property, handleSuccess);

  // ── Navigation helpers ───────────────────────────────────────────────────

  const goToStep = (key) => {
    setActiveTab(key);
    // Mark the destination as visited (union — never remove visited keys)
    setVisitedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const handleNext = () => {
    const currentIndex = STEP_KEYS.indexOf(activeTab);
    if (currentIndex < STEP_KEYS.length - 1) {
      goToStep(STEP_KEYS[currentIndex + 1]);
    }
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
              />
            </TabsContent>

            <TabsContent value={TAB_KEYS.LEASE_DETAILS}>
              <LeaseDetailsTab
                formik={formik}
                property={property}
                units={units}
                onNext={handleNext}
                onPrevious={handlePrevious}
              />
            </TabsContent>

            <TabsContent value={TAB_KEYS.FINANCIAL}>
              <FinancialTab
                formik={formik}
                units={units}
                bankAccounts={bankAccounts}
                onNext={handleNext}
                onPrevious={handlePrevious}
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