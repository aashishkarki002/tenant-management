// src/pages/rent/components/AdminRentAction.jsx
//
// Rendered exclusively inside the header slot (RentPayment → useHeaderSlot).
// Sizing is "sm" so buttons sit flush in the 52px header bar.

import React from "react";
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

export const AdminRentAction = ({ onProcessSuccess }) => {
    const { processMonthlyRents, sendRentReminders, processingRents, sendingEmails } =
        useAdminRentActions({ onProcessSuccess });

    return (
        <div className="flex flex-row gap-2 shrink-0">
            {/* ── Process Monthly Rents ── */}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={processingRents}
                        className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold"
                    >
                        {processingRents ? (
                            <>
                                <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-[1.5px] border-blue-500 border-t-transparent" />
                                Processing…
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.582M4.582 9A8 8 0 0119.418 15M19.418 15A8 8 0 014.582 9" />
                                </svg>
                                Process Rents
                            </>
                        )}
                    </Button>
                </AlertDialogTrigger>
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
                        <AlertDialogAction onClick={processMonthlyRents} className="bg-blue-600 hover:bg-blue-700">
                            Yes, process now
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Send Rent Reminders ── */}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={sendingEmails}
                        className="h-8 border-orange-200 text-orange-700 hover:bg-orange-50 text-xs font-semibold"
                    >
                        {sendingEmails ? (
                            <>
                                <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-[1.5px] border-orange-400 border-t-transparent" />
                                Sending…
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Send Reminders
                            </>
                        )}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Send Rent Reminder Emails</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will send reminder emails to all tenants with unpaid or
                            overdue rent. Tenants who have already paid this month will not
                            receive an email.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={sendRentReminders} className="bg-orange-500 hover:bg-orange-600">
                            Yes, send emails
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};