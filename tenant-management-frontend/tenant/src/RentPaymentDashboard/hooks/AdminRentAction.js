import { useState } from "react";
import { toast } from "sonner";
import api from "../../../plugins/axios";

/**
 * Custom hook for manual admin-triggered rent operations.
 *
 * Industry Standard: Each action owns its own loading flag so buttons
 * disable independently — pressing one doesn't freeze the other.
 *
 * Both endpoints are idempotent-safe from the backend's perspective:
 * - processMonthlyRents: skips already-created records, marks overdue
 * - sendRentReminders: re-sends emails (intentional; admin is explicitly triggering)
 */
export const useAdminRentActions = ({ onProcessSuccess } = {}) => {
  const [processingRents, setProcessingRents] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);

  /**
   * Triggers monthly rent generation + overdue marking.
   * Maps to: POST /api/rent/process-monthly-rents
   *
   * Industry Standard: expose structured result so the caller (e.g. a
   * dashboard page) can refresh rent data via onProcessSuccess callback
   * without this hook needing to know about surrounding state.
   */
  const processMonthlyRents = async () => {
    try {
      setProcessingRents(true);
      const response = await api.post("/api/rent/process-monthly-rents");
      const { success, message, createdCount, updatedOverdueCount } =
        response.data;

      if (success) {
        toast.success(
          `${message} — ${createdCount} created, ${updatedOverdueCount} marked overdue.`,
        );
        onProcessSuccess?.(); // let parent refresh rent list
      } else {
        toast.error(message || "Rent processing failed.");
      }
    } catch (error) {
      console.error("processMonthlyRents error:", error);
      const serverMsg = error?.response?.data?.message;
      toast.error(serverMsg || "Failed to process monthly rents.");
    } finally {
      setProcessingRents(false);
    }
  };

  /**
   * Triggers email reminders to all tenants with unpaid/overdue rents.
   * Maps to: POST /api/rent/send-email-to-tenants
   */
  const sendRentReminders = async () => {
    try {
      setSendingEmails(true);
      const response = await api.post("/api/rent/send-email-to-tenants");
      const { success, message } = response.data;

      if (success) {
        toast.success(message || "Rent reminder emails sent successfully.");
      } else {
        toast.error(message || "Email sending failed.");
      }
    } catch (error) {
      console.error("sendRentReminders error:", error);
      const serverMsg = error?.response?.data?.message;
      toast.error(serverMsg || "Failed to send rent reminders.");
    } finally {
      setSendingEmails(false);
    }
  };

  return {
    processMonthlyRents,
    sendRentReminders,
    processingRents,
    sendingEmails,
  };
};
