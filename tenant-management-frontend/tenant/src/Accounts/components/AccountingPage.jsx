
import React, { useState } from "react";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon, AArrowUpIcon as BanknoteArrowUpIcon, AArrowDownIcon as BanknoteArrowDownIcon, BanknoteIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useAccounting, useBankAccounts } from "../hooks/useAccounting";
import DetailDonutChart from "./DetailDonutChart";
import LedgerTable from "./LedgerTable";
import DualCalendarTailwind from "../../components/dualDate";
import RevenueLiabilitiesChart from "./RevenueLiabiltiesChart";
import RevenueBreakDown from "./RevenueBreakDown";
import ExpenseBreakDown from "./ExpenseBreakDown";



export default function AccountingPage(
) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedQuarter, setSelectedQuarter] = useState(null);
    const [activeTab, setActiveTab] = useState("summary");

    // Map tab to ledger API type: summary/dashboard → all, Revenue → revenue, Expenses → expense
    const ledgerType = activeTab === "summary" ? "all" : activeTab === "Revenue" ? "revenue" : "expense";

    const { summary, loadingSummary, ledgerEntries, loadingLedger } =
        useAccounting(selectedQuarter, ledgerType);
    const { bankAccounts, selectedBank, setSelectedBank } = useBankAccounts();

    const totals = summary?.totals || {
        totalRevenue: 0,
        totalLiabilities: 0,
        totalExpenses: 0,
        netCashFlow: 0,
    };
    const incomeStreams = summary?.incomeStreams?.breakdown || [];
    const liabilities = summary?.liabilitiesBreakdown || [];
    const expenses = summary?.expensesBreakdown || [];
    const chartData = [
        {
            label: selectedQuarter ? `Q${selectedQuarter}` : "Full Year",
            revenue: totals.totalRevenue || 0,
            liabilities: totals.totalLiabilities || 0,
            expenses: totals.totalExpenses || 0,
        },
    ];

    return (
        <div className="space-y-4">
            {/* Header Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-foreground">Accounting</h1>
                    <p className="text-sm text-muted-foreground mt-1">Fiscal Year: 2081/82</p>
                </div>

                {/* Bank Selector */}
                <div className="w-full sm:w-80">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div className="cursor-pointer">
                                <Card className="hover:bg-muted transition">
                                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-muted-foreground truncate">
                                                {selectedBank?.bankName || "Select Bank"}
                                            </p>
                                            <p className="text-lg font-bold text-foreground truncate">
                                                ₹{selectedBank?.balance?.toLocaleString() ?? "0"}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {selectedBank?.accountNumber}
                                            </p>
                                        </div>
                                        <ChevronDownIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    </CardHeader>
                                </Card>
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-80">
                            {bankAccounts.map((account) => (
                                <DropdownMenuItem
                                    key={account._id}
                                    onSelect={() => setSelectedBank(account)}
                                    className="p-0"
                                >
                                    <Card className="w-full border-none shadow-none">
                                        <CardHeader className="p-4">
                                            <p className="text-sm font-medium">{account.bankName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {account.accountNumber}
                                            </p>
                                        </CardHeader>
                                    </Card>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 gap-2">
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="Revenue">Revenue</TabsTrigger>
                        <TabsTrigger value="Expenses">Expenses</TabsTrigger>

                    </TabsList>
                    <TabsContent value="summary">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap gap-2">
                                {["All", "Q1", "Q2", "Q3", "Q4"].map((quarter, idx) => {
                                    const quarterValue = idx === 0 ? null : idx;
                                    return (
                                        <Button
                                            key={quarter}
                                            variant={selectedQuarter === quarterValue ? "default" : "outline"}
                                            className="min-w-[3.5rem] text-sm font-medium"
                                            onClick={() => setSelectedQuarter(quarterValue)}
                                        >
                                            {quarter}
                                        </Button>
                                    );
                                })}
                            </div>
                            <div className="w-full sm:w-auto">
                                <DualCalendarTailwind value={selectedDate} onChange={setSelectedDate} />
                            </div>
                        </div>


                        {/* Summary Cards */}
                        <div className="flex flex-col md:flex-row gap-4 w-full justify-between items-stretch">
                            <Card className="w-full md:w-1/3">
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold">Total Gross Revenue</h3>
                                        <BanknoteArrowUpIcon className="w-fit h-fit text-green-500" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-black text-2xl font-bold">
                                        ₹{totals.totalRevenue.toLocaleString()}
                                    </p>
                                </CardContent>
                                <CardFooter>
                                    <p className="text-green-500 text-sm">
                                        +{totals.totalRevenue.toLocaleString()}
                                    </p>
                                </CardFooter>
                            </Card>

                            <Card className="w-full md:w-1/3">
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold">Total Expenses</h3>
                                        <BanknoteArrowDownIcon className="w-fit h-fit text-red-500" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-black text-2xl font-bold">
                                        ₹{totals.totalExpenses.toLocaleString()}
                                    </p>
                                </CardContent>
                                <CardFooter>
                                    <p className="text-red-500 text-sm">
                                        -{totals.totalExpenses.toLocaleString()} this month
                                    </p>
                                </CardFooter>
                            </Card>



                            <Card className="w-full md:w-1/3">
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold">Net Cash Flow</h3>
                                        <BanknoteIcon className="w-fit h-fit text-blue-500" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-black text-2xl font-bold">
                                        ₹{totals.netCashFlow.toLocaleString()}
                                    </p>
                                </CardContent>
                                <CardFooter>
                                    <p className="text-green-500 text-sm">
                                        +{totals.netCashFlow.toLocaleString()} this month
                                    </p>
                                </CardFooter>
                            </Card>
                        </div>

                        {/* Main Content */}
                        <div className="flex flex-col lg:flex-row gap-4">
                            {/* Sidebar Cards */}
                            <div className="w-full lg:w-1/4 space-y-4">
                                {/* Income Streams */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            <h3 className="text-lg font-bold">Income Streams</h3>
                                        </CardTitle>
                                        <Separator />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex gap-4 flex-col">
                                            {incomeStreams.length > 0 ? (
                                                incomeStreams.map((stream, index) => {
                                                    const maxAmount = Math.max(
                                                        totals.totalRevenue || 0,
                                                        ...(incomeStreams.map((s) => s.amount || 0) || [])
                                                    ) || 1;
                                                    const progressValue = Math.min(
                                                        100,
                                                        ((stream.amount || 0) / maxAmount) * 100
                                                    );

                                                    return (
                                                        <div
                                                            key={stream.code || index}
                                                            className="flex flex-col gap-2"
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <p>{stream.name || stream.code}:</p>
                                                                <p>₹{stream.amount.toLocaleString()}</p>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <p className="text-sm">
                                                                    {bankAccounts.length} Bank Accounts
                                                                </p>
                                                                <p className="text-sm text-green-500">
                                                                    +0% this month
                                                                </p>
                                                            </div>
                                                            <Progress value={progressValue} className="h-2" />
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="text-sm text-gray-500">
                                                    No income streams available
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            <h3 className="text-lg font-bold">Expenses </h3>
                                        </CardTitle>
                                        <Separator />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex gap-4 flex-col">
                                            {expenses.length > 0 ? (
                                                expenses.map((expense, index) => {
                                                    const maxAmount = Math.max(
                                                        totals.totalExpenses || 0,
                                                        ...(expenses.map((e) => e.amount || 0))
                                                    ) || 1;
                                                    const progressValue = Math.min(
                                                        100,
                                                        ((expense.amount || 0) / maxAmount) * 100
                                                    );

                                                    return (
                                                        <div
                                                            key={expense.code || index}
                                                            className="flex flex-col gap-2"
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <p>{expense.name || expense.code}:</p>
                                                                <p>₹{expense.amount.toLocaleString()}</p>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <p className="text-sm">
                                                                    {bankAccounts.length} Bank Accounts
                                                                </p>
                                                                <p className="text-sm text-red-500">
                                                                    -0% this month
                                                                </p>
                                                            </div>
                                                            <Progress value={progressValue} className="h-2" />
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="text-sm text-gray-500">
                                                    No liabilities available
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                                {/* Liabilities and CAM */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            <h3 className="text-lg font-bold">Liabilities </h3>
                                        </CardTitle>
                                        <Separator />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex gap-4 flex-col">
                                            {liabilities.length > 0 ? (
                                                liabilities.map((liability, index) => {
                                                    const maxAmount = Math.max(
                                                        totals.totalLiabilities || 0,
                                                        ...(liabilities.map((l) => l.amount || 0))
                                                    ) || 1;
                                                    const progressValue = Math.min(
                                                        100,
                                                        ((liability.amount || 0) / maxAmount) * 100
                                                    );

                                                    return (
                                                        <div
                                                            key={liability.code || index}
                                                            className="flex flex-col gap-2"
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <p>{liability.name || liability.code}:</p>
                                                                <p>₹{liability.amount.toLocaleString()}</p>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <p className="text-sm">
                                                                    {bankAccounts.length} Bank Accounts
                                                                </p>
                                                                <p className="text-sm text-red-500">
                                                                    -0% this month
                                                                </p>
                                                            </div>
                                                            <Progress value={progressValue} className="h-2" />
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="text-sm text-gray-500">
                                                    No liabilities available
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Main Content Area */}
                            <div className="w-full lg:w-3/4 space-y-4">
                                {/* Revenue vs Expense Chart */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            <h3 className="text-lg font-bold">
                                                Income vs Expense Fiscal Year FY 81/82
                                            </h3>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <RevenueLiabilitiesChart
                                            data={chartData}
                                            loading={loadingSummary}
                                        />
                                    </CardContent>
                                </Card>

                                {/* Tabs for Revenue and Expense Details */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            <h3 className="text-lg font-bold">Financial Breakdown</h3>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Tabs defaultValue="revenue" className="w-full">
                                            <TabsList className="grid w-full grid-cols-2">
                                                <TabsTrigger value="revenue">
                                                    Revenue Details
                                                </TabsTrigger>
                                                <TabsTrigger value="expense">
                                                    Liabilities Details
                                                </TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="revenue" className="mt-6">
                                                <DetailDonutChart
                                                    data={incomeStreams}
                                                    title="Revenue Breakdown"
                                                    loading={loadingSummary}
                                                    colors={[
                                                        "#10b981",
                                                        "#34d399",
                                                        "#6ee7b7",
                                                        "#a7f3d0",
                                                    ]}
                                                />
                                            </TabsContent>

                                            <TabsContent value="expense" className="mt-6">
                                                <DetailDonutChart
                                                    data={expenses}
                                                    title="Expense Breakdown"
                                                    loading={loadingSummary}
                                                    colors={[
                                                        "#ef4444",
                                                        "#f87171",
                                                        "#fca5a5",
                                                        "#fcb9b9",
                                                    ]}
                                                />
                                            </TabsContent>
                                            <TabsContent value="expense" className="mt-6">
                                                <DetailDonutChart
                                                    data={liabilities}
                                                    title="Liabilities Breakdown"
                                                    loading={loadingSummary}
                                                    colors={[
                                                        "#ef4444",
                                                        "#f87171",
                                                        "#fca5a5",
                                                        "#fcb9b9",
                                                    ]}
                                                />
                                            </TabsContent>
                                        </Tabs>
                                    </CardContent>
                                </Card>

                                {/* Ledger Table */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            <h3 className="text-lg font-bold">Ledger Entries</h3>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <LedgerTable
                                            entries={ledgerEntries}
                                            loading={loadingLedger}
                                            itemsPerPage={20}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="Revenue">
                        <RevenueBreakDown totals={totals} incomeStreams={incomeStreams} ledgerEntries={ledgerEntries} loadingSummary={loadingSummary} loadingLedger={loadingLedger} />
                    </TabsContent>
                    <TabsContent value="Expenses">
                        <ExpenseBreakDown expenses={expenses} ledgerEntries={ledgerEntries} loadingSummary={loadingSummary} loadingLedger={loadingLedger} />
                    </TabsContent>
                </Tabs>
            </div>


        </div>
    );
}
