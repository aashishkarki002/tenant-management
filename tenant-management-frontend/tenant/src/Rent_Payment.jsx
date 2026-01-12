import React from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import api from "../plugins/axios";
import NepaliDate from "nepali-datetime";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import DualCalendarTailwind from "./components/dualDate";
import { useFormik } from "formik";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
const statusStyles = {
  paid: "bg-green-100 text-green-800 border-green-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  overdue: "bg-red-100 text-red-800 border-red-300",
  partial: "bg-orange-100 text-orange-800 border-orange-300",
};

// Helper function to format Nepali due date from rent object
const formatNepaliDueDate = (rent) => {
  try {
    // Priority 1: Use nepaliDueDate if available (already in Nepali BS format)
    if (rent.nepaliDueDate) {
      const nepaliDateStr = rent.nepaliDueDate.split("T")[0]; // Extract YYYY-MM-DD
      const [year, month, day] = nepaliDateStr.split("-").map(Number);

      // Check if year is in Nepali range (BS years are typically 2000+)
      if (year > 2000) {
        // This is already a Nepali date, create NepaliDate object
        // Try with 1-indexed month first (most date libraries use this)
        try {
          const nepaliDate = new NepaliDate(year, month - 1, day);
          return nepaliDate.format("YYYY-MMM-DD");
        } catch (e) {
          // If that fails, try with 0-indexed month
          const nepaliDate = new NepaliDate(year, month - 1, day);
          return nepaliDate.format("YYYY-MMM-DD");
        }
      }
    }

    // Priority 2: Use nepaliMonth and nepaliYear if available
    if (rent.nepaliMonth && rent.nepaliYear) {
      // Create NepaliDate directly from Nepali date components
      try {
        const nepaliDate = new NepaliDate(rent.nepaliYear, rent.nepaliMonth, 1);
        return nepaliDate.format("YYYY-MMM");
      } catch (e) {
        // If that fails, try with 0-indexed month
        const nepaliDate = new NepaliDate(
          rent.nepaliYear,
          rent.nepaliMonth - 1,
          1
        );
        return nepaliDate.format("YYYY-MMM");
      }
    }

    // Priority 3: Convert from English month and year
    if (rent.month && rent.year) {
      const dateStr = `${rent.year}-${String(rent.month).padStart(2, "0")}-01`;
      const nepaliDate = NepaliDate.parseEnglishDate(dateStr, "YYYY-MM-DD");
      return nepaliDate.format("YYYY-MMM-DD");
    }

    // Priority 4: Use englishDueDate if available
    if (rent.englishDueDate) {
      const dateStr = rent.englishDueDate.split("T")[0]; // Extract YYYY-MM-DD
      const nepaliDate = NepaliDate.parseEnglishDate(dateStr, "YYYY-MM-DD");
      return nepaliDate.format("YYYY-MMM-DD");
    }

    return "N/A";
  } catch (error) {
    console.error("Error converting date to Nepali:", error);
    // Fallback: show available date info
    if (rent.nepaliDueDate) {
      const dateStr = rent.nepaliDueDate.split("T")[0];
      return dateStr; // Return raw date string as fallback
    }
    if (rent.nepaliMonth - 1 && rent.nepaliYear) {
      return `${rent.nepaliYear}-${String(rent.nepaliMonth).padStart(2, "0")}`;
    }
    if (rent.month - 1 && rent.year) {
      return `${rent.month}/${rent.year}`;
    }
    return "N/A";
  }
};

export default function RentDashboard() {
  const [rents, setRents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [units, setUnits] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(["", ""]);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  // Filter states
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("all");
  const [datePickerResetKey, setDatePickerResetKey] = useState(0);
  const normalizeStatus = (status = "") => status.toLowerCase();
  const GetBankAccounts = async () => {
    const response = await api.get("/api/bank/get-bank-accounts");
    const data = await response.data;
    setBankAccounts(data.bankAccounts);
  };
  const getRents = async () => {
    const response = await api.get("/api/rent/get-rents");
    setRents(response.data.rents);
  };
  const getPayments = async () => {
    try {
      // Build query parameters for filtering
      const params = new URLSearchParams();
      if (filterStartDate) {
        params.append("startDate", filterStartDate);
      }
      if (filterEndDate) {
        params.append("endDate", filterEndDate);
      }
      if (filterPaymentMethod && filterPaymentMethod !== "all") {
        params.append("paymentMethod", filterPaymentMethod);
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/api/payment/get-filtered-payment-history?${queryString}`
        : "/api/payment/get-all-payment-history";

      const response = await api.get(endpoint);
      if (response.data.success) {
        setPayments(response.data.data || []);
      } else {
        toast.error(response.data.message || "Failed to fetch payments");
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast.error("Failed to fetch payments");
    }
  };

  useEffect(() => {
    getPayments();
  }, [filterStartDate, filterEndDate, filterPaymentMethod]);
  useEffect(() => {
    const fetchRentSummary = async () => {
      try {
        const response = await api.get("/api/payment/get-rent-summary");
        if (response.data.success && response.data.data) {
          setTotalCollected(response.data.data.totalCollected || 0);
          setTotalDue(response.data.data.totalDue || 0);
        }
      } catch (error) {
        console.error("Error fetching rent summary:", error);
      }
    };
    fetchRentSummary();
  }, []);

  useEffect(() => {
    getRents();
    GetBankAccounts();
  }, []);
  useEffect(() => {
    const getUnits = async () => {
      const response = await api.get("/api/unit/get-units");
      setUnits(response.data.units);
    };
    getUnits();
  }, []);
  const statusVariant = (status = "") => statusStyles[normalizeStatus(status)];

  const formik = useFormik({
    initialValues: {
      rentId: "",
      paymentDate: null,
      paymentMethod: selectedPaymentMethod,
      bankAccountId: "",
      amount: 0,
      notes: "",
      receivedBy: "",
    },
    onSubmit: async (values) => {
      console.log(values);
      const response = await api.post("/api/payment/pay-rent", values);
      if (response.data.success) {
        toast.success(response.data.message);
        formik.resetForm();
        getRents();
        getPayments(); // Refresh payments list
        // Refresh rent summary after payment
        const summaryResponse = await api.get("/api/payment/get-rent-summary");
        if (summaryResponse.data.success && summaryResponse.data.data) {
          setTotalCollected(summaryResponse.data.data.totalCollected || 0);
          setTotalDue(summaryResponse.data.data.totalDue || 0);
        }
      } else {
        toast.error(response.data.message);
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    formik.handleSubmit();
  };
  return (
    <>
      <form onSubmit={handleSubmit}>
        <Card className="w-full sm:max-w-5xl mx-auto mt-6">
          <Tabs defaultValue="rent">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">
                Rent & Payments
              </CardTitle>
              <TabsList className="mt-4">
                <TabsTrigger value="rent">Rent</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="rent">
              <div className="px-6 pt-6">
                <CardDescription className="text-gray-500 text-sm">
                  Track monthly rent collection
                </CardDescription>
                <div className="mt-2 text-sm text-muted-foreground">
                  <strong>Total Collected:</strong>
                  <Progress
                    value={totalDue > 0 ? (totalCollected / totalDue) * 100 : 0}
                    className="h-2 w-full mt-2"
                  />
                  <span className="text-primary font-bold">
                    ₹{totalCollected.toLocaleString()} / ₹
                    {totalDue.toLocaleString()}
                  </span>
                </div>
              </div>

              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant / Unit</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rents.map((rent, idx) => (
                      <TableRow key={rent._id || idx}>
                        <TableCell>
                          <div className="font-medium">
                            {rent.tenant
                              ? rent.tenant.name
                              : "No Tenant Assigned"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {rent.innerBlock?.name || "N/A"} -{" "}
                            {rent.block?.name || "N/A"}
                            {rent.tenant?.units
                              ?.map((unit) => unit.name)
                              .join(", ")}{" "}
                            - {rent.tenant?.unitNumber || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          ₹{rent.rentAmount?.toLocaleString() || "0"}
                        </TableCell>
                        <TableCell>{formatNepaliDueDate(rent)}</TableCell>
                        <TableCell>
                          {(() => {
                            const status = normalizeStatus(rent.status);

                            return (
                              <Badge
                                className={`capitalize border ${
                                  statusStyles[status] ||
                                  "bg-gray-100 text-gray-700 border-gray-300"
                                }`}
                              >
                                {status === "partial"
                                  ? "Partially Paid"
                                  : status}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={rent.status === "paid"}
                                className="bg-gray-500 text-white hover:bg-gray-800 hover:text-white"
                                onClick={() => {
                                  formik.setFieldValue(
                                    "rentId",
                                    rent._id.toString()
                                  );
                                  formik.setFieldValue(
                                    "amount",
                                    rent.rentAmount || 0
                                  );
                                  formik.setFieldValue("paymentDate", null);
                                }}
                              >
                                {rent.status === "paid"
                                  ? "Paid"
                                  : "Record Payment "}
                              </Button>
                            </DialogTrigger>

                            <DialogContent>
                              <DialogHeader>
                                {" "}
                                <DialogTitle className="text-2xl font-bold">
                                  Record Payment
                                </DialogTitle>
                                <div className="bg-gray-100 p-4 rounded-md mt-4">
                                  <p className="text-gray-500">
                                    Receiving From:
                                  </p>
                                  <p className="text-black font-bold text-xl">
                                    {rent.tenant?.name || "N/A"}
                                  </p>

                                  <p className="text-gray-500">
                                    {" "}
                                    {rent.tenant?.unitNumber
                                      ? rent.tenant.unitNumber
                                      : rent.tenant.units
                                          ?.map((unit) => unit.name)
                                          .join(", ")}
                                  </p>
                                </div>
                                <div>
                                  <p className="mb-2">Amount Received:</p>
                                  <Input
                                    placeholder=""
                                    value={formik.values.amount}
                                    onChange={formik.handleChange}
                                    name="amount"
                                  />
                                </div>
                                <div>
                                  <p className="mb-2">Payment Date:</p>
                                  <DualCalendarTailwind
                                    onChange={(english, nepali) => {
                                      // Create Date object directly from Nepali date (e.g., "2082-09-20")
                                      // Don't convert to English date - parse Nepali date directly
                                      if (nepali) {
                                        const [year, month, day] = nepali
                                          .split("-")
                                          .map(Number);
                                        const dateObj = new Date(
                                          year,
                                          month - 1,
                                          day
                                        );
                                        formik.setFieldValue(
                                          "paymentDate",
                                          dateObj
                                        );
                                      } else {
                                        formik.setFieldValue(
                                          "paymentDate",
                                          null
                                        );
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <p className="mb-2">Payment Method:</p>
                                  <div className="w-full sm:w-50">
                                    <div className="flex gap-2">
                                      <Select
                                        className="w-full sm:w-50"
                                        value={formik.values.paymentMethod}
                                        onValueChange={(value) =>
                                          formik.setFieldValue(
                                            "paymentMethod",
                                            value
                                          )
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select Payment Method" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="bank_transfer">
                                            Bank
                                          </SelectItem>
                                          <SelectItem value="cash">
                                            Cash
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Select
                                        className="w-full sm:w-50"
                                        disabled={
                                          formik.values.paymentMethod !==
                                          "bank_transfer"
                                        }
                                        value={formik.values.bankAccountId}
                                        onValueChange={(value) =>
                                          formik.setFieldValue(
                                            "bankAccountId",
                                            value
                                          )
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Bank" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {bankAccounts.map((bank) => (
                                            <SelectItem
                                              key={bank._id}
                                              value={bank._id}
                                            >
                                              {bank.bankName}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <p className="mb-2">Notes(Optional)</p>
                                  <Textarea
                                    placeholder=""
                                    value={formik.values.notes}
                                    onChange={formik.handleChange}
                                    name="notes"
                                  />
                                </div>
                              </DialogHeader>

                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-gray-200 text-black hover:bg-gray-200 w-full sm:w-50"
                                  onClick={() => {
                                    formik.resetForm();
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  variant="outline"
                                  size="sm"
                                  className="bg-blue-600 text-white hover:bg-blue-800 hover:text-white w-50"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    formik.handleSubmit();
                                  }}
                                >
                                  Confirm Payment
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </TabsContent>

            <TabsContent value="payments">
              <div className="px-6 pt-6">
                <CardDescription className="text-gray-500 text-sm">
                  View all payment history
                </CardDescription>
              </div>
              <CardContent>
                {/* Filter Section */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    {/* Date Range Filter */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Start Date
                        </label>
                        <DualCalendarTailwind
                          key={`start-${datePickerResetKey}`}
                          onChange={(english, nepali) => {
                            setFilterStartDate(english || "");
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          End Date
                        </label>
                        <DualCalendarTailwind
                          key={`end-${datePickerResetKey}`}
                          onChange={(english, nepali) => {
                            setFilterEndDate(english || "");
                          }}
                        />
                      </div>
                    </div>
                    {/* Payment Method Filter */}
                    <div className="w-full sm:w-48">
                      <label className="block text-sm font-medium mb-2">
                        Payment Method
                      </label>
                      <Select
                        value={filterPaymentMethod}
                        onValueChange={(value) => setFilterPaymentMethod(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Methods" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Methods</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank_transfer">
                            Bank Transfer
                          </SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Clear Filter Button */}
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFilterStartDate("");
                          setFilterEndDate("");
                          setFilterPaymentMethod("all");
                          setDatePickerResetKey((prev) => prev + 1);
                        }}
                        className="w-full sm:w-auto"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground"
                        >
                          No payments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((payment, idx) => {
                        // Format payment date
                        const formatPaymentDate = (date) => {
                          if (!date) return "N/A";
                          try {
                            const dateObj = new Date(date);
                            if (isNaN(dateObj.getTime())) return "N/A";
                            return dateObj.toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            });
                          } catch (error) {
                            return "N/A";
                          }
                        };

                        // Format payment method
                        const formatPaymentMethod = (method) => {
                          if (!method) return "N/A";
                          return method === "bank_transfer"
                            ? "Bank Transfer"
                            : method === "cash"
                            ? "Cash"
                            : method.charAt(0).toUpperCase() + method.slice(1);
                        };

                        // Format payment status
                        const formatPaymentStatus = (status) => {
                          if (!status) return "N/A";
                          return status
                            .split("_")
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() + word.slice(1)
                            )
                            .join(" ");
                        };

                        return (
                          <TableRow key={payment._id || idx}>
                            <TableCell>
                              <div className="font-medium">
                                {payment.tenant?.name || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatPaymentDate(payment.paymentDate)}
                            </TableCell>
                            <TableCell>
                              ₹{payment.amount?.toLocaleString() || "0"}
                            </TableCell>
                            <TableCell>
                              {formatPaymentMethod(payment.paymentMethod)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`capitalize border ${
                                  statusStyles[
                                    normalizeStatus(payment.paymentStatus)
                                  ] ||
                                  "bg-gray-100 text-gray-700 border-gray-300"
                                }`}
                              >
                                {formatPaymentStatus(payment.paymentStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell>{payment.note || "—"}</TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-gray-200 text-black hover:bg-gray-200 w-full sm:w-50"
                                  >
                                    View
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold">
                                      Payment Details
                                    </DialogTitle>
                                  </DialogHeader>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </form>
    </>
  );
}
