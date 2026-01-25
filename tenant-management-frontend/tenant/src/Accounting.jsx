import React, { useEffect, useMemo, useState } from "react";
import api from "../plugins/axios";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, BanknoteArrowUpIcon, BanknoteArrowDownIcon, BanknoteIcon, MoreHorizontalIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";  
import DualCalendarTailwind from "./components/dualDate";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import RevenueLiabilitiesChart from "./components/RevenueLiabilties";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
export default function Accounting() {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedQuarter, setSelectedQuarter] = useState(null); // null = full year
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const totals = summary?.totals || {};
  const income = summary?.incomeStreams || {};
  const liabilities = summary?.liabilitiesBreakdown || [];

  // Pagination calculations
  const totalPages = Math.ceil(ledgerEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEntries = ledgerEntries.slice(startIndex, endIndex);

  // Reset to page 1 when ledger entries change
  useEffect(() => {
    setCurrentPage(1);
  }, [ledgerEntries.length]);

  const chartData = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: selectedQuarter ? `Q${selectedQuarter}` : "Full Year",
        revenue: totals.totalRevenue || 0,
        liabilities: totals.totalLiabilities || 0,
      },
    ];
  }, [summary, selectedQuarter, totals.totalLiabilities, totals.totalRevenue]);
  useEffect(() => {
    const getBankAccounts = async () => {
      const response = await api.get("/api/bank/get-bank-accounts");
      const accounts = response.data.bankAccounts || [];
      setBankAccounts(accounts);
      if (accounts.length > 0) setSelectedBank(accounts[0]);
    };
    getBankAccounts();
  }, []);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoadingSummary(true);
        const params = {};
        if (selectedQuarter) params.quarter = selectedQuarter;
        const response = await api.get("/api/accounting/summary", { params });
        setSummary(response.data.data);
      } catch (error) {
        console.error("Failed to fetch accounting summary", error);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [selectedQuarter]);

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        setLoadingLedger(true);
        const params = {};
        if (selectedQuarter) params.quarter = selectedQuarter;
        const response = await api.get("/api/ledger/get-ledger", { params });
        setLedgerEntries(response.data.data?.entries || []);
      } catch (error) {
        console.error("Failed to fetch ledger", error);
      } finally {
        setLoadingLedger(false);
      }
    };

    fetchLedger();
  }, [selectedQuarter]);

  return (
    <div className="space-y-4">
   <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">Accounting</h1>
          <p className="text-sm text-muted-foreground mt-1">Fiscal Year: 2081/82</p>
        </div>

        {/* Bank Selector */}
        <div className="w-full sm:w-80">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Card className="cursor-pointer hover:bg-muted transition">
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
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80">
              {bankAccounts.map((account) => (
                <DropdownMenuItem
                  key={account._id}
                  onClick={() => setSelectedBank(account)}
                  className="p-0"
                >
                  <Card className="w-full border-none shadow-none">
                    <CardHeader className="p-4">
                      <p className="text-sm font-medium">{account.bankName}</p>
                      <p className="text-xs text-muted-foreground">{account.accountNumber}</p>
                    </CardHeader>
                  </Card>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
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
   
      <div className="flex flex-col md:flex-row gap-4 w-full mt-4 justify-between items-stretch">
        <Card className="w-full md:w-1/3">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Total Gross Revenue</h3>
              <BanknoteArrowUpIcon className="w-fit h-fit text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">
              ₹{totals.totalRevenue ?? 0}
            </p>
          </CardContent>
          <CardFooter>

            <p className="text-green-500 text-sm">
              +{totals.totalRevenue ?? 0}
            </p>
          </CardFooter>
        </Card>
        <Card className="w-full md:w-1/3">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <h3 className="text-lg font-bold">TotaL liabilities</h3>
              <BanknoteArrowDownIcon className="w-fit h-fit text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">
              ₹{totals.totalLiabilities ?? 0}
            </p>
          </CardContent>
          <CardFooter>
            <p className="text-red-500 text-sm">
              -{totals.totalLiabilities ?? 0} this month
            </p>
          </CardFooter>
        </Card>
        <Card className="w-full md:w-1/3">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <h3 className="text-lg font-bold"> Net Cash Flow</h3>
              <BanknoteIcon className="w-fit h-fit text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">
              ₹{totals.netCashFlow ?? 0}
            </p>
          </CardContent>
          <CardFooter>
            <p className="text-green-500 text-sm">
              +{totals.netCashFlow ?? 0} this month
            </p>
          </CardFooter>
        </Card>
      </div>
      <div className="flex flex-col lg:flex-row gap-4 mt-4">
        <div className="w-full lg:w-1/4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <h3 className="text-lg font-bold">Income Streams</h3>
              </CardTitle>
           
                <Separator />
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 flex-col">
                  {income?.breakdown && income.breakdown.length > 0 ? (
                    income.breakdown.map((stream, index) => {
                      // Calculate max value for progress bar (use total revenue or max amount in breakdown)
                      const maxAmount = Math.max(
                        totals.totalRevenue || 0,
                        ...(income.breakdown?.map(s => s.amount || 0) || [])
                      ) || 1; // Avoid division by zero
                      const progressValue = Math.min(100, ((stream.amount || 0) / maxAmount) * 100);
                      
                      return (
                        <div key={stream.code || index} className="flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <p>{stream.name || stream.code}:</p>
                            <p>₹{stream.amount ?? 0}</p>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-sm">
                              {bankAccounts.length} Bank Accounts
                            </p>
                            <p className="text-sm text-green-500">
                              +0% this month
                            </p>
                          </div>
                          <div>
                            <Progress value={progressValue} className="h-2" />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-gray-500">No income streams available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card> 
            <Card>
            <CardHeader>
              <CardTitle>
                <h3 className="text-lg font-bold">Liabilities and CAM</h3>
              </CardTitle>
           
                <Separator />
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 flex-col">
                  {liabilities && liabilities.length > 0 ? (
                    liabilities.map((liability, index) => {
                      // Calculate max value for progress bar (use total liabilities or max amount in breakdown)
                      const maxAmount = Math.max(
                        totals.totalLiabilities || 0,
                        ...(liabilities.map(l => l.amount || 0))
                      ) || 1; // Avoid division by zero
                      const progressValue = Math.min(100, ((liability.amount || 0) / maxAmount) * 100);
                      
                      return (
                        <div key={liability.code || index} className="flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <p>{liability.name || liability.code}:</p>
                            <p>₹{liability.amount ?? 0}</p>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-sm">
                              {bankAccounts.length} Bank Accounts
                            </p>
                            <p className="text-sm text-red-500">
                              -0% this month
                            </p>
                          </div>
                          <div>
                            <Progress value={progressValue} className="h-2" />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-gray-500">No liabilities available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card> 
        </div>
        <div className="w-full lg:w-3/4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <h3 className="text-lg font-bold">Income vs Expense Fiscal Year FY 81/82</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueLiabilitiesChart data={chartData} loading={loadingSummary} />
            </CardContent>
          </Card>
          <Card>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead className="text-right">Running Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLedger ? (
                <TableRow>
                  <TableCell colSpan={5}>Loading...</TableCell>
                </TableRow>
              ) : ledgerEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No ledger entries</TableCell>
                </TableRow>
              ) : (
                paginatedEntries.map((entry) => (
                  <TableRow key={entry._id}>
                    <TableCell>
                      {entry.date
                        ? new Date(entry.date).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>{entry.description || entry.account?.name || "-"}</TableCell>
                    <TableCell>{entry.debit ? `₹${entry.debit}` : "-"}</TableCell>
                    <TableCell>{entry.credit ? `₹${entry.credit}` : "-"}</TableCell>
                    <TableCell className="text-right">
                      {entry.runningBalance !== undefined ? `₹${entry.runningBalance}` : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          {/* Pagination */}
          {ledgerEntries.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 pt-4 border-t px-4 pb-4">
              <div className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {startIndex + 1} to {Math.min(endIndex, ledgerEntries.length)} of {ledgerEntries.length} entries
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || loadingLedger}
                      className="gap-1"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            disabled={loadingLedger}
                            className="min-w-[2.5rem]"
                          >
                            {page}
                          </Button>
                        </PaginationItem>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <PaginationItem key={page}>
                          <span className="flex h-9 w-9 items-center justify-center">
                            <MoreHorizontalIcon className="h-4 w-4" />
                          </span>
                        </PaginationItem>
                      );
                    }
                    return null;
                  })}
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages || loadingLedger}
                      className="gap-1"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronDownIcon className="h-4 w-4 -rotate-90" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
</Card>
        </div>
      </div>

    </div>
  );
}
