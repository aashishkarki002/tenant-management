import { useState } from "react";
import { useFormik } from "formik";
import { toast } from "sonner";
import api from "../../../plugins/axios";
import { getPaymentAmounts } from "../utils/paymentUtil";
import {
  normalizeLedgerPaymentMethod,
  paymentMethodRequiresBankAccount,
} from "@/constants/paymentMethods.js";

// Distribute `budget` rupees proportionally across electricity records with
// outstanding balances. Returns [{electricityId, amount}] with amount > 0 only.
function buildElecAllocations(records, budget) {
  if (!records?.length || budget <= 0) return [];
  const totalDue = records.reduce((s, r) => {
    const due = r.remainingAmount ?? Math.max(0, (r.totalAmount || 0) - (r.paidAmount || 0));
    return s + due;
  }, 0);
  if (totalDue <= 0) return [];

  const cappedBudget = Math.min(budget, totalDue);
  let remaining = cappedBudget;
  const result = [];

  records.forEach((r, i) => {
    const due = r.remainingAmount ?? Math.max(0, (r.totalAmount || 0) - (r.paidAmount || 0));
    if (due <= 0) return;
    let alloc;
    if (i === records.length - 1) {
      alloc = remaining;
    } else {
      alloc = Math.round((due / totalDue) * cappedBudget * 100) / 100;
      alloc = Math.min(alloc, due, remaining);
    }
    if (alloc > 0) {
      result.push({ electricityId: r._id, amount: alloc });
      remaining -= alloc;
    }
  });

  return result;
}

function getElecTotal(records) {
  return (records || []).reduce((s, r) => {
    return s + (r.remainingAmount ?? Math.max(0, (r.totalAmount || 0) - (r.paidAmount || 0)));
  }, 0);
}

export const usePaymentForm = ({ cams, onSuccess }) => {
  const [allocationMode, setAllocationMode] = useState("auto");
  const [rentAllocation, setRentAllocation] = useState(0);
  const [camAllocation, setCamAllocation] = useState(0);
  const [lateFeeAllocation, setLateFeeAllocation] = useState(0);
  const [electricityAllocations, setElectricityAllocations] = useState([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");

  const totalElectricityAllocation = electricityAllocations.reduce(
    (s, a) => s + (a.amount || 0),
    0,
  );

  const formik = useFormik({
    initialValues: {
      tenantId: "",
      rentId: "",
      amount: 0,
      paymentDate: null,
      nepaliDate: null,
      paymentMethod: "",
      paymentStatus: "paid",
      bankAccountId: "",
      bankAccountCode: "",
      transactionRef: "",
      note: "",
      allocations: {},
    },

    onSubmit: async (values) => {
      try {
        const payload = {
          tenantId: values.tenantId,
          amount: values.amount,
          paymentDate: values.paymentDate,
          nepaliDate: values.nepaliDate,
          paymentMethod: normalizeLedgerPaymentMethod(values.paymentMethod, ""),
          paymentStatus: values.paymentStatus || "paid",
          note: values.note || "",
          bankAccountId: values.bankAccountId || null,
          bankAccountCode: values.bankAccountCode || null,
          transactionRef: values.transactionRef || null,
          allocations: values.allocations,
          chequeNumber: values.chequeNumber || null,
          partyName: values.chequeAccountName || null,
        };

        const hasElectricity =
          Array.isArray(payload.allocations?.electricity) &&
          payload.allocations.electricity.length > 0;

        if (
          !payload.allocations?.rent &&
          !payload.allocations?.cam &&
          !payload.allocations?.lateFee &&
          !hasElectricity
        ) {
          toast.error("No allocations found. Please try again.");
          return;
        }

        if (
          paymentMethodRequiresBankAccount(payload.paymentMethod) &&
          !payload.bankAccountCode
        ) {
          toast.error("Please select a bank account to continue.");
          return;
        }

        const response = await api.post(
          "/api/payment/pay-rent-and-cam",
          payload,
        );

        if (response.data.success) {
          toast.success(response.data.message);
          resetForm();
          onSuccess?.();
        } else {
          toast.error(response.data.message || "Payment failed.");
        }
      } catch (error) {
        console.error("Payment submission error:", error);
        toast.error(
          error?.response?.data?.message ||
            "Failed to submit payment. Please try again.",
        );
      }
    },
  });

  const resetForm = () => {
    formik.resetForm();
    setRentAllocation(0);
    setCamAllocation(0);
    setLateFeeAllocation(0);
    setElectricityAllocations([]);
    setSelectedBankAccountId("");
    setAllocationMode("auto");
  };

  /**
   * Seeds formik + allocation state when a payment dialog opens.
   * Accepts optional electricityRecords for the tenant/month to pre-fill.
   */
  const handleOpenDialog = (rent, electricityRecords = []) => {
    const { rentAmount, camAmount, lateFeeAmount } = getPaymentAmounts(rent, cams);
    const electricityTotal = getElecTotal(electricityRecords);
    const total = rentAmount + camAmount + lateFeeAmount + electricityTotal;

    formik.setValues({
      ...formik.initialValues,
      rentId: rent._id.toString(),
      tenantId: rent.tenant?._id?.toString() || rent.tenant?.toString() || "",
      amount: total,
      paymentMethod: formik.values.paymentMethod || "",
      bankAccountCode: "",
    });

    setAllocationMode("auto");
    setRentAllocation(rentAmount);
    setCamAllocation(camAmount);
    setLateFeeAllocation(lateFeeAmount);
    setElectricityAllocations(buildElecAllocations(electricityRecords, electricityTotal));
    setSelectedBankAccountId("");
  };

  /**
   * Amount input change — auto-allocates using priority order:
   *   1. Rent principal (senior)
   *   2. CAM
   *   3. Electricity (proportional across unpaid records)
   *   4. Late fee (full-or-nothing: either all or zero — never partial)
   */
  const handleAmountChange = (amount, rent, electricityRecords = []) => {
    formik.setFieldValue("amount", amount);

    if (allocationMode === "auto" && rent) {
      const { rentAmount, camAmount, lateFeeAmount } = getPaymentAmounts(rent, cams);
      const electricityTotal = getElecTotal(electricityRecords);
      const rentAndCam = rentAmount + camAmount;
      const rentCamElec = rentAndCam + electricityTotal;
      const totalDue = rentCamElec + lateFeeAmount;

      if (amount >= totalDue) {
        setRentAllocation(rentAmount);
        setCamAllocation(camAmount);
        setElectricityAllocations(buildElecAllocations(electricityRecords, electricityTotal));
        setLateFeeAllocation(lateFeeAmount);
      } else if (amount >= rentCamElec) {
        setRentAllocation(rentAmount);
        setCamAllocation(camAmount);
        setElectricityAllocations(buildElecAllocations(electricityRecords, electricityTotal));
        setLateFeeAllocation(0);
      } else if (amount >= rentAndCam) {
        setRentAllocation(rentAmount);
        setCamAllocation(camAmount);
        setElectricityAllocations(buildElecAllocations(electricityRecords, amount - rentAndCam));
        setLateFeeAllocation(0);
      } else if (amount >= rentAmount) {
        setRentAllocation(rentAmount);
        setCamAllocation(amount - rentAmount);
        setElectricityAllocations([]);
        setLateFeeAllocation(0);
      } else {
        setRentAllocation(amount);
        setCamAllocation(0);
        setElectricityAllocations([]);
        setLateFeeAllocation(0);
      }
    }
  };

  return {
    formik,
    allocationMode,
    setAllocationMode,
    rentAllocation,
    setRentAllocation,
    camAllocation,
    setCamAllocation,
    lateFeeAllocation,
    setLateFeeAllocation,
    electricityAllocations,
    setElectricityAllocations,
    totalElectricityAllocation,
    selectedBankAccountId,
    setSelectedBankAccountId,
    handleOpenDialog,
    handleAmountChange,
    resetForm,
  };
};
