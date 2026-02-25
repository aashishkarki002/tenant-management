/**
 * usePaymentForm.js  (FIXED)
 *
 * FIX 1 — bankAccountCode missing from everything.
 *   Added to: initialValues, submitted payload, handleOpenDialog reset.
 *   bankAccountCode is the chart-of-accounts string (e.g. "1010-NABIL")
 *   set by PaymentDialog when the user picks a bank account.
 *   The backend's journal builder uses it to route DR to the correct
 *   bank ledger account instead of a generic CASH account.
 *
 * FIX 2 — handleOpenDialog seeded amounts from gross rentAmountPaisa.
 *   Now seeds from getPaymentAmounts() which returns effectiveRentPaisa.
 *
 * FIX 3 — handleAmountChange used raw rentAmount / camAmount without TDS.
 *   getPaymentAmounts() now returns effective amounts so this is fixed
 *   by the util change — no logic change here needed.
 */

import { useState } from "react";
import { useFormik } from "formik";
import { toast } from "sonner";
import api from "../../../plugins/axios";
import { getPaymentAmounts, findMatchingCam } from "../utils/paymentUtil";

export const usePaymentForm = ({ rents, cams, onSuccess }) => {
  const [allocationMode, setAllocationMode] = useState("auto");
  const [rentAllocation, setRentAllocation] = useState(0);
  const [camAllocation, setCamAllocation] = useState(0);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");

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
      bankAccountCode: "", // FIX: added — chart-of-accounts code for the selected bank
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
          paymentMethod: String(values.paymentMethod || "").toLowerCase(),
          paymentStatus: values.paymentStatus || "paid",
          note: values.note || "",
          bankAccountId: values.bankAccountId || null,
          bankAccountCode: values.bankAccountCode || null, // FIX: now sent to backend
          transactionRef: values.transactionRef || null,
          allocations: values.allocations,
        };

        if (!payload.allocations?.rent && !payload.allocations?.cam) {
          toast.error("No allocations found. Please try again.");
          return;
        }

        // Guard: bank_transfer / cheque require bankAccountCode for ledger routing
        if (
          (payload.paymentMethod === "bank_transfer" ||
            payload.paymentMethod === "cheque") &&
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
    setSelectedBankAccountId("");
    setAllocationMode("auto");
  };

  /**
   * Seeds formik + allocation state when a payment dialog opens.
   * FIX: uses getPaymentAmounts() which now returns effective (gross - TDS) rent.
   */
  const handleOpenDialog = (rent) => {
    const { rentAmount, camAmount } = getPaymentAmounts(rent, cams);

    formik.setValues({
      ...formik.initialValues,
      rentId: rent._id.toString(),
      tenantId: rent.tenant?._id?.toString() || rent.tenant?.toString() || "",
      amount: rentAmount + camAmount,
      paymentMethod: formik.values.paymentMethod || "",
      bankAccountCode: "", // reset on each dialog open
    });

    setAllocationMode("auto");
    setRentAllocation(rentAmount);
    setCamAllocation(camAmount);
    setSelectedBankAccountId("");
  };

  /**
   * Amount input change — auto-allocates rent first (FIFO: oldest obligation first),
   * then CAM with whatever remains.
   * Uses effective amounts from getPaymentAmounts() after the util fix.
   */
  const handleAmountChange = (amount, rent) => {
    formik.setFieldValue("amount", amount);

    if (allocationMode === "auto" && rent) {
      const { rentAmount, camAmount } = getPaymentAmounts(rent, cams);
      const totalDue = rentAmount + camAmount;

      if (amount >= totalDue) {
        setRentAllocation(rentAmount);
        setCamAllocation(camAmount);
      } else if (amount >= rentAmount) {
        setRentAllocation(rentAmount);
        setCamAllocation(amount - rentAmount);
      } else {
        setRentAllocation(amount);
        setCamAllocation(0);
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
    selectedBankAccountId,
    setSelectedBankAccountId,
    handleOpenDialog,
    handleAmountChange,
    resetForm,
  };
};
