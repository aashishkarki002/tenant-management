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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DualCalendarTailwind from "../../components/dualDate";
import { getPaymentAmounts, normalizeStatus } from "../utils/paymentUtil";


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
  // Optional future extension: list of related rent records for this tenant
  relatedRents,
}) => {
  const { rentAmount, camAmount, totalDue } = getPaymentAmounts(rent, cams);
  const totalAllocated = rentAllocation + camAllocation;
  const balanceOwed = totalDue - totalAllocated;
  const paymentAmount = formik.values?.amount || 0;

  const units = React.useMemo(() => {
    const rawUnits = Array.isArray(rent?.units) && rent.units.length > 0
      ? rent.units
      : [
        {
          _id: rent?._id || "primary-unit",
          name: rent?.unitLabel || "Primary Unit",
        },
      ];

    const unitCount = rawUnits.length || 1;

    return rawUnits.map((unit, index) => {
      const id = unit._id || unit.id || unit.name || String(index);
      const perUnitRent = rentAmount / unitCount;
      const perUnitCam = camAmount / unitCount;
      const perUnitTotal = perUnitRent + perUnitCam;
      const status = normalizeStatus(rent?.status || "");
      const hasOutstanding =
        status !== "paid" && perUnitTotal > 0;

      return {
        id,
        name: unit.name || `Unit ${index + 1}`,
        label:
          unit.name ||
          `${rent?.innerBlock?.name || ""} ${rent?.block?.name || ""}`.trim(),
        rentDue: perUnitRent,
        camDue: perUnitCam,
        totalDue: perUnitTotal,
        hasOutstanding,
      };
    });
  }, [rent, rentAmount, camAmount]);

  const [selectedUnitIds, setSelectedUnitIds] = React.useState(
    units.map((u) => u.id)
  );

  // Re-sync selected units when rent changes (dialog opened for a different row)
  React.useEffect(() => {
    setSelectedUnitIds(units.map((u) => u.id));
  }, [rent?._id, units]);

  const allSelected = selectedUnitIds.length === units.length;
  const hasSelectedUnits = selectedUnitIds.length > 0;

  const isOverAllocated =
    totalAllocated > paymentAmount && paymentAmount > 0;

  const isSubmitDisabled =
    !hasSelectedUnits ||
    isOverAllocated ||
    !paymentAmount ||
    !formik.values?.paymentMethod ||
    !formik.values?.paymentDate;

  const selectedUnits = units.filter((u) =>
    selectedUnitIds.includes(u.id)
  );
  const selectedCount = selectedUnits.length || 1;

  const perUnitRentAllocation =
    selectedCount > 0 ? rentAllocation / selectedCount : 0;
  const perUnitCamAllocation =
    selectedCount > 0 ? camAllocation / selectedCount : 0;

  const effectivePaymentAmount =
    paymentAmount && paymentAmount > 0 ? paymentAmount : totalDue;

  const summaryTone =
    balanceOwed === 0
      ? {
        container:
          "border-emerald-200 bg-emerald-50",
        accent: "text-emerald-700",
      }
      : balanceOwed > 0
        ? {
          container:
            "border-amber-200 bg-amber-50",
          accent: "text-amber-700",
        }
        : {
          container:
            "border-rose-200 bg-rose-50",
          accent: "text-rose-700",
        };

  return (
    <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto bg-slate-50">
      <DialogHeader className="pb-4">
        <DialogTitle className="text-2xl font-semibold text-slate-900">
          Record Payment
        </DialogTitle>
        <p className="text-sm text-slate-500 mt-1">
          Billing Period: {rent.nepaliMonth} {rent.nepaliYear}
        </p>
      </DialogHeader>

      {/* High-level due summary */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2 tracking-wide">
              Rent Due
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              ₹{rentAmount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2 tracking-wide">
              CAM Due
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              ₹{camAmount.toLocaleString()}
            </p>
          </div>
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium text-slate-900">Total Due</p>
          <p className="text-3xl font-semibold text-slate-900">
            ₹{totalDue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* 1️⃣ Select Units */}
      <section className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Select Units
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose one or more units to include in this payment.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900"
              checked={allSelected}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedUnitIds(units.map((u) => u.id));
                } else {
                  setSelectedUnitIds([]);
                }
              }}
            />
            Select all units
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {units.map((unit) => {
            const selected = selectedUnitIds.includes(unit.id);
            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => {
                  setSelectedUnitIds((prev) =>
                    prev.includes(unit.id)
                      ? prev.filter((id) => id !== unit.id)
                      : [...prev, unit.id]
                  );
                }}
                className={`w-full text-left rounded-lg border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 ${selected
                  ? "border-slate-900/80 bg-slate-900/3"
                  : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      readOnly
                      className="mt-1 h-3.5 w-3.5 rounded border-slate-300 text-slate-900 pointer-events-none"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {unit.name}
                      </p>
                      {unit.label && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {unit.label}
                        </p>
                      )}
                    </div>
                  </div>
                  {unit.hasOutstanding && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-300 text-amber-700 bg-amber-50"
                    >
                      Outstanding
                    </Badge>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Rent Due
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      ₹{unit.rentDue.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      CAM Due
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      ₹{unit.camDue.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Total Due
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      ₹{unit.totalDue.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!hasSelectedUnits && (
          <p className="text-xs text-rose-600">
            Select at least one unit to continue.
          </p>
        )}
      </section>

      {/* 2️⃣ Allocation Mode + 3️⃣ / 4️⃣ Mode Content */}
      <section className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Allocation Mode
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Switch between quick full-payment and manual allocation.
            </p>
          </div>
        </div>

        <Tabs
          value={allocationMode}
          onValueChange={setAllocationMode}
          className="space-y-5"
        >
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-0.5 rounded-full">
            <TabsTrigger
              value="auto"
              className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-xs font-medium"
            >
              Quick Payment
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-xs font-medium"
            >
              Custom Allocation
            </TabsTrigger>
          </TabsList>

          {/* 3️⃣ Quick Payment Mode */}
          <TabsContent value="auto" className="space-y-4 pt-2">
            <div className="space-y-2">
              <label
                htmlFor="amount-quick"
                className="text-sm font-semibold text-slate-900"
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
                onBlur={(e) => {
                  if (!e.target.value) {
                    handleAmountChange(totalDue, rent);
                  }
                }}
                className="text-lg"
              />
              <p className="text-xs text-slate-500 mt-1">
                If left blank, full due amount (₹
                {totalDue.toLocaleString()}) will be used.
              </p>
            </div>

            {/* Auto allocation preview per unit */}
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                  Auto allocation preview
                </p>
                <p className="text-xs text-slate-500">
                  Rent first, then CAM across selected units
                </p>
              </div>
              <div className="space-y-2">
                {selectedUnits.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">
                        {unit.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Rent ₹
                        {perUnitRentAllocation.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}{" "}
                        · CAM ₹
                        {perUnitCamAllocation.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                    <span className="font-semibold text-slate-900">
                      ₹
                      {(
                        perUnitRentAllocation + perUnitCamAllocation
                      ).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                ))}
                {!selectedUnits.length && (
                  <p className="text-xs text-slate-500">
                    Select at least one unit to see allocation.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 4️⃣ Custom Allocation Mode */}
          <TabsContent value="manual" className="space-y-4 pt-2">
            <div className="space-y-2">
              <label
                htmlFor="amount-manual"
                className="text-sm font-semibold text-slate-900"
              >
                Total Amount to Pay (Rs)
              </label>
              <Input
                id="amount-manual"
                type="number"
                placeholder="Enter total payment amount"
                value={formik.values?.amount || ""}
                onChange={(e) =>
                  formik.setFieldValue(
                    "amount",
                    parseFloat(e.target.value) || 0
                  )
                }
                className="text-lg"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="rent-allocation"
                  className="text-sm font-semibold text-slate-900"
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
                <p className="text-xs text-slate-500">
                  Rent due: ₹{rentAmount.toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="cam-allocation"
                  className="text-sm font-semibold text-slate-900"
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
                <p className="text-xs text-slate-500">
                  CAM due: ₹{camAmount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Allocation across selected units
              </p>
              <p className="text-xs text-slate-500">
                Rent and CAM allocations apply to all selected units in this
                billing cycle.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* 5️⃣ Payment Details */}
      <section className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <p className="text-sm font-semibold text-slate-900">
          Payment Details
        </p>

        {/* Payment Method */}
        <div className="space-y-2">
          <label
            htmlFor="payment-method"
            className="text-sm font-medium text-slate-900"
          >
            Payment Method
          </label>
          <Select
            value={formik.values?.paymentMethod || ""}
            onValueChange={(value) =>
              formik.setFieldValue("paymentMethod", value)
            }
          >
            <SelectTrigger id="payment-method">
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bank Accounts when Bank Transfer */}
        {formik.values?.paymentMethod === "bank_transfer" && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-900">
              Deposit To
            </label>
            <div className="grid gap-3">
              {bankAccounts.map((bank) => (
                <button
                  key={bank._id}
                  type="button"
                  onClick={() => {
                    setSelectedBankAccountId(bank._id);
                    formik.setFieldValue("bankAccountId", bank._id);
                  }}
                  className={`w-full text-left p-4 border-2 rounded-lg cursor-pointer transition-colors ${selectedBankAccountId === bank._id
                    ? "border-slate-900 bg-slate-900/3"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        {bank.bankName}
                      </p>
                      <p className="text-xs text-slate-500">
                        **** **** {bank.accountNumber?.slice(-4) || "****"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                        Balance
                      </p>
                      <p className="font-semibold text-slate-900 text-sm">
                        ₹{bank.balance?.toLocaleString() || "0"}
                      </p>
                    </div>
                    {selectedBankAccountId === bank._id && (
                      <div className="ml-3 text-slate-900">
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
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Payment Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">
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
            htmlFor="transaction-ref"
            className="text-sm font-medium text-slate-900"
          >
            Transaction Reference{" "}
            <span className="text-slate-500 font-normal">(Optional)</span>
          </label>
          <Input
            id="transaction-ref"
            placeholder="e.g., CHQ-12345 or Bank Ref ID"
            value={formik.values?.transactionRef || ""}
            onChange={(e) =>
              formik.setFieldValue("transactionRef", e.target.value)
            }
          />
        </div>
      </section>

      {/* 6️⃣ Final Summary Card */}
      <section
        className={`mt-6 mb-2 rounded-xl border px-5 py-4 ${summaryTone.container}`}
      >
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Final Summary
            </p>
            <p className={`text-xs font-medium ${summaryTone.accent}`}>
              {balanceOwed < 0
                ? "Allocation exceeds total due. Reduce the amount or allocations."
                : balanceOwed === 0
                  ? "Fully allocated. This payment clears the selected dues."
                  : "Partially allocated. Remaining balance will stay outstanding."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-right min-w-[260px]">
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                Total Due
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                ₹{totalDue.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                Total Allocated
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                ₹{totalAllocated.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                Remaining Balance
              </p>
              <p
                className={`mt-1 text-base font-semibold ${summaryTone.accent}`}
              >
                ₹{balanceOwed.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      <DialogFooter className="mt-2 border-t border-slate-200 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {(!hasSelectedUnits || isOverAllocated) && (
          <div className="text-xs text-rose-600">
            {!hasSelectedUnits && (
              <p>Select at least one unit before submitting.</p>
            )}
            {isOverAllocated && (
              <p>
                Allocation total cannot exceed the payment amount. Adjust rent
                or CAM allocation.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitDisabled}
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
        </div>
      </DialogFooter>
    </DialogContent>
  );
};
