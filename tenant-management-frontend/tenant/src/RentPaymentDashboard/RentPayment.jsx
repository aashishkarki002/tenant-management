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
    paymentsLoading,
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
  const [frequencyView, setFrequencyView] = useState("monthly");

  const monthlyTarget = totalCollected + totalDue;
  const collectedPercentage =
    monthlyTarget > 0 ? Math.round((totalCollected / monthlyTarget) * 100) : 0;

  const formatCurrency = (value) =>
    value?.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const frequencyFilteredRents = filteredRents.filter((rent) => {
    const rawFrequency =
      rent.rentFrequency || rent.tenant?.rentPaymentFrequency;
    const frequency = rawFrequency?.toLowerCase();
    if (!frequency) return false;
    return frequencyView === "monthly"
      ? frequency === "monthly"
      : frequency === "quarterly";
  });

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
            <TabsList className="mt-4 grid w-full grid-cols-2">
              <TabsTrigger value="rent">Rent</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
            </TabsList>
            <div className="mt-4">
              <Tabs value={frequencyView} onValueChange={setFrequencyView}>
                <TabsList className="grid w-fit grid-cols-2">
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
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
                rents={frequencyFilteredRents}
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
              <CardTitle className=" font-bold text-xl">
                View all payment history
              </CardTitle>
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
              {paymentsLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Loading payments...
                </div>
              ) : (
                <PaymentsTable payments={payments} />
              )}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card >
    </form >
  );
};

export default RentPayment;
