import { useState } from "react";
import { useFormik } from "formik";
import { toast } from "sonner";
import api from "../../../plugins/axios";
import { getPaymentAmounts, findMatchingCam } from "../utils/paymentUtil";

/**
 * Custom hook for managing payment form state and submission
 * Handles form validation, allocation logic, and payment submission
 */
export const usePaymentForm = ({ rents, cams, onSuccess }) => {
  const [allocationMode, setAllocationMode] = useState("auto"); // "auto" or "manual"
  const [rentAllocation, setRentAllocation] = useState(0);
  const [camAllocation, setCamAllocation] = useState(0);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Cash");

  const formik = useFormik({
    initialValues: {
      rentId: "",
      tenantId: "",
      paymentDate: null,
      nepaliDate: null,
      paymentMethod: selectedPaymentMethod,
      bankAccountId: "",
      amount: 0,
      notes: "",
      receivedBy: "",
      transactionRef: "",
    },
    onSubmit: async (values) => {
      // Validate manual allocation
      if (allocationMode === "manual") {
        const totalAllocated = rentAllocation + camAllocation;
        if (Math.abs(totalAllocated - values.amount) > 0.01) {
          toast.error(
            `Allocated total (Rs ${totalAllocated.toLocaleString()}) must match Amount Paid (Rs ${values.amount.toLocaleString()})`
          );
          return;
        }
      }

      // Find matching CAM for this rent
      const currentRent = rents.find(
        (r) => r._id.toString() === values.rentId
      );
      const matchingCam = currentRent
        ? findMatchingCam(cams, currentRent)
        : null;

      // Build allocations object
      // ✅ Convert rupees to paisa (multiply by 100) for API
      const allocations = {};
      if (rentAllocation > 0 && values.rentId) {
        allocations.rent = {
          rentId: values.rentId,
          amountPaisa: Math.round(rentAllocation * 100), // Convert to paisa
          amount: rentAllocation, // Backward compatibility
        };
      }
      if (camAllocation > 0 && matchingCam?._id) {
        allocations.cam = {
          camId: matchingCam._id,
          paidAmountPaisa: Math.round(camAllocation * 100), // Convert to paisa
          paidAmount: camAllocation, // Backward compatibility
        };
      }

      const payload = {
        ...values,
        paymentMethod: String(values.paymentMethod || "").toLowerCase(),
        note: values.notes || "",
        allocations: allocations,
        amountPaisa: Math.round(values.amount * 100), // Convert total to paisa
        amount: values.amount, // Backward compatibility - total amount paid in rupees
      };

      try {
        const response = await api.post("/api/payment/pay-rent-and-cam", payload);
        if (response.data.success) {
          toast.success(response.data.message);
          resetForm();
          if (onSuccess) {
            onSuccess();
          }
        } else {
          toast.error(response.data.message);
        }
      } catch (error) {
        console.error("Error submitting payment:", error);
        toast.error("Failed to submit payment. Please try again.");
      }
    },
  });

  /**
   * Resets form to initial state
   */
  const resetForm = () => {
    formik.resetForm();
    setRentAllocation(0);
    setCamAllocation(0);
    setSelectedBankAccountId("");
    setAllocationMode("auto");
  };

  /**
   * Opens payment dialog and initializes form with rent data
   */
  const handleOpenDialog = (rent) => {
    const { rentAmount, camAmount } = getPaymentAmounts(rent, cams);
    formik.setFieldValue("rentId", rent._id.toString());
    formik.setFieldValue("tenantId", rent.tenant?._id?.toString() || "");
    formik.setFieldValue("amount", rentAmount + camAmount);
    formik.setFieldValue("paymentDate", null);
    formik.setFieldValue("nepaliDate", null);
    formik.setFieldValue("transactionRef", "");
    setAllocationMode("auto");
    setRentAllocation(rentAmount);
    setCamAllocation(camAmount);
    setSelectedBankAccountId("");
  };

  /**
   * Handles amount change and auto-allocates based on mode
   */
  const handleAmountChange = (amount, rent) => {
    formik.setFieldValue("amount", amount);
    if (allocationMode === "auto" && rent) {
      // Auto-allocate: prioritize rent, then CAM
      const { rentAmount, camAmount } = getPaymentAmounts(rent, cams);
      const totalDue = rentAmount + camAmount;

      if (amount >= totalDue) {
        // Full payment
        setRentAllocation(rentAmount);
        setCamAllocation(camAmount);
      } else if (amount >= rentAmount) {
        // Pay full rent + partial CAM
        setRentAllocation(rentAmount);
        setCamAllocation(amount - rentAmount);
      } else {
        // Partial rent only
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
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    handleOpenDialog,
    handleAmountChange,
    resetForm,
  };
};
