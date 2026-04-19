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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAdminRentActions } from "../hooks/AdminRentAction";
import { RefreshCcwIcon, MailIcon, HistoryIcon, Download, FileText } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { BackfillRentDialog } from "./BackfillRentDialog";

/**
 * Admin rent operations. Pass handlers from `useAdminRentActions` at page level
 * so row/bulk actions can share the same flows; omit props to use the hook internally.
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

    return (
        <div>
            <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="default"
                            size="sm"
                            disabled={processingRents}
                            title="Process Rent"
                            className="h-8 w-8 sm:w-auto px-0 sm:px-3 text-xs font-semibold flex items-center justify-center"
                        >
                            {processingRents ? (
                                <>
                                    <Spinner />
                                    <span className="hidden sm:inline ml-1.5 whitespace-nowrap">Processing…</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCcwIcon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="hidden sm:inline whitespace-nowrap">Process Rent</span>
                                </>
                            )}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Process Monthly Rents</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will generate rent records for the current month for all active
                                tenants and mark overdue rents. Records that already exist will be
                                skipped. Run this only if the scheduled job failed or you need an
                                ad-hoc run.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={processMonthlyRents}
                                className="bg-primary text-primary-foreground hover:bg-primary/90">
                                Yes, process now
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={sendingEmails}
                            title="Send Reminders"
                            className="h-8 w-8 sm:w-auto px-0 sm:px-3 border-border text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-semibold flex items-center justify-center"
                        >
                            {sendingEmails ? (
                                <>
                                    <Spinner />
                                    <span className="hidden sm:inline ml-1.5 whitespace-nowrap">Sending…</span>
                                </>
                            ) : (
                                <>
                                    <MailIcon className="size-3.5 shrink-0" />
                                    <span className="hidden sm:inline ml-1.5 whitespace-nowrap">Send Reminders</span>
                                </>
                            )}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Send Rent Reminder Emails</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will send reminder emails to all tenants with unpaid or overdue
                                rent. Tenants who have already paid this month will not receive an email.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={sendRentReminders}
                                className="bg-primary text-primary-foreground hover:bg-primary/90">
                                Yes, send emails
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {typeof onExport === "function" && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onExport}
                        title="Export visible rows as CSV"
                        className="h-8 w-8 sm:w-auto px-0 sm:px-3 border-border text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-semibold flex items-center justify-center"
                    >
                        <Download className="h-3.5 w-3.5 shrink-0" />
                        <span className="hidden sm:inline ml-1.5 whitespace-nowrap">Export CSV</span>
                    </Button>
                )}

                {typeof onExportPdf === "function" && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onExportPdf}
                        disabled={exportingPdf}
                        title="Download rent roll as PDF"
                        className="h-8 w-8 sm:w-auto px-0 sm:px-3 border-border text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-semibold flex items-center justify-center"
                    >
                        {exportingPdf ? (
                            <Spinner />
                        ) : (
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="hidden sm:inline ml-1.5 whitespace-nowrap">
                            {exportingPdf ? "Generating…" : "PDF Report"}
                        </span>
                    </Button>
                )}

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBackfillOpen(true)}
                    title="Backfill Past Rent"
                    className="h-8 w-8 sm:w-auto px-0 sm:px-3 text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-semibold flex items-center justify-center"
                >
                    <HistoryIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline ml-1.5 whitespace-nowrap">Backfill Rent</span>
                </Button>
            </div>

            <BackfillRentDialog
                open={backfillOpen}
                onOpenChange={setBackfillOpen}
                onSuccess={onProcessSuccess}
            />
        </div>
    );
};
