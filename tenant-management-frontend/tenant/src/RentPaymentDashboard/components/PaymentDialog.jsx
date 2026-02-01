import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DualCalendarTailwind from "../../components/dualDate";
import { getPaymentAmounts } from "../utils/paymentUtil";


export const PaymentDialog = ({
  rent,
  cams,
  bankAccounts,
  formik,
  allocationMode,
  setAllocationMode,
  rentAllocation,
  setRentAllocation,
  camAllocation,
  setCamAllocation,
  selectedBankAccountId,
  setSelectedBankAccountId,
  handleAmountChange,
  onClose,
}) => {
  const { rentAmount, camAmount, totalDue } = getPaymentAmounts(rent, cams);
  const totalAllocated = rentAllocation + camAllocation;
  const balanceOwed = totalDue - totalAllocated;

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader className="pb-4">
        <DialogTitle className="text-2xl font-bold">Record Payment</DialogTitle>
        <p className="text-sm text-gray-600 mt-1">
          Billing Period: {rent.nepaliMonth} {rent.nepaliYear}
        </p>
      </DialogHeader>

      {/* Summary Card - Shows what's due */}
      <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
              Rent Amount
            </p>
            <p className="text-2xl font-bold text-gray-900">
              ₹{rentAmount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
              CAM Charges
            </p>
            <p className="text-2xl font-bold text-gray-900">
              ₹{camAmount.toLocaleString()}
            </p>
          </div>
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          <p className="text-sm font-semibold text-gray-900">
            Total Amount Due
          </p>
          <p className="text-3xl font-bold text-blue-600">
            ₹{totalDue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Payment Method Tabs */}
      <Tabs
        value={allocationMode}
        onValueChange={setAllocationMode}
        className="mt-6 space-y-5"
      >
        <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1">
          <TabsTrigger
            value="auto"
            className="rounded data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Quick Payment
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            className="rounded data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Custom Allocation
          </TabsTrigger>
        </TabsList>

        {/* Quick Payment Tab - Auto allocates based on amount */}
        <TabsContent value="auto" className="space-y-5 mt-6">
          <div className="space-y-2">
            <label
              htmlFor="amount-quick"
              className="text-sm font-semibold text-gray-900"
            >
              Amount to Pay (Rs)
            </label>
            <Input
              id="amount-quick"
              type="number"
              placeholder="Enter payment amount"
              value={formik.values?.amount || ""}
              onChange={(e) =>
                handleAmountChange(parseFloat(e.target.value) || 0, rent)
              }
              className="text-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default: ₹{totalDue.toLocaleString()}
            </p>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label
              htmlFor="method-quick"
              className="text-sm font-semibold text-gray-900"
            >
              Payment Method
            </label>
            <Select
              value={formik.values?.paymentMethod || ""}
              onValueChange={(value) =>
                formik.setFieldValue("paymentMethod", value)
              }
            >
              <SelectTrigger id="method-quick">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>

                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bank Account Selection */}
          {formik.values?.paymentMethod === "bank_transfer" && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-900">
                Deposit To
              </label>
              <div className="grid gap-3">
                {bankAccounts.map((bank) => (
                  <div
                    key={bank._id}
                    onClick={() => {
                      setSelectedBankAccountId(bank._id);
                      formik.setFieldValue("bankAccountId", bank._id);
                    }}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedBankAccountId === bank._id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {bank.bankName}
                        </p>
                        <p className="text-sm text-gray-500">
                          **** **** {bank.accountNumber?.slice(-4) || "****"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 font-semibold">
                          BALANCE
                        </p>
                        <p className="font-semibold text-gray-900">
                          ₹{bank.balance?.toLocaleString() || "0"}
                        </p>
                      </div>
                      {selectedBankAccountId === bank._id && (
                        <div className="ml-3 text-blue-600">
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Date */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900">
              Payment Date
            </label>
            <DualCalendarTailwind
              onChange={(english, nepali) => {
                if (english && nepali) {
                  formik.setFieldValue("paymentDate", new Date(english));
                  formik.setFieldValue("nepaliDate", nepali);
                } else {
                  formik.setFieldValue("paymentDate", null);
                  formik.setFieldValue("nepaliDate", null);
                }
              }}
            />
          </div>

          {/* Transaction Reference */}
          <div className="space-y-2">
            <label
              htmlFor="ref-quick"
              className="text-sm font-semibold text-gray-900"
            >
              Transaction Reference{" "}
              <span className="text-gray-500">(Optional)</span>
            </label>
            <Input
              id="ref-quick"
              placeholder="e.g., CHQ-12345 or Bank Ref ID"
              value={formik.values?.transactionRef || ""}
              onChange={(e) =>
                formik.setFieldValue("transactionRef", e.target.value)
              }
            />
          </div>

          {/* Allocation Summary */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg space-y-3">
            <p className="text-sm font-bold text-gray-900 uppercase">
              Allocation Summary
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Rent Allocation</span>
                <span className="font-semibold text-gray-900">
                  ₹{rentAllocation.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">CAM Allocation</span>
                <span className="font-semibold text-gray-900">
                  ₹{camAllocation.toLocaleString()}
                </span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  Total Allocated
                </span>
                <span className="font-bold text-gray-900">
                  ₹{totalAllocated.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  Balance Owed
                </span>
                <span
                  className={`font-bold ${balanceOwed === 0 ? "text-green-600" : "text-orange-600"
                    }`}
                >
                  ₹{balanceOwed.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Custom Allocation Tab - Manual allocation */}
        <TabsContent value="manual" className="space-y-5 mt-6">
          <div className="space-y-2">
            <label
              htmlFor="amount-manual"
              className="text-sm font-semibold text-gray-900"
            >
              Total Amount to Pay (Rs)
            </label>
            <Input
              id="amount-manual"
              type="number"
              placeholder="Enter total payment amount"
              value={formik.values?.amount || ""}
              onChange={(e) =>
                formik.setFieldValue("amount", parseFloat(e.target.value) || 0)
              }
              className="text-lg"
            />
          </div>

          {/* Manual Rent Allocation */}
          <div className="space-y-2">
            <label
              htmlFor="rent-allocation"
              className="text-sm font-semibold text-gray-900"
            >
              Allocate to Rent (Rs)
            </label>
            <Input
              id="rent-allocation"
              type="number"
              placeholder="Rent amount"
              value={rentAllocation}
              onChange={(e) =>
                setRentAllocation(parseFloat(e.target.value) || 0)
              }
            />
            <p className="text-xs text-gray-500">
              Rent due: ₹{rentAmount.toLocaleString()}
            </p>
          </div>

          {/* Manual CAM Allocation */}
          <div className="space-y-2">
            <label
              htmlFor="cam-allocation"
              className="text-sm font-semibold text-gray-900"
            >
              Allocate to CAM (Rs)
            </label>
            <Input
              id="cam-allocation"
              type="number"
              placeholder="CAM amount"
              value={camAllocation}
              onChange={(e) =>
                setCamAllocation(parseFloat(e.target.value) || 0)
              }
            />
            <p className="text-xs text-gray-500">
              CAM due: ₹{camAmount.toLocaleString()}
            </p>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label
              htmlFor="method-manual"
              className="text-sm font-semibold text-gray-900"
            >
              Payment Method
            </label>
            <Select
              value={formik.values?.paymentMethod || ""}
              onValueChange={(value) =>
                formik.setFieldValue("paymentMethod", value)
              }
            >
              <SelectTrigger id="method-manual">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bank Account Selection */}
          {formik.values?.paymentMethod === "bank_transfer" && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-900">
                Deposit To
              </label>
              <div className="grid gap-3">
                {bankAccounts.map((bank) => (
                  <div
                    key={bank._id}
                    onClick={() => {
                      setSelectedBankAccountId(bank._id);
                      formik.setFieldValue("bankAccountId", bank._id);
                    }}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedBankAccountId === bank._id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {bank.bankName}
                        </p>
                        <p className="text-sm text-gray-500">
                          **** **** {bank.accountNumber?.slice(-4) || "****"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 font-semibold">
                          BALANCE
                        </p>
                        <p className="font-semibold text-gray-900">
                          ₹{bank.balance?.toLocaleString() || "0"}
                        </p>
                      </div>
                      {selectedBankAccountId === bank._id && (
                        <div className="ml-3 text-blue-600">
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Date */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900">
              Payment Date
            </label>
            <DualCalendarTailwind
              onChange={(english, nepali) => {
                if (english && nepali) {
                  formik.setFieldValue("paymentDate", new Date(english));
                  formik.setFieldValue("nepaliDate", nepali);
                } else {
                  formik.setFieldValue("paymentDate", null);
                  formik.setFieldValue("nepaliDate", null);
                }
              }}
            />
          </div>

          {/* Transaction Reference */}
          <div className="space-y-2">
            <label
              htmlFor="ref-manual"
              className="text-sm font-semibold text-gray-900"
            >
              Transaction Reference{" "}
              <span className="text-gray-500">(Optional)</span>
            </label>
            <Input
              id="ref-manual"
              placeholder="e.g., CHQ-12345 or Bank Ref ID"
              value={formik.values?.transactionRef || ""}
              onChange={(e) =>
                formik.setFieldValue("transactionRef", e.target.value)
              }
            />
          </div>

          {/* Allocation Summary */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg space-y-3">
            <p className="text-sm font-bold text-gray-900 uppercase">
              Allocation Summary
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Rent Allocation</span>
                <span className="font-semibold text-gray-900">
                  ₹{rentAllocation.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">CAM Allocation</span>
                <span className="font-semibold text-gray-900">
                  ₹{camAllocation.toLocaleString()}
                </span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  Total Allocated
                </span>
                <span className="font-bold text-gray-900">
                  ₹{totalAllocated.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  Balance Owed
                </span>
                <span
                  className={`font-bold ${balanceOwed === 0 ? "text-green-600" : "text-orange-600"
                    }`}
                >
                  ₹{balanceOwed.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={async (e) => {
            e.preventDefault();
            await formik.handleSubmit();
            if (formik.isValid) {
              onClose();
            }
          }}
        >
          Submit Payment
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
