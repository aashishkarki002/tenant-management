import React, { useEffect, useState } from "react";
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
  useEffect(() => {
    const getBankAccounts = async () => {
      const response = await api.get("/api/bank/get-bank-accounts");
      const accounts = response.data.bankAccounts || [];
      setBankAccounts(accounts);
      if (accounts.length > 0) setSelectedBank(accounts[0]);
    };
    getBankAccounts();
  }, []);

  return (
    <div>
    <div className="flex justify-between items-start ">
      {/* Left */}
      <div>
        <h1 className="text-2xl font-bold">Accounting</h1>
        <h2 className="text-lg text-gray-500">Fiscal Year: 2081/82</h2>
      </div>

      {/* Right */}
      <div className="w-full sm:w-72 mt-4">
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
    <div className="flex gap-2 w-1/2  justify-between items-center">
        {["Q1", "Q2", "Q3", "Q4"].map((quarter) => (
          <Button
            key={quarter}
            variant="outline"
            className="w-16  text-sm font-medium hover:bg-primary hover:text-primary-foreground transition"
          >
            {quarter}
          </Button>
        ))}
        <DualCalendarTailwind value={selectedDate} onChange={setSelectedDate} className="w-full sm:w-1/2" />
      </div>
      <div className="flex gap-2 w-full mt-4 justify-between items-center">
        <Card className="w-full sm:w-1/3">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Total Gross Revenue</h3>
              <BanknoteArrowUpIcon className="w-fit h-fit text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">
              ₹{0} this month
            </p>
          </CardContent>
          <CardFooter>

            <p className="text-green-500 text-sm">
              +{0}
            </p>
          </CardFooter>
        </Card>
        <Card className="w-full sm:w-1/3">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <h3 className="text-lg font-bold">TotaL liabilities</h3>
              <BanknoteArrowDownIcon className="w-fit h-fit text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">
              ₹{0} this month
            </p>
          </CardContent>
          <CardFooter>
            <p className="text-red-500 text-sm">
              -{0} this month
            </p>
          </CardFooter>
        </Card>
        <Card className="w-full sm:w-1/3">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <h3 className="text-lg font-bold"> Net Cash Flow</h3>
              <BanknoteIcon className="w-fit h-fit text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-black text-2xl font-bold">
              ₹{0}
            </p>
          </CardContent>
          <CardFooter>
            <p className="text-green-500 text-sm">
              +{0} this month
            </p>
          </CardFooter>
        </Card>
      </div>
      <div className="flex gap-4 mt-4">
        <div className="w-1/4 space-y-4">
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
              <p> ₹{0}</p>
            
              </div>
              <div className="flex justify-between items-center">
              <p className=" text-sm">
              {100} Properties Active
              </p>
              <p className=" text-sm text-green-500">
                +2.5% this months
              </p>

              </div>
              <div>
                <Progress value={40} className="h-2" />
              </div>
              </div>
                <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
              <p>  Parking Revenue: </p>
              <p> ₹{0}</p>
            
              </div>
              <div className="flex justify-between items-center">
              <p className=" text-sm">
            Monthly Subs
              </p>
              <p className=" text-sm text-green-500">
                +2.5% this months
              </p>

              </div>
              <div>
                <Progress value={80} className="h-2" />
              </div>
              </div>
                <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
              <p>  Other Revenue: </p>
              <p> ₹{0}</p>
            
              </div>
              <div className="flex justify-between items-center">
              <p className=" text-sm">
              Monthly Subs
              </p>
              <p className=" text-sm text-green-500">
                +2.5% this months
              </p>

              </div>
              <div>
                <Progress value={50} className="h-2" />
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
              <p> ₹{0}</p>
            
              </div>
             
             
              </div>
                <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
              <p>  Other Liabilities: </p>
              <p> ₹{0}</p>
            
              </div>
          
              
              </div>
             
              </div>
              </CardContent>
            </Card> 
        </div>
        <div className="w-3/4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <h3 className="text-lg font-bold">Income vs Expense Fiscal Year FY 81/82</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueLiabilitiesChart />
            </CardContent>
          </Card>
          <Card>
          <Table>
  <TableHeader>
    <TableRow>
      <TableHead className="w-[100px]">Date</TableHead>
      <TableHead>Description</TableHead>
      <TableHead>Debit</TableHead>
      <TableHead>Credit</TableHead>
      <TableHead className="text-right">Balance</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>2026-01-01</TableCell>
      <TableCell>Opening Balance</TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
      <TableCell className="text-right">$5,000.00</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>2026-01-03</TableCell>
      <TableCell>Office Supplies</TableCell>
      <TableCell>$200.00</TableCell>
      <TableCell>-</TableCell>
      <TableCell className="text-right">$4,800.00</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>2026-01-05</TableCell>
      <TableCell>Client Payment Received</TableCell>
      <TableCell>-</TableCell>
      <TableCell>$1,500.00</TableCell>
      <TableCell className="text-right">$6,300.00</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>2026-01-10</TableCell>
      <TableCell>Utility Bill Payment</TableCell>
      <TableCell>$350.00</TableCell>
      <TableCell>-</TableCell>
      <TableCell className="text-right">$5,950.00</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>2026-01-12</TableCell>
      <TableCell>Miscellaneous Income</TableCell>
      <TableCell>-</TableCell>
      <TableCell>$200.00</TableCell>
      <TableCell className="text-right">$6,150.00</TableCell>
    </TableRow>
  </TableBody>
</Table>

</Card>
        </div>
      </div>

    </div>
  );
}
