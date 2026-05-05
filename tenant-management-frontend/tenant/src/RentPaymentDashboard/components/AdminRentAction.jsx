import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminRentActions } from "../hooks/AdminRentAction";
import { MoreHorizontal } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { BackfillRentDialog } from "./BackfillRentDialog";


/**
 * Minimal header actions: one primary CTA + overflow menu for secondary actions.
 */
export const AdminRentAction = ({
  onProcessSuccess,
  processMonthlyRents: processMonthlyRentsProp,
  sendRentReminders: sendRentRemindersProp,
  processingRents: processingRentsProp,
  sendingEmails: sendingEmailsProp,
  onExport,
  onExportPdf,
  exportingPdf,
}) => {
  const internal = useAdminRentActions({ onProcessSuccess });
  const processMonthlyRents = processMonthlyRentsProp ?? internal.processMonthlyRents;
  const sendRentReminders = sendRentRemindersProp ?? internal.sendRentReminders;
  const processingRents = processingRentsProp ?? internal.processingRents;
  const sendingEmails = sendingEmailsProp ?? internal.sendingEmails;

  const [backfillOpen, setBackfillOpen] = useState(false);
  const [processOpen, setProcessOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Primary CTA */}
      <Button
        type="button"
        size="sm"
        disabled={processingRents}
        onClick={() => setProcessOpen(true)}
        className="h-8 px-3 text-xs font-medium"
      >
        {processingRents ? (
          <span className="flex items-center gap-1.5">
            <Spinner className="size-3" />
            Processing…
          </span>
        ) : (
          "Process Rent"
        )}
      </Button>

      {/* Overflow menu for secondary actions */}
      <DropdownMenu>
        <DropdownMenuTrigger >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="More actions"
            disabled={false}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="text-xs"
            disabled={sendingEmails}
            onSelect={(e) => {
              e.preventDefault();
             setTimeout(() => setRemindOpen(true), 0);
            }}
          >
            {sendingEmails ? "Sending…" : "Send Reminders"}
          </DropdownMenuItem>
          {typeof onExport === "function" && (
            <DropdownMenuItem className="text-xs" onClick={onExport}>
              Export CSV
            </DropdownMenuItem>
          )}
          {typeof onExportPdf === "function" && (
            <DropdownMenuItem
              className="text-xs"
              disabled={exportingPdf}
              onClick={onExportPdf}
            >
              {exportingPdf ? "Generating…" : "PDF Report"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs"
            onSelect={(e) => {
              e.preventDefault();
             setTimeout(() => setBackfillOpen(true), 0);
            }}
          >
            Backfill Rent
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Process rent confirmation dialog */}
      <AlertDialog open={processOpen} onOpenChange={setProcessOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Process Monthly Rents</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate rent records for the current month for all
              active tenants and mark overdue rents. Records that already exist
              will be skipped. Run this only if the scheduled job failed or you
              need an ad-hoc run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setProcessOpen(false);
                processMonthlyRents();
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Yes, process now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send reminders confirmation dialog */}
      <AlertDialog open={remindOpen} onOpenChange={setRemindOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Rent Reminder Emails</AlertDialogTitle>
            <AlertDialogDescription>
              This will send reminder emails to all tenants with unpaid or
              overdue rent. Tenants who have already paid will not receive an
              email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRemindOpen(false);
                sendRentReminders();
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Yes, send emails
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BackfillRentDialog
        open={backfillOpen}
        onOpenChange={setBackfillOpen}
        onSuccess={onProcessSuccess}
      />
    </div>
  );
};
