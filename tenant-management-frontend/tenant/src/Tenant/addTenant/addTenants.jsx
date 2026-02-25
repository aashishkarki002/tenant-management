import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function AddTenants() {
  const { units } = useUnits();
  const { property } = useProperty();
  const { bankAccounts } = useBankAccounts();
  const [activeTab, setActiveTab] = useState(TAB_KEYS.PERSONAL_INFO);

  const handleSuccess = (data) => {
    // Handle success - navigate away, reset form, etc.
    console.log("Tenant created:", data);
  };

  const { formik, isLoading } = useTenantForm(property, handleSuccess);

  const handleNext = () => {
    const tabs = Object.values(TAB_KEYS);
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const tabs = Object.values(TAB_KEYS);
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  const handleClose = () => {
    formik.resetForm();
    // Add navigation logic here
  };

  return (
    <div className="flex justify-center items-start min-h-screen bg-gray-50 px-3 sm:px-4 py-4">
      <div className="w-full max-w-5xl">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <ClipboardListIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            Add New Tenant
          </h1>
        </div>

        <form onSubmit={formik.handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>

            {/* Tabs List → scrollable on mobile */}
            <TabsList className="flex w-full overflow-x-auto no-scrollbar sm:grid sm:grid-cols-4">
              <TabsTrigger
                className="flex-1 min-w-[140px] sm:min-w-0"
                value={TAB_KEYS.PERSONAL_INFO}
              >
                Personal Info
              </TabsTrigger>

              <TabsTrigger
                className="flex-1 min-w-[140px] sm:min-w-0"
                value={TAB_KEYS.LEASE_DETAILS}
              >
                Lease Details
              </TabsTrigger>

              <TabsTrigger
                className="flex-1 min-w-[120px] sm:min-w-0"
                value={TAB_KEYS.FINANCIAL}
              >
                Financial
              </TabsTrigger>

              <TabsTrigger
                className="flex-1 min-w-[120px] sm:min-w-0"
                value={TAB_KEYS.DOCUMENTS}
              >
                Documents
              </TabsTrigger>
            </TabsList>

            {/* Tab Contents */}
            <div className="mt-4 sm:mt-6">
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
            </div>
          </Tabs>
        </form>
      </div>
    </div>
  );
}

export default AddTenants;