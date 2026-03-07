// src/pages/rent/components/AdminRentAction.jsx
//
// Rendered exclusively inside the header slot (RentPayment → useHeaderSlot).
//
// Responsive behaviour — pure Tailwind, no JS:
//   Mobile  (<sm) — icon-only square  w-8 h-8, no label, title tooltip on long-press
//   Desktop (sm+) — icon + text label (original look)

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

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const RefreshIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M4 4v5h.582M20 20v-5h-.582M4.582 9A8 8 0 0119.418 15M19.418 15A8 8 0 014.582 9" />
    </svg>
);

const MailIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);

const Spinner = ({ borderColor }) => (
    <span className="h-3 w-3 rounded-full border-[1.5px] border-t-transparent animate-spin shrink-0"
        style={{ borderColor, borderTopColor: "transparent" }} />
);

// ─────────────────────────────────────────────────────────────────────────────

export const AdminRentAction = ({ onProcessSuccess }) => {
    const { processMonthlyRents, sendRentReminders, processingRents, sendingEmails } =
        useAdminRentActions({ onProcessSuccess });

    return (
        <div className="flex items-center gap-1.5 shrink-0">

            {/* ── Process Rents ── */}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    {/*
                     * Mobile:  w-8 px-0  → perfect square, icon centered
                     * Desktop: w-auto px-3 → normal pill with label
                     */}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={processingRents}
                        title="Process Rents"
                        className="h-8 w-8 sm:w-auto px-0 sm:px-3
                                   border-blue-200 text-blue-700 hover:bg-blue-50
                                   text-xs font-semibold flex items-center justify-center"
                    >
                        {processingRents ? (
                            <>
                                <Spinner borderColor="#3B82F6" />
                                <span className="hidden sm:inline ml-1.5 whitespace-nowrap">Processing…</span>
                            </>
                        ) : (
                            <>
                                <RefreshIcon className="h-3.5 w-3.5 shrink-0" />
                                <span className="hidden sm:inline ml-1.5 whitespace-nowrap">Process Rents</span>
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
                            className="bg-blue-600 hover:bg-blue-700">
                            Yes, process now
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Send Reminders ── */}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={sendingEmails}
                        title="Send Reminders"
                        className="h-8 w-8 sm:w-auto px-0 sm:px-3
                                   border-orange-200 text-orange-700 hover:bg-orange-50
                                   text-xs font-semibold flex items-center justify-center"
                    >
                        {sendingEmails ? (
                            <>
                                <Spinner borderColor="#F97316" />
                                <span className="hidden sm:inline ml-1.5 whitespace-nowrap">Sending…</span>
                            </>
                        ) : (
                            <>
                                <MailIcon className="h-3.5 w-3.5 shrink-0" />
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
                            className="bg-orange-500 hover:bg-orange-600">
                            Yes, send emails
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
};