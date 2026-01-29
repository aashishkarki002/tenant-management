import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useRentData } from "./hooks/useRentData";
import { usePaymentForm } from "./hooks/usePaymentForm";
import { RentTable } from "./components/RentTable";
import { PaymentsTable } from "./components/PaymentsTable";
import { PaymentFilters } from "./components/PaymentFilters";
import { RentSummaryCard } from "./components/RentSummaryCard";

/**
 * Main component for Rent & Payments dashboard
 * Refactored to use custom hooks and smaller components
 */
const RentPayment = () => {
  const {
    rents,
    filteredRents,
    payments,
    bankAccounts,
    cams,
    totalCollected,
    totalDue,
    loading,
    filterRentMonth,
    setFilterRentMonth,
    filterStartDate,
    filterEndDate,
    filterPaymentMethod,
    setFilterStartDate,
    setFilterEndDate,
    setFilterPaymentMethod,
    getRents,
    getPayments,
    fetchRentSummary,
    getCams,
  } = useRentData();

  const [datePickerResetKey, setDatePickerResetKey] = useState(0);

  const handlePaymentSuccess = async () => {
    await Promise.all([
      getRents(),
      getPayments(),
      fetchRentSummary(),
      getCams(),
    ]);
  };

  const paymentForm = usePaymentForm({
    rents,
    cams,
    onSuccess: handlePaymentSuccess,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    paymentForm.formik.handleSubmit();
  };

  const handleClearFilters = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterPaymentMethod("all");
    setDatePickerResetKey((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="">
        <Tabs defaultValue="rent">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              Rent & Payments
            </CardTitle>
            <TabsList className="mt-4 grid w-full grid-cols-2">
              <TabsTrigger value="rent">Rent</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
            </TabsList>
          </CardHeader>

          <TabsContent value="rent">
            <RentSummaryCard
              totalCollected={totalCollected}
              totalDue={totalDue}
              filterRentMonth={filterRentMonth}
              onMonthChange={setFilterRentMonth}
            />
            <CardContent>
              <RentTable
                rents={filteredRents}
                cams={cams}
                bankAccounts={bankAccounts}
                formik={paymentForm.formik}
                allocationMode={paymentForm.allocationMode}
                setAllocationMode={paymentForm.setAllocationMode}
                rentAllocation={paymentForm.rentAllocation}
                setRentAllocation={paymentForm.setRentAllocation}
                camAllocation={paymentForm.camAllocation}
                setCamAllocation={paymentForm.setCamAllocation}
                selectedBankAccountId={paymentForm.selectedBankAccountId}
                setSelectedBankAccountId={paymentForm.setSelectedBankAccountId}
                handleOpenDialog={paymentForm.handleOpenDialog}
                handleAmountChange={paymentForm.handleAmountChange}
              />
            </CardContent>
          </TabsContent>

          <TabsContent value="payments">
            <div className="px-6 pt-6">
              <CardDescription className="text-gray-500 text-sm">
                View all payment history
              </CardDescription>
            </div>
            <CardContent>
              <PaymentFilters
                filterStartDate={filterStartDate}
                filterEndDate={filterEndDate}
                filterPaymentMethod={filterPaymentMethod}
                setFilterStartDate={setFilterStartDate}
                setFilterEndDate={setFilterEndDate}
                setFilterPaymentMethod={setFilterPaymentMethod}
                datePickerResetKey={datePickerResetKey}
                onReset={handleClearFilters}
              />
              <PaymentsTable payments={payments} />
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </form>
  );
};

export default RentPayment;
