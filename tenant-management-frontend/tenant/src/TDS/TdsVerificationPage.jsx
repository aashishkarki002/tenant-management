import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "../../plugins/axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DualCalendarTailwind from "../components/dualDate";
import { CheckCircle, AlertCircle, Filter, Download } from "lucide-react";

/**
 * TDS Verification Page
 * 
 * Allows administrators to verify TDS payments in batch operations.
 * Useful for tenants who pay quarterly or when verifying multiple months at once.
 */
export const TdsVerificationPage = () => {
  const [rents, setRents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRentIds, setSelectedRentIds] = useState([]);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterTenant, setFilterTenant] = useState("");
  const [tenants, setTenants] = useState([]);
  
  // Batch verification state
  const [batchDate, setBatchDate] = useState("");
  const [batchNepaliDate, setBatchNepaliDate] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Fetch unverified TDS rents
  useEffect(() => {
    fetchUnverifiedRents();
    fetchTenants();
  }, [filterMonth, filterYear, filterTenant]);

  const fetchTenants = async () => {
    try {
      const response = await api.get("/api/tenant/get-tenants");
      if (response.data.success) {
        setTenants(response.data.tenants || []);
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
  };

  const fetchUnverifiedRents = async () => {
    setLoading(true);
    try {
      const params = {
        status: "all",
      };
      
      if (filterMonth) params.nepaliMonth = filterMonth;
      if (filterYear) params.nepaliYear = filterYear;
      if (filterTenant) params.tenantId = filterTenant;

      const response = await api.get("/api/rent/get-rents", { params });
      
      if (response.data.success) {
        // Filter only rents with TDS that haven't been verified yet
        const unverifiedTdsRents = (response.data.rents || []).filter(
          (rent) => 
            rent.tdsAmountPaisa > 0 && 
            rent.tdsRecordedInLedger && 
            !rent.tdsPaidToGovernment
        );
        setRents(unverifiedTdsRents);
      }
    } catch (error) {
      console.error("Error fetching rents:", error);
      toast.error("Failed to fetch rents with unverified TDS");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRentIds(rents.map((r) => r._id));
    } else {
      setSelectedRentIds([]);
    }
  };

  const handleSelectRent = (rentId, checked) => {
    if (checked) {
      setSelectedRentIds([...selectedRentIds, rentId]);
    } else {
      setSelectedRentIds(selectedRentIds.filter((id) => id !== rentId));
    }
  };

  const handleBatchVerify = async () => {
    if (selectedRentIds.length === 0) {
      toast.error("Please select at least one rent to verify");
      return;
    }

    if (!batchDate) {
      toast.error("Please select a payment date");
      return;
    }

    setVerifying(true);
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    try {
      for (const rentId of selectedRentIds) {
        try {
          const payload = {
            tdsPaidDate: batchDate,
            nepaliTdsPaidDate: batchNepaliDate,
            tdsPaidNotes: batchNotes,
          };

          const response = await api.patch(
            `/api/rent/${rentId}/tds/mark-paid`,
            payload
          );

          if (response.data.success) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push({
              rentId,
              message: response.data.message || "Unknown error",
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            rentId,
            message: error.response?.data?.message || error.message,
          });
        }
      }

      // Show results
      if (results.success > 0) {
        toast.success(
          `Successfully verified ${results.success} TDS payment(s)`
        );
      }
      if (results.failed > 0) {
        toast.error(`Failed to verify ${results.failed} payment(s)`);
        console.error("Verification errors:", results.errors);
      }

      // Reset and refresh
      setSelectedRentIds([]);
      setBatchDate("");
      setBatchNepaliDate("");
      setBatchNotes("");
      fetchUnverifiedRents();
    } catch (error) {
      console.error("Batch verification error:", error);
      toast.error("Batch verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const totalTdsAmount = selectedRentIds.reduce((sum, rentId) => {
    const rent = rents.find((r) => r._id === rentId);
    return sum + (rent?.tdsAmountPaisa || 0);
  }, 0);

  const currentYear = new Date().getFullYear() + 57; // Approximate Nepali year

  const [downloading, setDownloading] = React.useState(false);

  const handleDownloadCertificate = async () => {
    if (!filterTenant) {
      toast.error("Select a tenant to download their TDS certificate");
      return;
    }
    const year = filterYear || String(currentYear);
    try {
      setDownloading(true);
      const response = await api.get(
        `/api/rent/tds/certificate/${filterTenant}`,
        { params: { nepaliYear: year }, responseType: "blob" }
      );
      const tenantName = tenants.find((t) => t._id === filterTenant)?.name || "Tenant";
      const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `TDS-Certificate-${tenantName}-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("TDS certificate downloaded");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to generate certificate";
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            TDS Verification
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify TDS payments made to government by tenants
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleDownloadCertificate}
          disabled={downloading || !filterTenant}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          {downloading ? "Generating…" : "Download TDS Certificate"}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">
                Month
              </label>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All months</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <SelectItem key={month} value={month.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">
                Year
              </label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger>
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All years</SelectItem>
                  {Array.from({ length: 5 }, (_, i) => currentYear - i).map(
                    (year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">
                Tenant
              </label>
              <Select value={filterTenant} onValueChange={setFilterTenant}>
                <SelectTrigger>
                  <SelectValue placeholder="All tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All tenants</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant._id} value={tenant._id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={fetchUnverifiedRents}
                className="w-full"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedRentIds.length > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {selectedRentIds.length} rent(s) selected
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Total TDS: ₹{(totalTdsAmount / 100).toLocaleString()}
                </p>
              </div>
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Unverified TDS Payments ({rents.length})
          </CardTitle>
          <CardDescription>
            Rents with TDS that haven't been verified as paid to government
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : rents.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium">All TDS payments verified!</p>
              <p className="text-xs text-muted-foreground mt-1">
                No pending TDS verifications found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedRentIds.length === rents.length &&
                          rents.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>TDS Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rents.map((rent) => (
                    <TableRow key={rent._id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRentIds.includes(rent._id)}
                          onCheckedChange={(checked) =>
                            handleSelectRent(rent._id, checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {rent.tenant?.name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        {rent.nepaliMonth}/{rent.nepaliYear}
                      </TableCell>
                      <TableCell>
                        ₹{(rent.tdsAmountPaisa / 100).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-amber-50">
                          Pending Verification
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Verification Form */}
      {selectedRentIds.length > 0 && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-base">Batch Verification</CardTitle>
            <CardDescription>
              Mark selected TDS payments as paid to government
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <DualCalendarTailwind
                value={batchDate}
                nepaliValue={batchNepaliDate}
                onChange={(ad, bs) => {
                  setBatchDate(ad);
                  setBatchNepaliDate(bs);
                }}
                placeholder="Select TDS payment date"
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                Receipt / Reference Number (optional)
              </label>
              <Input
                placeholder="Enter receipt or reference number"
                value={batchNotes}
                onChange={(e) => setBatchNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedRentIds([])}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBatchVerify}
                disabled={verifying}
                className="flex-1"
              >
                {verifying
                  ? "Verifying..."
                  : `Verify ${selectedRentIds.length} Payment(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TdsVerificationPage;
