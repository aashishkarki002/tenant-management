/**
 * USE TENANT EDIT HOOK
 *
 * Custom hook that handles:
 * - Fetching tenant data
 * - Tracking changes
 * - Updating tenant
 * - Loading/error states
 *
 * Industry Standards:
 * - Separation of concerns (business logic from UI)
 * - Optimistic updates
 * - Error handling with retry
 * - Clean API abstraction
 */

import { useState, useCallback, useMemo } from "react";
import api from "../../../../plugins/axios";
import { rupeesToPaisa, paisaToRupees } from "../utils/formatting.js";

export function useTenantEdit(tenantId) {
  const [tenant, setTenant] = useState(null);
  const [originalTenant, setOriginalTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch tenant data from backend
   */
  const fetchTenant = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get(`/api/tenant/get-tenant/${tenantId}`);

      if (response.data.success) {
        const tenantData = response.data.tenant;

        // Format dates for form inputs (YYYY-MM-DD)
        const formatDateForInput = (date) => {
          if (!date) return "";
          if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return date;
          }
          const d = new Date(date);
          if (isNaN(d.getTime())) return "";

          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        // Store both original (for comparison) and current (for editing)
        const formatted = {
          ...tenantData,
          leaseStartDate: formatDateForInput(tenantData.leaseStartDate),
          leaseEndDate: formatDateForInput(tenantData.leaseEndDate),
          dateOfAgreementSigned: formatDateForInput(
            tenantData.dateOfAgreementSigned,
          ),
          keyHandoverDate: formatDateForInput(tenantData.keyHandoverDate),
          spaceHandoverDate: formatDateForInput(tenantData.spaceHandoverDate),
          spaceReturnedDate: formatDateForInput(tenantData.spaceReturnedDate),
        };

        setTenant(formatted);
        setOriginalTenant(formatted);
      }
    } catch (err) {
      console.error("Error fetching tenant:", err);
      setError(err.response?.data?.message || "Failed to load tenant data");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  /**
   * Update tenant with optimistic UI updates
   */
  const updateTenant = useCallback(
    async (values) => {
      setIsSaving(true);
      setError(null);

      try {
        // Build FormData for file uploads
        const formData = new FormData();

        // Add all form fields (exclude files and complex objects)
        Object.entries(values).forEach(([key, value]) => {
          if (
            key !== "documents" &&
            key !== "existingDocuments" &&
            value !== null &&
            value !== undefined &&
            value !== ""
          ) {
            // Convert financial fields to paisa for backend
            if (
              ["pricePerSqft", "camRatePerSqft", "securityDeposit"].includes(
                key,
              )
            ) {
              formData.append(`${key}Paisa`, rupeesToPaisa(value));
              formData.append(key, value); // Keep rupees for backward compat
            } else {
              formData.append(key, value);
            }
          }
        });

        // Add new documents
        if (values.documents) {
          Object.entries(values.documents).forEach(([type, files]) => {
            if (Array.isArray(files)) {
              files.forEach((file) => {
                formData.append(type, file);
              });
            }
          });
        }

        // Optimistic update - update UI immediately
        const optimisticTenant = {
          ...tenant,
          ...values,
        };
        setTenant(optimisticTenant);

        // Send update request
        const response = await api.patch(
          `/api/tenant/update-tenant/${tenantId}`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );

        if (response.data.success) {
          // Update with server response
          const updatedTenant = response.data.tenant;
          setTenant(updatedTenant);
          setOriginalTenant(updatedTenant);
          return updatedTenant;
        } else {
          throw new Error(response.data.message || "Update failed");
        }
      } catch (err) {
        console.error("Error updating tenant:", err);

        // Rollback optimistic update
        setTenant(originalTenant);

        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          "Failed to update tenant";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsSaving(false);
      }
    },
    [tenantId, tenant, originalTenant],
  );

  /**
   * Check if form has unsaved changes
   */
  const hasChanges = useCallback(
    (currentValues) => {
      if (!originalTenant) return false;

      // Fields to compare
      const fieldsToCompare = [
        "name",
        "email",
        "phone",
        "address",
        "status",
        "leaseStartDate",
        "leaseEndDate",
        "dateOfAgreementSigned",
        "keyHandoverDate",
        "spaceHandoverDate",
        "spaceReturnedDate",
        "leasedSquareFeet",
        "pricePerSqft",
        "camRatePerSqft",
        "securityDeposit",
      ];

      return fieldsToCompare.some((field) => {
        const original = originalTenant[field];
        const current = currentValues[field];

        // Handle different types
        if (typeof original === "number" && typeof current === "string") {
          return Math.abs(Number(current) - original) > 0.01;
        }

        return original !== current;
      });
    },
    [originalTenant],
  );

  /**
   * Get object of changed fields for visual indication
   */
  const changedFields = useMemo(() => {
    if (!originalTenant || !tenant) return {};

    const changes = {};
    const fields = [
      "name",
      "email",
      "phone",
      "address",
      "status",
      "leaseStartDate",
      "leaseEndDate",
      "dateOfAgreementSigned",
      "keyHandoverDate",
      "spaceHandoverDate",
      "spaceReturnedDate",
      "leasedSquareFeet",
      "pricePerSqft",
      "camRatePerSqft",
      "securityDeposit",
    ];

    fields.forEach((field) => {
      const original = originalTenant[field];
      const current = tenant[field];

      if (typeof original === "number" && typeof current === "string") {
        changes[field] = Math.abs(Number(current) - original) > 0.01;
      } else {
        changes[field] = original !== current;
      }
    });

    return changes;
  }, [originalTenant, tenant]);

  return {
    tenant,
    originalTenant,
    isLoading,
    isSaving,
    error,
    fetchTenant,
    updateTenant,
    hasChanges,
    changedFields,
  };
}
