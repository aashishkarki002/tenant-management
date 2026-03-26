/**
 * useTenantForm.js
 *
 * CHANGE — Added escalation fields to INITIAL_VALUES.
 *   escalationEnabled        Boolean  — master switch (default off)
 *   escalationStartDate      string   — AD "YYYY-MM-DD" (optional)
 *   escalationStartDateNepali string  — BS "YYYY-MM-DD" (optional)
 *   escalationSchedule       Array    — mirrors Tenant.rentEscalation.scheduled
 *
 * NOTE for formDataBuilder (buildTenantFormData):
 *   When escalationEnabled is true, serialize escalationSchedule as JSON
 *   and append to FormData:
 *
 *     if (values.escalationEnabled && values.escalationSchedule?.length) {
 *       formData.append("escalationEnabled", "true");
 *       formData.append("escalationSchedule", JSON.stringify(
 *         values.escalationSchedule.map(({ _id, ...tier }) => tier) // strip UI-only _id
 *       ));
 *       if (values.escalationStartDate)
 *         formData.append("escalationStartDate", values.escalationStartDate);
 *       if (values.escalationStartDateNepali)
 *         formData.append("escalationStartDateNepali", values.escalationStartDateNepali);
 *     }
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

  // Lease — AD (English) dates
  leaseStartDate: "",
  leaseEndDate: "",
  dateOfAgreementSigned: "",
  keyHandoverDate: "",
  spaceHandoverDate: "",
  spaceReturnedDate: "",

  // Lease — BS (Nepali) counterparts
  leaseStartDateNepali: "",
  leaseEndDateNepali: "",
  dateOfAgreementSignedNepali: "",
  keyHandoverDateNepali: "",
  spaceHandoverDateNepali: "",
  spaceReturnedDateNepali: "",

  rentPaymentFrequency: "",

  // Documents
  documentType: "",
  documents: {},

  // Financial - per unit
  unitFinancials: {},
  tdsPercentage: "10",

  // Rent payment method
  paymentMethod: "",
  chequeAmount: "",
  chequeNumber: "",

  // Security deposit payment
  sdPaymentMethod: "",
  sdBankAccountId: "",
  sdBankAccountCode: "",
  bankGuaranteePhoto: null,

  // ── Rent Escalation (optional) ──────────────────────────────────────────
  // escalationEnabled: master toggle. False = rentEscalation.enabled stays false on the model.
  // escalationSchedule: array of tier objects (see EscalationSection.jsx for shape).
  // escalationStartDate / escalationStartDateNepali: optional override for when escalation
  //   begins. If blank, the backend defaults to leaseStartDate.
  escalationEnabled: false,
  escalationStartDate: "",
  escalationStartDateNepali: "",
  escalationSchedule: [],
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
