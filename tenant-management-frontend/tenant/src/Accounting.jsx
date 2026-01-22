import React, { useEffect, useMemo, useState } from "react";
import api from "../plugins/axios";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon, BanknoteArrowUpIcon, BanknoteArrowDownIcon, BanknoteIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";  
import DualCalendarTailwind from "./components/dualDate";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import RevenueLiabilitiesChart from "./components/RevenueLiabilties";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export default function Accounting() {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedQuarter, setSelectedQuarter] = useState(null); // null = full year
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const totals = summary?.totals || {};
  const income = summary?.incomeStreams || {};
  const liabilities = summary?.liabilitiesBreakdown || {};

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
      {/* Left */}
      <div>
        <h1 className="text-2xl font-bold">Accounting</h1>
        <h2 className="text-lg text-gray-500">Fiscal Year: 2081/82</h2>
      </div>

      {/* Right */}
      <div className="w-full sm:w-72 sm:mt-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Card className="cursor-pointer hover:bg-muted transition">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs text-gray-600 mb-">
                    {selectedBank?.bankName || "Select Bank"}
                  </CardTitle>
                   <p className="text-lg font-bold text-black">
                    Balance: {selectedBank?.balance?.toLocaleString() ?? "0"}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {selectedBank?.accountNumber}
                  </p>
                 
                </div>
                <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
            </Card>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-72">
            {bankAccounts.map((account) => (
              <DropdownMenuItem
                key={account._id}
                onClick={() => setSelectedBank(account)}
                className="p-0"
              >
                <Card className="w-full border-none shadow-none">
                  <CardHeader>
                    <CardTitle className="text-sm">
                      {account.bankName}
                    </CardTitle>
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
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
      <div className="flex flex-wrap gap-2">
        {["All", "Q1", "Q2", "Q3", "Q4"].map((quarter, idx) => {
          const quarterValue = idx === 0 ? null : idx;
          return (
          <Button
            key={quarter}
            variant="outline"
            className={`min-w-[3.5rem] text-sm font-medium transition ${
              selectedQuarter === quarterValue
                ? "bg-primary text-primary-foreground"
                : "hover:bg-primary hover:text-primary-foreground"
            }`}
            onClick={() => setSelectedQuarter(quarterValue)}
          >
            {quarter}
          </Button>
        );
        })}
      </div>
        <DualCalendarTailwind value={selectedDate} onChange={setSelectedDate} className="w-full sm:w-auto" />
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
                <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
              <p>  Rent Revenue: </p>
              <p> ₹{income.rentRevenue ?? 0}</p>
            
              </div>
              <div className="flex justify-between items-center">
              <p className=" text-sm">
              {bankAccounts.length} Bank Accounts
              </p>
              <p className=" text-sm text-green-500">
                +0% this month
              </p>

              </div>
              <div>
                <Progress value={Math.min(100, (income.rentRevenue || 0) / 1000)} className="h-2" />
              </div>
              </div>
                <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
              <p>  Parking Revenue: </p>
              <p> ₹{income.parkingRevenue ?? 0}</p>
            
              </div>
              <div className="flex justify-between items-center">
              <p className=" text-sm">
            Monthly Subs
              </p>
              <p className=" text-sm text-green-500">
                +0% this month
              </p>

              </div>
              <div>
                <Progress value={Math.min(100, (income.parkingRevenue || 0) / 500)} className="h-2" />
              </div>
              </div>
                <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
              <p>  Other Revenue: </p>
              <p> ₹{income.otherRevenue ?? 0}</p>
            
              </div>
              <div className="flex justify-between items-center">
              <p className=" text-sm">
              Monthly Subs
              </p>
              <p className=" text-sm text-green-500">
                +0% this month
              </p>

              </div>
              <div>
                <Progress value={Math.min(100, (income.otherRevenue || 0) / 500)} className="h-2" />
              </div>
              </div>
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
                <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
              <p>  CAM: </p>
              <p> ₹{liabilities.accountsPayable ?? 0}</p>
            
              </div>
             
             
              </div>
                <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
              <p>  Other Liabilities: </p>
              <p> ₹{liabilities.securityDeposits ?? 0}</p>
            
              </div>
          
              
              </div>
             
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
                ledgerEntries.slice(0, 20).map((entry) => (
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
</Card>
        </div>
      </div>

    </div>
  );
}
