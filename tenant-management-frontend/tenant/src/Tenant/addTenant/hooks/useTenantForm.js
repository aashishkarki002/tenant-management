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

import { useState, useCallback } from "react";
import { useFormik } from "formik";
import { toast } from "sonner";
import api from "../../../../plugins/axios";
import { validateTenantForm } from "../utils/tenantValidation";
import { buildTenantFormData } from "../utils/formDataBuilder";
import { getPropertyIdFromBlock } from "../utils/propertyHelper";

const IDLE_PROGRESS = { phase: "idle", percent: 0, message: "" };

const PHASES = {
  validating: { label: "Validating form data", basePercent: 0, endPercent: 8 },
  preparing:  { label: "Preparing documents",  basePercent: 8, endPercent: 15 },
  uploading:  { label: "Uploading files",       basePercent: 15, endPercent: 85 },
  processing: { label: "Calculating rent & registering", basePercent: 85, endPercent: 97 },
  done:       { label: "Tenant registered!",    basePercent: 100, endPercent: 100 },
};

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

  // Rent start — set by the "billing start" dialog shown after final submission.
  rentStartNepaliMonth: "",
  rentStartNepaliYear: "",
};

export const useTenantForm = (property, onSuccess) => {
  const [isLoading, setIsLoading] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(IDLE_PROGRESS);

  const setPhase = useCallback((phase, extraMessage = "") => {
    const p = PHASES[phase];
    setSubmissionProgress({
      phase,
      percent: p.endPercent,
      message: extraMessage || p.label,
    });
  }, []);

  const handleSubmit = async (values, { resetForm }) => {
    try {
      setIsLoading(true);

      // Phase: validating
      setPhase("validating");
      const validationErrors = validateTenantForm(values);
      if (validationErrors.length > 0) {
        validationErrors.forEach((err) => toast.error(err));
        setSubmissionProgress(IDLE_PROGRESS);
        return;
      }

      const propertyId = getPropertyIdFromBlock(values.block, property);
      if (!propertyId) {
        toast.error("Please select a valid block");
        setSubmissionProgress(IDLE_PROGRESS);
        return;
      }

      // Phase: preparing
      setPhase("preparing");
      const formData = buildTenantFormData(values, propertyId);

      // Count files for a better upload message
      const fileCount = [...formData.entries()].filter(
        ([, v]) => v instanceof File
      ).length;

      // Phase: uploading (real progress via axios)
      setSubmissionProgress({
        phase: "uploading",
        percent: PHASES.uploading.basePercent,
        message: fileCount > 0
          ? `Uploading ${fileCount} file${fileCount !== 1 ? "s" : ""}…`
          : "Uploading data…",
      });

      const response = await api.post("/api/tenant/create-tenant", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (!e.total) return;
          const uploadRatio = e.loaded / e.total;
          const { basePercent, endPercent } = PHASES.uploading;
          const percent = Math.round(basePercent + uploadRatio * (endPercent - basePercent));
          const uploadedMB = (e.loaded / 1024 / 1024).toFixed(1);
          const totalMB = (e.total / 1024 / 1024).toFixed(1);
          setSubmissionProgress({
            phase: "uploading",
            percent,
            message: `Uploading files… ${uploadedMB} / ${totalMB} MB`,
          });
        },
      });

      // Phase: processing (server-side work)
      setPhase("processing");
      // Brief pause so user sees "processing" before navigating away
      await new Promise((r) => setTimeout(r, 600));

      // Phase: done
      setPhase("done");
      await new Promise((r) => setTimeout(r, 400));

      toast.success("Tenant registered successfully!");
      resetForm();
      if (onSuccess) onSuccess(response.data);
    } catch (error) {
      console.error("Error creating tenant:", error);
      toast.error(error.response?.data?.message || "Failed to register tenant");
      setSubmissionProgress(IDLE_PROGRESS);
    } finally {
      setIsLoading(false);
    }
  };

  const formik = useFormik({
    initialValues: INITIAL_VALUES,
    onSubmit: handleSubmit,
  });

  return { formik, isLoading, submissionProgress };
};
