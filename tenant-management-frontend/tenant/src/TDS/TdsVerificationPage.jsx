import React, { useState, useEffect, useRef } from "react";
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
import {
  CheckCircle,
  AlertCircle,
  Upload,
  FileText,
  Download,
  Filter,
} from "lucide-react";
import { getTodayNepali, NEPALI_MONTH_NAMES } from "@/utils/nepaliDate";

const QUARTER_LABELS = {
  1: "Q1 (Shrawan–Ashwin)",
  2: "Q2 (Kartik–Poush)",
  3: "Q3 (Magh–Chaitra)",
  4: "Q4 (Baisakh–Ashadh)",
};

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    className: "bg-gray-50 text-gray-700 border-gray-200",
  },
  certificate_received: {
    label: "Certificate Received",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  verified: {
    label: "Verified",
    className: "bg-green-50 text-green-700 border-green-200",
  },
};

export const TdsVerificationPage = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState([]);

  const [filterTenant, setFilterTenant] = useState("");
  const [filterFiscalYear, setFilterFiscalYear] = useState("");
  const [filterQuarter, setFilterQuarter] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [expanded, setExpanded] = useState(null);
  const [uploading, setUploading] = useState({});
  const [verifying, setVerifying] = useState({});
  const [verifyForm, setVerifyForm] = useState({});
  const [downloading, setDownloading] = useState(false);

  const fileInputRefs = useRef({});
  const currentYear = getTodayNepali().year;

  useEffect(() => {
    fetchRecords();
    fetchTenants();
  }, [filterTenant, filterFiscalYear, filterQuarter, filterStatus]);

  const fetchTenants = async () => {
    try {
      const res = await api.get("/api/tenant/get-tenants");
      if (res.data.success) setTenants(res.data.tenants || []);
    } catch { }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterTenant) params.tenantId = filterTenant;
      if (filterFiscalYear) params.fiscalYear = filterFiscalYear;
      if (filterQuarter) params.quarter = filterQuarter;
      if (filterStatus) params.status = filterStatus;

      const res = await api.get("/api/tds/quarterly", { params });
      if (res.data.success) setRecords(res.data.records || []);
    } catch {
      toast.error("Failed to fetch TDS quarterly records");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (recordId, tenantId, file) => {
    if (!file) return;
    setUploading((prev) => ({ ...prev, [recordId]: true }));
    try {
      const formData = new FormData();
      formData.append("tdsDocument", file);
      const res = await api.post(
        `/api/tds/quarterly/${recordId}/upload-certificate`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (res.data.success) {
        toast.success("Certificate uploaded");
        fetchRecords();
      } else {
        toast.error(res.data.message || "Upload failed");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading((prev) => ({ ...prev, [recordId]: false }));
      if (fileInputRefs.current[recordId]) {
        fileInputRefs.current[recordId].value = "";
      }
    }
  };

  const handleVerify = async (recordId) => {
    const form = verifyForm[recordId] || {};
    if (!form.paymentDate) {
      toast.error("Select IRD payment date");
      return;
    }
    setVerifying((prev) => ({ ...prev, [recordId]: true }));
    try {
      const res = await api.post(`/api/tds/quarterly/${recordId}/verify`, {
        challanNumber: form.challanNumber || undefined,
        paymentDate: form.paymentDate,
        nepaliPaymentDate: form.nepaliPaymentDate || undefined,
        notes: form.notes || undefined,
      });
      if (res.data.success) {
        toast.success(
          res.data.skipped ? "Already verified" : "TDS payment verified",
        );
        setExpanded(null);
        fetchRecords();
      } else {
        toast.error(res.data.message || "Verification failed");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Verification failed");
    } finally {
      setVerifying((prev) => ({ ...prev, [recordId]: false }));
    }
  };

  const updateVerifyForm = (recordId, field, value) => {
    setVerifyForm((prev) => ({
      ...prev,
      [recordId]: { ...(prev[recordId] || {}), [field]: value },
    }));
  };

  const handleDownloadStatement = async () => {
    if (!filterTenant) {
      toast.error("Select a tenant to download their TDS statement");
      return;
    }
    const year = filterFiscalYear || String(currentYear);
    try {
      setDownloading(true);
      const res = await api.get(`/api/rent/tds/certificate/${filterTenant}`, {
        params: { nepaliYear: year },
        responseType: "blob",
      });
      const tenantName =
        tenants.find((t) => t._id === filterTenant)?.name || "Tenant";
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `TDS-Statement-${tenantName}-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("TDS statement downloaded");
    } catch {
      toast.error("Failed to generate statement");
    } finally {
      setDownloading(false);
    }
  };

  const pendingCount = records.filter((r) => r.status !== "verified").length;

  return (
    <div className=" p-4 ">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            TDS Quarterly Verification
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track IRD certificates received from tenants — one bucket per
            quarter
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleDownloadStatement}
          disabled={downloading || !filterTenant}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          {downloading ? "Generating…" : "Download TDS Statement"}
        </Button>
      </div>
      <div className="flex  flex-col justifiy-between gap-4">

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">
                  Tenant
                </label>
                <Select
                  value={filterTenant || "all"}
                  onValueChange={(v) => setFilterTenant(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All tenants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tenants</SelectItem>
                    {tenants.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">
                  Fiscal Year
                </label>
                <Select
                  value={filterFiscalYear || "all"}
                  onValueChange={(v) =>
                    setFilterFiscalYear(v === "all" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {Array.from({ length: 5 }, (_, i) => currentYear - i).map(
                      (y) => (
                        <SelectItem key={y} value={y.toString()}>
                          FY {y}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">
                  Quarter
                </label>
                <Select
                  value={filterQuarter || "all"}
                  onValueChange={(v) => setFilterQuarter(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All quarters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All quarters</SelectItem>
                    {[1, 2, 3, 4].map((q) => (
                      <SelectItem key={q} value={q.toString()}>
                        {QUARTER_LABELS[q]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">
                  Status
                </label>
                <Select
                  value={filterStatus || "all"}
                  onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="certificate_received">
                      Certificate Received
                    </SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={fetchRecords}
                  className="w-full"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {pendingCount > 0 && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="w-4 h-4" />
                <p className="text-sm font-medium">
                  {pendingCount} quarterly payment
                  {pendingCount !== 1 ? "s" : ""} awaiting verification
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Quarterly TDS Buckets ({records.length})
            </CardTitle>
            <CardDescription>
              Each bucket covers one IRD remittance (3 months). Upload the
              challan/certificate received from tenant, then verify.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading...
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium">No records found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Quarterly buckets are created automatically when rents with TDS
                  are posted.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((record) => {
                  const statusCfg =
                    STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
                  const isOpen = expanded === record._id;
                  const form = verifyForm[record._id] || {};
                  const canVerify =
                    record.certificateUrls?.length > 0 &&
                    record.status !== "verified";

                  return (
                    <div
                      key={record._id}
                      className="border rounded-lg overflow-hidden"
                    >
                      <button
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/40 text-left"
                        onClick={() =>
                          setExpanded(isOpen ? null : record._id)
                        }
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium text-sm">
                              {record.tenant?.name || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              FY {record.fiscalYear} —{" "}
                              {QUARTER_LABELS[record.quarter]}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              RS{" "}
                              {(record.totalTdsPaisa / 100).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {record.months?.length || 0} month
                              {record.months?.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={statusCfg.className}
                          >
                            {statusCfg.label}
                          </Badge>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t bg-muted/20 p-4 space-y-4">
                          {/* Monthly breakdown table */}
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                              Monthly Breakdown
                            </p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Period</TableHead>
                                  <TableHead>Gross Rent</TableHead>
                                  <TableHead>TDS Amount</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {record.months?.map((m, i) => (
                                  <TableRow key={i}>
                                    <TableCell>
                                      {NEPALI_MONTH_NAMES?.[
                                        (m.nepaliMonth || 1) - 1
                                      ] || m.nepaliMonth}{" "}
                                      {m.nepaliYear}
                                    </TableCell>
                                    <TableCell>
                                      RS{" "}
                                      {(
                                        (m.rentId?.grossRentAmountPaisa || 0) /
                                        100
                                      ).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                      RS{" "}
                                      {(
                                        (m.rentId?.tdsAmountPaisa ||
                                          m.tdsAmountPaisa ||
                                          0) / 100
                                      ).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                      {m.rentId?.tdsPaidToGovernment ? (
                                        <span className="text-green-600 text-xs font-medium">
                                          Verified
                                        </span>
                                      ) : (
                                        <span className="text-amber-600 text-xs font-medium">
                                          Pending
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Uploaded documents list */}
                          {record.certificateUrls?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                Uploaded Documents ({record.certificateUrls.length})
                              </p>
                              <div className="space-y-1">
                                {record.certificateUrls.map((url, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 text-xs text-muted-foreground"
                                  >
                                    <FileText className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">
                                      {url.split("/").pop()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Upload + verify form (only if not yet verified) */}
                          {record.status !== "verified" && (
                            <div className="space-y-4">
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                  Upload IRD Certificate / Deposit Challan
                                </p>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="hidden"
                                    ref={(el) => {
                                      fileInputRefs.current[record._id] = el;
                                    }}
                                    onChange={(e) =>
                                      handleFileUpload(
                                        record._id,
                                        record.tenant?._id,
                                        e.target.files?.[0],
                                      )
                                    }
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    disabled={uploading[record._id]}
                                    onClick={() =>
                                      fileInputRefs.current[record._id]?.click()
                                    }
                                  >
                                    <Upload className="w-3 h-3" />
                                    {uploading[record._id]
                                      ? "Uploading…"
                                      : "Upload File"}
                                  </Button>
                                  <p className="text-xs text-muted-foreground">
                                    PDF, JPG, PNG — multiple uploads allowed
                                  </p>
                                </div>
                              </div>

                              {canVerify ? (
                                <div className="border rounded-md p-4 space-y-3 bg-background">
                                  <p className="text-sm font-semibold">
                                    Verify IRD Payment
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs font-medium block mb-1">
                                        IRD Challan / Voucher Number
                                      </label>
                                      <Input
                                        placeholder="e.g. CHN-2081-00123"
                                        value={form.challanNumber || ""}
                                        onChange={(e) =>
                                          updateVerifyForm(
                                            record._id,
                                            "challanNumber",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium block mb-1">
                                        Date Tenant Paid IRD{" "}
                                        <span className="text-red-500">*</span>
                                      </label>
                                      <DualCalendarTailwind
                                        value={form.paymentDate || ""}
                                        nepaliValue={
                                          form.nepaliPaymentDate || ""
                                        }
                                        onChange={(ad, bs) => {
                                          updateVerifyForm(
                                            record._id,
                                            "paymentDate",
                                            ad,
                                          );
                                          updateVerifyForm(
                                            record._id,
                                            "nepaliPaymentDate",
                                            bs,
                                          );
                                        }}
                                        placeholder="Select date"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium block mb-1">
                                      Notes (optional)
                                    </label>
                                    <Input
                                      placeholder="Additional notes"
                                      value={form.notes || ""}
                                      onChange={(e) =>
                                        updateVerifyForm(
                                          record._id,
                                          "notes",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                  <Button
                                    onClick={() => handleVerify(record._id)}
                                    disabled={
                                      verifying[record._id] || !form.paymentDate
                                    }
                                    className="w-full"
                                  >
                                    {verifying[record._id]
                                      ? "Verifying…"
                                      : `Verify Q${record.quarter} — RS ${(record.totalTdsPaisa / 100).toLocaleString()}`}
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Upload at least one IRD certificate to enable
                                  verification.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Verified summary */}
                          {record.status === "verified" && (
                            <div className="text-sm text-green-700 bg-green-50 rounded-md p-3 space-y-1">
                              <p className="font-medium flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" /> Verified
                              </p>
                              {record.challanNumber && (
                                <p className="text-xs">
                                  Challan: {record.challanNumber}
                                </p>
                              )}
                              {record.nepaliPaymentDate && (
                                <p className="text-xs">
                                  IRD payment date: {record.nepaliPaymentDate}
                                </p>
                              )}
                              {record.verifiedBy?.name && (
                                <p className="text-xs">
                                  Verified by: {record.verifiedBy.name}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TdsVerificationPage;
