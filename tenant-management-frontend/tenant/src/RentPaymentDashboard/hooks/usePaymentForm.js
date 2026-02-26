/**
 * usePaymentForm.js
 *
 * Manages formik state + allocation state for the rent payment dialog.
 *
 * Late fee support (new):
 *   - lateFeeAllocation: separate allocation bucket for the penalty charge
 *   - allocation strategy: rent first → CAM → late fee (senior obligations first)
 *   - payload: allocations.lateFee = { rentId, amount } sent to backend
 *     which routes it to LATE_FEE_PAYMENT_RECEIVED journal separately
 *   - full-payment-only rule enforced: late fee accepts all-or-nothing
 *     (mirrors backend allocatePayment() constraint)
 */

import { useState } from "react";
import { useFormik } from "formik";
import { toast } from "sonner";
import api from "../../../plugins/axios";
import { getPaymentAmounts } from "../utils/paymentUtil";

export const usePaymentForm = ({ rents, cams, onSuccess }) => {
  const [allocationMode, setAllocationMode] = useState("auto");
  const [rentAllocation, setRentAllocation] = useState(0);
  const [camAllocation, setCamAllocation] = useState(0);
  const [lateFeeAllocation, setLateFeeAllocation] = useState(0);
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
          paymentMethod: String(values.paymentMethod || "").toLowerCase(),
          paymentStatus: values.paymentStatus || "paid",
          note: values.note || "",
          bankAccountId: values.bankAccountId || null,
          bankAccountCode: values.bankAccountCode || null,
          transactionRef: values.transactionRef || null,
          allocations: values.allocations,
        };

        if (
          !payload.allocations?.rent &&
          !payload.allocations?.cam &&
          !payload.allocations?.lateFee
        ) {
          toast.error("No allocations found. Please try again.");
          return;
        }

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
    setLateFeeAllocation(0);
    setSelectedBankAccountId("");
    setAllocationMode("auto");
  };

  /**
   * Seeds formik + allocation state when a payment dialog opens.
   * Default: fill rent + CAM + late fee in full (total outstanding).
   */
  const handleOpenDialog = (rent) => {
    const { rentAmount, camAmount, lateFeeAmount } = getPaymentAmounts(
      rent,
      cams,
    );
    const total = rentAmount + camAmount + lateFeeAmount;

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
    setSelectedBankAccountId("");
  };

  /**
   * Amount input change — auto-allocates using priority order:
   *   1. Rent principal (senior)
   *   2. CAM
   *   3. Late fee (full-or-nothing: either all or zero — never partial)
   *
   * The full-or-nothing rule on late fee matches the backend constraint in
   * allocatePayment(): partial late fee payments are rejected.
   */
  const handleAmountChange = (amount, rent) => {
    formik.setFieldValue("amount", amount);

    if (allocationMode === "auto" && rent) {
      const { rentAmount, camAmount, lateFeeAmount } = getPaymentAmounts(
        rent,
        cams,
      );
      const rentAndCam = rentAmount + camAmount;
      const totalDue = rentAndCam + lateFeeAmount;

      if (amount >= totalDue) {
        // Pays everything including late fee
        setRentAllocation(rentAmount);
        setCamAllocation(camAmount);
        setLateFeeAllocation(lateFeeAmount);
      } else if (amount >= rentAndCam) {
        // Covers rent + CAM but not enough for full late fee → late fee = 0
        // (backend enforces full-or-nothing on late fee; don't send partial)
        setRentAllocation(rentAmount);
        setCamAllocation(camAmount);
        setLateFeeAllocation(0);
      } else if (amount >= rentAmount) {
        setRentAllocation(rentAmount);
        setCamAllocation(amount - rentAmount);
        setLateFeeAllocation(0);
      } else {
        setRentAllocation(amount);
        setCamAllocation(0);
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
    selectedBankAccountId,
    setSelectedBankAccountId,
    handleOpenDialog,
    handleAmountChange,
    resetForm,
  };
};
