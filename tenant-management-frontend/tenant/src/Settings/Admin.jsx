/**
 * AdminRoot.jsx
 *
 * Full Admin Settings page — four tabs, real API data, clean prop drilling.
 * OrganizationTab is self-contained (owns useOwnership hook internally).
 * All other tabs receive only the props they need from the root.
 */

import React, { useState, useEffect, useRef } from "react";
import { useFormik } from "formik";
import api from "../../plugins/axios";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "react-router-dom";
import useProperty from "@/hooks/use-property";
import { toast } from "sonner";

// shadcn
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Icons
import {
  Settings, Users, TrendingUp, Building2, Shield, Plus, Trash2,
  Pencil, Camera, Upload, Lock, Save, Phone, CreditCard, Zap,
  CheckCircle2, AlertTriangle, Info, Clock,
} from "lucide-react";

// Sub-components
import AddBankAccount from "./components/AddBankAccount";
import EditBankAccount from "./components/EditBankAccount";
import AddStaffDialog from "./components/AddStaffDialog";
import ElectricityRateTab from "./components/electricityRateTab";
import { OrganizationTab } from "../Buildings/organization/OrganizationTab";

// ─── Shared helpers ───────────────────────────────────────────────────────────
const getInitials = (name) =>
  name ? name.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?";

function InfoBanner({ children, variant = "info" }) {
  const map = {
    info: { cls: "bg-blue-50 border-blue-200 text-blue-800", Icon: Info },
    warning: { cls: "bg-amber-50 border-amber-200 text-amber-800", Icon: AlertTriangle },
    success: { cls: "bg-emerald-50 border-emerald-200 text-emerald-800", Icon: CheckCircle2 },
    danger: { cls: "bg-red-50 border-red-200 text-red-800", Icon: AlertTriangle },
  };
  const { cls, Icon } = map[variant] ?? map.info;
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium ${cls}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{children}</span>
    </div>
  );
}

// ─── Late fee preview (used by RatesTab) ──────────────────────────────────────
function LateFeePreview({ lateFee }) {
  const RENT = 50000;
  const grace = Number(lateFee.gracePeriodDays) || 0;
  const rate = Number(lateFee.amount) || 0;
  const cap = Number(lateFee.maxLateFeeAmount) || 0;

  const feeAt = (d) => {
    const eff = d - grace;
    if (eff <= 0) return null;
    let fee = lateFee.type === "fixed" ? rate
      : lateFee.type === "simple_daily" ? RENT * (rate / 100) * eff
        : lateFee.type === "percentage" && lateFee.compounding ? RENT * (Math.pow(1 + rate / 100, eff) - 1)
          : RENT * (rate / 100);
    if (cap > 0) fee = Math.min(fee, cap);
    return Math.round(fee * 100) / 100;
  };

  const days = [1, grace + 1, 5, 10, 30].filter((d, i, a) => d > 0 && a.indexOf(d) === i);

  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-4 py-4 space-y-3">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        Live Preview · Rs. {RENT.toLocaleString("en-NP")} rent
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {["Day", "Eff. Days", "Fee"].map((h, i) => (
              <th key={h} className={`py-2 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider ${i === 2 ? "text-right" : "text-left pr-4"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const fee = feeAt(day);
            return (
              <tr key={day} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-4 text-muted-foreground font-mono">Day {day}</td>
                <td className="py-2 pr-4 text-muted-foreground font-mono">
                  {fee === null ? <span className="italic opacity-50">grace</span> : day - grace}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {fee === null
                    ? <span className="italic opacity-50">—</span>
                    : <span className={cap > 0 && fee >= cap ? "text-amber-600" : "text-foreground"}>
                      Rs. {fee.toLocaleString("en-NP", { maximumFractionDigits: 2 })}
                    </span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: General
// Props: user, bankAccounts, getBankAccounts
// ═══════════════════════════════════════════════════════════════════════════════
function GeneralTab({ user, bankAccounts, getBankAccounts }) {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [toEdit, setToEdit] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5 MB"); return; }
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const uploadPhoto = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("profilePicture", pendingFile);
      const res = await api.patch("/api/auth/update-profile-picture", fd);
      if (res.data.success) { toast.success("Photo updated"); setPendingFile(null); setPreview(null); }
    } catch (err) { toast.error(err?.response?.data?.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const changePw = async (e) => {
    e.preventDefault();
    setPwError(""); setPwSuccess(false);
    if (newPw.length < 8) return setPwError("Minimum 8 characters");
    if (newPw !== confirmPw) return setPwError("Passwords do not match");
    if (!currentPw) return setPwError("Enter your current password");
    try {
      const res = await api.patch("/api/auth/change-password", { oldPassword: currentPw, newPassword: newPw });
      if (res.data.success) {
        toast.success(res.data.message);
        setPwSuccess(true);
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
        setTimeout(() => setPwSuccess(false), 3000);
      }
    } catch (err) { setPwError(err?.response?.data?.message || "Failed"); }
  };

  const addBankFormik = useFormik({
    initialValues: { accountNumber: "", accountName: "", bankName: "", accountCode: "", openingBalance: "" },
    onSubmit: async (vals, { setSubmitting, resetForm }) => {
      if (!vals.accountCode.trim()) { toast.error("Account code required"); setSubmitting(false); return; }
      try {
        const res = await api.post("/api/bank/create-bank-account", {
          ...vals, accountCode: vals.accountCode.toUpperCase().trim(),
          openingBalance: parseFloat(vals.openingBalance) || 0,
        });
        if (res.data.success) { toast.success("Created"); resetForm(); getBankAccounts(); setAddOpen(false); }
      } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
      finally { setSubmitting(false); }
    },
  });

  const editBankFormik = useFormik({
    initialValues: { accountNumber: "", accountName: "", bankName: "", accountCode: "" },
    enableReinitialize: true,
    onSubmit: async (vals, { setSubmitting }) => {
      try {
        const res = await api.patch(`/api/bank/update-bank-account/${toEdit?._id}`, {
          ...vals, accountCode: vals.accountCode.toUpperCase().trim(),
        });
        if (res.data.success) { toast.success("Updated"); getBankAccounts(); setEditOpen(false); setToEdit(null); }
      } catch (err) { toast.error(err.response?.data?.message || "Failed"); }
      finally { setSubmitting(false); }
    },
  });

  const openEdit = (acc) => {
    setToEdit(acc);
    editBankFormik.setValues({ accountNumber: acc.accountNumber || "", accountName: acc.accountName || "", bankName: acc.bankName || "", accountCode: acc.accountCode || "" });
    setEditOpen(true);
  };

  const deleteBank = async () => {
    try {
      const res = await api.patch(`/api/bank/delete-bank-account/${toDelete}`);
      if (res.data.success) { toast.success("Deleted"); getBankAccounts(); }
    } catch (err) { toast.error(err?.response?.data?.message || "Failed"); }
    finally { setDelOpen(false); setToDelete(null); }
  };

  const displaySrc = preview || user?.profilePicture || null;

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card className="border-border">
        <CardHeader className="pb-4 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center"><Settings className="w-3.5 h-3.5 text-white" /></div>
            Profile Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative group focus:outline-none">
                    <Avatar className="w-20 h-20 border-2 border-border">
                      <AvatarImage src={displaySrc} />
                      <AvatarFallback className="bg-slate-100 text-slate-600 text-lg font-bold">{getInitials(user?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-40">
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4" />Change photo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {pendingFile && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={uploadPhoto} disabled={uploading} className="h-7 text-xs">{uploading ? "Uploading…" : "Save"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPreview(null); setPendingFile(null); }} className="h-7 text-xs">Cancel</Button>
                </div>
              )}
            </div>
            {/* Fields */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {[
                { label: "Full Name", val: user?.name },
                { label: "Email", val: user?.email, type: "email" },
                { label: "Phone", val: user?.phone },
                { label: "Role", val: user?.role, readOnly: true },
              ].map(({ label, val, type = "text", readOnly }) => (
                <div key={label} className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
                  <Input type={type} defaultValue={val} readOnly={readOnly}
                    className={`h-9 ${readOnly ? "bg-secondary text-muted-foreground capitalize" : ""}`} />
                </div>
              ))}
              <div className="sm:col-span-2 flex justify-end">
                <Button className="gap-2 h-8 text-xs px-4"><Save className="w-3.5 h-3.5" />Save Profile</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Accounts */}
      <Card className="border-border">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center"><CreditCard className="w-3.5 h-3.5 text-white" /></div>
              Bank Accounts
            </CardTitle>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 h-8 text-xs px-3"><Plus className="w-3.5 h-3.5" />Add Account</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Bank Account</DialogTitle>
                  <DialogDescription>Link a bank account for rent collection.</DialogDescription>
                </DialogHeader>
                <AddBankAccount formik={addBankFormik} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">
          {!bankAccounts?.length ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
              <CreditCard className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No bank accounts yet</p>
            </div>
          ) : bankAccounts.map((acc) => (
            <div key={acc._id} className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3 hover:bg-secondary/60 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white text-[10px] font-bold">
                  {(acc.bankName || "BK").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{acc.accountName || acc.bankName}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{acc.accountCode} · {acc.accountNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(acc)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  onClick={() => { setToDelete(acc._id); setDelOpen(true); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-border">
        <CardHeader className="pb-4 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center"><Lock className="w-3.5 h-3.5 text-white" /></div>
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={changePw} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Password</Label>
              <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="h-9" placeholder="••••••••" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Password</Label>
                <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="h-9" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm</Label>
                <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="h-9" placeholder="••••••••" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Minimum 8 characters.</p>
            {pwError && <InfoBanner variant="danger">{pwError}</InfoBanner>}
            {pwSuccess && <InfoBanner variant="success">Password changed successfully.</InfoBanner>}
            <Button type="submit" className="gap-2 h-8 text-xs px-4"><Shield className="w-3.5 h-3.5" />Update Password</Button>
          </form>
        </CardContent>
      </Card>

      {/* Edit bank dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setToEdit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Bank Account</DialogTitle></DialogHeader>
          <EditBankAccount formik={editBankFormik} balanceDisplay={toEdit?.balanceFormatted ?? "-"}
            onCancel={() => { setEditOpen(false); setToEdit(null); }} />
        </DialogContent>
      </Dialog>

      {/* Delete bank confirm */}
      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bank Account</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDelOpen(false); setToDelete(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBank} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: Staff
// Props: staff[], onRefresh()
// ═══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: Rates & Fees
// Props: propertyId
// ═══════════════════════════════════════════════════════════════════════════════
const ESC_DEF = { enabled: false, percentageIncrease: 5, intervalMonths: 12, appliesTo: "rent_only" };
const LF_DEF = { enabled: false, gracePeriodDays: 5, type: "simple_daily", amount: 2, appliesTo: "rent", compounding: false, maxLateFeeAmount: 5000 };
const FEE_TYPES = [
  { value: "simple_daily", label: "Daily (Linear)", description: "balance × rate% × days — grows linearly" },
  { value: "percentage", label: "One-Time %", description: "Charged once on first day past grace" },
  { value: "fixed", label: "Fixed Amount", description: "Flat rupee amount charged once" },
];

function RatesTab({ propertyId }) {
  const [esc, setEsc] = useState(ESC_DEF);
  const [lf, setLf] = useState(LF_DEF);
  const [fetching, setFetching] = useState(true);
  const [savingEsc, setSavingEsc] = useState(false);
  const [savingLf, setSavingLf] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = async () => {
    try {
      setFetching(true);
      const res = await api.get("/api/settings/system");
      if (res.data.success) {
        const { escalation, lateFee } = res.data.data;
        if (escalation) setEsc(escalation);
        if (lateFee) setLf(lateFee);
      }
    } catch { toast.error("Failed to load system settings"); }
    finally { setFetching(false); }
  };

  useEffect(() => { load(); }, []);

  const saveEsc = async () => {
    try {
      setSavingEsc(true);
      const res = await api.post("/api/settings/system/escalation", {
        enabled: esc.enabled, percentageIncrease: Number(esc.percentageIncrease),
        intervalMonths: Number(esc.intervalMonths), appliesTo: esc.appliesTo,
      });
      if (res.data.success) { toast.success("Escalation saved"); await load(); }
      else toast.error(res.data.message);
    } catch { toast.error("Failed to save"); }
    finally { setSavingEsc(false); }
  };

  const applyAll = async () => {
    try {
      setApplying(true);
      const res = await api.post("/api/settings/system/escalation/apply-all");
      if (res.data.success) {
        const { applied = 0, failed = 0 } = res.data;
        failed > 0 ? toast.warning(`Applied to ${applied}. ${failed} failed.`) : toast.success(`Enabled for ${applied} tenants`);
        await load();
      }
    } catch { toast.error("Failed to apply"); }
    finally { setApplying(false); }
  };

  const saveLf = async () => {
    try {
      setSavingLf(true);
      const res = await api.post("/api/settings/system/late-fee", {
        enabled: lf.enabled, gracePeriodDays: Number(lf.gracePeriodDays),
        type: lf.type, amount: Number(lf.amount), appliesTo: lf.appliesTo,
        compounding: lf.type === "percentage" ? lf.compounding : false,
        maxLateFeeAmount: Number(lf.maxLateFeeAmount),
      });
      if (res.data.success) { toast.success("Late fee policy saved"); await load(); }
      else toast.error(res.data.message);
    } catch { toast.error("Failed to save"); }
    finally { setSavingLf(false); }
  };

  if (fetching) return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      {/* Rent Escalation */}
      <Card className="border-border">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center"><TrendingUp className="w-3.5 h-3.5 text-white" /></div>
              Rent Escalation
            </CardTitle>
            <Switch checked={esc.enabled} onCheckedChange={(v) => setEsc((s) => ({ ...s, enabled: v }))} />
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          {!esc.enabled && <InfoBanner variant="info">Enable to auto-increase rents on a schedule.</InfoBanner>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Increase %</Label>
              <Input type="number" min="0.1" max="100" step="0.1" value={esc.percentageIncrease} disabled={!esc.enabled}
                onChange={(e) => setEsc((s) => ({ ...s, percentageIncrease: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interval (months)</Label>
              <Input type="number" min="1" max="60" value={esc.intervalMonths} disabled={!esc.enabled}
                onChange={(e) => setEsc((s) => ({ ...s, intervalMonths: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Applies To</Label>
              <Select value={esc.appliesTo} onValueChange={(v) => setEsc((s) => ({ ...s, appliesTo: v }))} disabled={!esc.enabled}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent_only">Rent Only</SelectItem>
                  <SelectItem value="cam_only">CAM Only</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-8 text-xs px-4 gap-1.5" onClick={saveEsc} disabled={savingEsc}>
              <Save className="w-3 h-3" />{savingEsc ? "Saving…" : "Save Defaults"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs px-4" disabled={!esc.enabled || applying}>
                  {applying ? "Applying…" : "Apply to All Tenants"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apply escalation to all tenants?</AlertDialogTitle>
                  <AlertDialogDescription>Enables rent escalation with current defaults for all active tenants.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={applyAll}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Late Fee */}
      <Card className="border-border">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-white" /></div>
              Late Fee Policy
            </CardTitle>
            <Switch checked={lf.enabled} onCheckedChange={(v) => setLf((s) => ({ ...s, enabled: v }))} />
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {!lf.enabled && <InfoBanner variant="info">Enable to charge late fees on overdue rents.</InfoBanner>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {FEE_TYPES.map((ft) => (
              <button key={ft.value} disabled={!lf.enabled}
                onClick={() => setLf((s) => ({ ...s, type: ft.value }))}
                className={`rounded-xl border-2 px-3 py-3 text-left transition-all text-xs disabled:opacity-40
                  ${lf.type === ft.value ? "border-foreground bg-secondary" : "border-border hover:border-slate-400"}`}>
                <p className="font-semibold text-foreground mb-0.5">{ft.label}</p>
                <p className="text-muted-foreground leading-snug">{ft.description}</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Grace Days", key: "gracePeriodDays" },
              { label: lf.type === "fixed" ? "Amount (Rs)" : "Rate (%)", key: "amount" },
              { label: "Max Fee (Rs)", key: "maxLateFeeAmount" },
            ].map(({ label, key }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
                <Input type="number" min="0" step="0.01" value={lf[key]} disabled={!lf.enabled}
                  onChange={(e) => setLf((s) => ({ ...s, [key]: e.target.value }))} className="h-9" />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Applies To</Label>
              <Select value={lf.appliesTo} onValueChange={(v) => setLf((s) => ({ ...s, appliesTo: v }))} disabled={!lf.enabled}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="cam">CAM</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {lf.type === "percentage" && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
              <Switch checked={lf.compounding} onCheckedChange={(v) => setLf((s) => ({ ...s, compounding: v }))} disabled={!lf.enabled} />
              <div>
                <Label className="text-sm font-medium text-foreground">Compounding</Label>
                <p className="text-[11px] text-muted-foreground">Daily exponential growth. Use with caution.</p>
              </div>
            </div>
          )}
          {lf.enabled && <LateFeePreview lateFee={lf} />}
          <Button size="sm" className="h-8 text-xs px-4 gap-1.5" onClick={saveLf} disabled={savingLf}>
            <Save className="w-3 h-3" />{savingLf ? "Saving…" : "Save Late Fee Policy"}
          </Button>
        </CardContent>
      </Card>

      {/* Electricity Rate */}
      <Card className="border-border">
        <CardHeader className="pb-4 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-white" /></div>
            Electricity Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ElectricityRateTab propertyId={propertyId} />
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT — Admin
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminRoot() {
  const { user } = useAuth();
  const { property } = useProperty();
  const location = useLocation();

  const [bankAccounts, setBankAccounts] = useState([]);
  const [staff, setStaff] = useState([]);
  const propertyId = property?.[0]?._id;

  const searchParams = new URLSearchParams(location.search);
  const urlTab = searchParams.get("tab");
  const initialTab = ["general", "staff", "rates", "organization"].includes(urlTab) ? urlTab : "general";

  const getBankAccounts = async () => {
    try {
      const res = await api.get("/api/bank/get-bank-accounts");
      setBankAccounts(res.data.bankAccounts || []);
    } catch { /* silent — table shows empty state */ }
  };

  const getStaff = async () => {
    try {
      const res = await api.get("/api/staff/get-staffs");
      setStaff(res.data.data || []);
    } catch { /* silent */ }
  };

  useEffect(() => { getBankAccounts(); getStaff(); }, []);

  const NAV = [
    { value: "general", Icon: Settings, label: "General" },

    { value: "rates", Icon: TrendingUp, label: "Rates & Fees" },
    { value: "organization", Icon: Building2, label: "Organization" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Page heading */}
        <div className="mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your property, staff, financial policies, and entity ownership.
            </p>
          </div>
        </div>

        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="flex w-full justify-start h-auto p-1 bg-secondary rounded-xl mb-6 gap-0.5 overflow-x-auto">
            {NAV.map(({ value, Icon, label }) => (
              <TabsTrigger key={value} value={value}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0
                  text-muted-foreground
                  data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm
                  transition-all">
                <Icon className="w-4 h-4" /><span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Each tab receives ONLY the props it needs */}
          <TabsContent value="general">
            <GeneralTab
              user={user}
              bankAccounts={bankAccounts}
              getBankAccounts={getBankAccounts}
            />
          </TabsContent>



          <TabsContent value="rates">
            <RatesTab propertyId={propertyId} />
          </TabsContent>


        </Tabs>
      </div>
    </div>
  );
}