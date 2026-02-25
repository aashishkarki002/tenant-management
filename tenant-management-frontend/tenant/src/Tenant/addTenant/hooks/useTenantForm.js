/**
 * useTenantForm.js  (FIXED)
 *
 * FIX 1 - Added sdPaymentMethod, sdBankAccountId, sdBankAccountCode.
 *   sdPaymentMethod is separate from paymentMethod (rent) because:
 *     - A tenant may pay rent by cheque but secure the deposit via bank guarantee
 *     - BANK_GUARANTEE is only valid for the security deposit, never for rent
 *
 * FIX 2 - tdsPercentage default is "10" to match the backend default.
 */

import { useState } from "react";
import { useFormik } from "formik";
import { toast } from "sonner";
import api from "../../../../plugins/axios";
import { validateTenantForm } from "../utils/tenantValidation";
import { buildTenantFormData } from "../utils/formDataBuilder";
import { getPropertyIdFromBlock } from "../utils/propertyHelper";

const INITIAL_VALUES = {
  // Personal
  name: "",
  phone: "",
  email: "",
  address: "",
  status: "",

  // Location
  block: "",
  innerBlock: "",
  unitNumber: [],

  // Lease
  leaseStartDate: "",
  leaseEndDate: "",
  dateOfAgreementSigned: "",
  keyHandoverDate: "",
  spaceHandoverDate: "",
  spaceReturnedDate: "",
  rentPaymentFrequency: "",

  // Documents
  documentType: "",
  documents: {},

  // Financial - per unit
  unitFinancials: {},
  tdsPercentage: "10", // matches backend default

  // Rent payment method: cash | bank_transfer | cheque | mobile_wallet
  // BANK_GUARANTEE is NOT valid here
  paymentMethod: "",
  chequeAmount: "",
  chequeNumber: "",

  // Security deposit payment (separate concept from rent payment)
  // bank_guarantee = document only, no cash/bank journal entry posted
  // cash | bank_transfer | cheque = money received -> posts DR Cash/Bank CR SD Liability
  sdPaymentMethod: "",
  sdBankAccountId: "", // required when sdPaymentMethod is bank_transfer or cheque
  sdBankAccountCode: "", // chart-of-accounts code for the specific bank account
  bankGuaranteePhoto: null,
};

export const useTenantForm = (property, onSuccess) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (values, { resetForm }) => {
    try {
      setIsLoading(true);

      const validationErrors = validateTenantForm(values);
      if (validationErrors.length > 0) {
        validationErrors.forEach((err) => toast.error(err));
        return;
      }

      const propertyId = getPropertyIdFromBlock(values.block, property);
      if (!propertyId) {
        toast.error("Please select a valid block");
        return;
      }

      const formData = buildTenantFormData(values, propertyId);

      const response = await api.post("/api/tenant/create-tenant", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Tenant registered successfully!");
      resetForm();
      if (onSuccess) onSuccess(response.data);
    } catch (error) {
      console.error("Error creating tenant:", error);
      toast.error(error.response?.data?.message || "Failed to register tenant");
    } finally {
      setIsLoading(false);
    }
  };

  const formik = useFormik({
    initialValues: INITIAL_VALUES,
    onSubmit: handleSubmit,
  });

  return { formik, isLoading };
};
