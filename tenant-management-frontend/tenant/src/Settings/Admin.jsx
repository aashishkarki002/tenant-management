import React, { useState, useEffect, useRef } from "react";
import { useFormik } from "formik";
import api from "../../plugins/axios";
import { useAuth } from "../context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import SettingTab from "./components/settingTab";
import StaffDetail from "./components/staffDetail";

import useProperty from "@/hooks/use-property";
import SystemSettingsTab from "./components/SystemSettingTab";
import { Settings, Users, TrendingUp } from "lucide-react";
import { useLocation } from "react-router-dom";

export default function Admin() {
  const { user } = useAuth();
  const { property } = useProperty();
  const location = useLocation();

  const [bankAccounts, setBankAccounts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const addBankCloseRef = useRef(null);

  const languages = [{ code: "en", name: "English", flag: "🇺🇸" }];
  const propertyId = property?.[0]?._id;

  const searchParams = new URLSearchParams(location.search);
  const urlTab = searchParams.get("tab");
  const initialTab =
    urlTab === "subMeters" || location.pathname.includes("sub-meters")
      ? "subMeters"
      : "settings";

  // ─── API calls ────────────────────────────────────────────────────────────

  const GetBankAccounts = async () => {
    try {
      const response = await api.get("/api/bank/get-bank-accounts");
      setBankAccounts(response.data.bankAccounts || []);
    } catch (err) {
      console.error(err);
    }
  };

  const ChangePassword = async (values) => {
    const response = await api.patch("/api/auth/change-password", values);
    if (response.data.success) toast.success(response.data.message);
  };

  const DeleteBankAccount = async (id) => {
    try {
      const response = await api.patch(`/api/bank/delete-bank-account/${id}`);
      if (response.data.success) {
        GetBankAccounts();
        toast.success("Bank account deleted successfully");
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to delete bank account");
    } finally {
      setDeleteConfirmOpen(false);
      setAccountToDelete(null);
    }
  };

  const getStaff = async () => {
    try {
      const response = await api.get("/api/staff/get-staffs");
      setStaff(response.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    GetBankAccounts();
    getStaff();
  }, []);

  // ─── Bank account formik ──────────────────────────────────────────────────
  const bankAccountFormik = useFormik({
    initialValues: {
      accountNumber: "",
      accountName: "",
      bankName: "",
      accountCode: "",
      openingBalance: "",
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      if (!values.accountCode.trim()) {
        toast.error(
          "Account code is required (e.g. '1010-NABIL'). " +
          "It must match a code in your chart of accounts.",
        );
        setSubmitting(false);
        return;
      }

      try {
        const response = await api.post("/api/bank/create-bank-account", {
          accountNumber: values.accountNumber,
          accountName: values.accountName,
          bankName: values.bankName,
          accountCode: values.accountCode.toUpperCase().trim(),
          openingBalance: parseFloat(values.openingBalance) || 0,
        });

        if (response.data.success) {
          toast.success(response.data.message || "Bank account created successfully");
          resetForm();
          GetBankAccounts();
          addBankCloseRef.current?.();
        }
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || "Failed to create bank account");
      } finally {
        setSubmitting(false);
      }
    },
  });

  // ─── Password change ──────────────────────────────────────────────────────

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 8) return setPasswordError("Password must be at least 8 characters");
    if (newPassword !== confirmPassword) return setPasswordError("Passwords do not match");
    if (!currentPassword) return setPasswordError("Please enter your current password");

    try {
      await ChangePassword({ oldPassword: currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err?.response?.data?.message || "Failed to change password");
    }
  };

  // ─── Delete helpers ───────────────────────────────────────────────────────

  const handleDeleteClick = (accountId) => {
    setAccountToDelete(accountId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete) DeleteBankAccount(accountToDelete);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm sm:text-base text-slate-500">
          Manage your account preferences, admin details, and financial settings
        </p>
      </div>

      {/* 
        FIX: Tabs layout
        - On mobile: tabs nav scrolls horizontally as a single row
        - On desktop: tabs nav is a fixed-width left sidebar (flex-col), 
          content fills remaining space
        - Outer wrapper uses flex-col on mobile, flex-row on sm+
      */}
      <Tabs defaultValue={initialTab} className="w-full">
        {/* Tab nav bar */}
        <TabsList
          className="
            flex flex-row
            w-full
            overflow-x-auto
            whitespace-nowrap
            mb-6
            bg-slate-100
            rounded-lg
            p-1
            gap-1
          "
        >
          <TabsTrigger
            value="settings"
            className="
              flex items-center gap-2
              px-4 py-2
              rounded-md
              text-sm font-medium
              text-slate-600
              data-[state=active]:bg-white
              data-[state=active]:text-slate-900
              data-[state=active]:shadow-sm
              hover:text-slate-900
              transition-all
              shrink-0
            "
          >
            <Settings size={16} />
            <span>Settings</span>
          </TabsTrigger>

          <TabsTrigger
            value="staffDetails"
            className="
              flex items-center gap-2
              px-4 py-2
              rounded-md
              text-sm font-medium
              text-slate-600
              data-[state=active]:bg-white
              data-[state=active]:text-slate-900
              data-[state=active]:shadow-sm
              hover:text-slate-900
              transition-all
              shrink-0
            "
          >
            <Users size={16} />
            <span>Staff Details</span>
          </TabsTrigger>

          <TabsTrigger
            value="rentEscalation"
            className="
              flex items-center gap-2
              px-4 py-2
              rounded-md
              text-sm font-medium
              text-slate-600
              data-[state=active]:bg-white
              data-[state=active]:text-slate-900
              data-[state=active]:shadow-sm
              hover:text-slate-900
              transition-all
              shrink-0
            "
          >
            <TrendingUp size={16} />
            <span>Rate &amp; Fees</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab content panels */}
        <TabsContent value="settings">
          <SettingTab
            user={user}
            bankAccounts={bankAccounts}
            bankAccountFormik={bankAccountFormik}
            addBankCloseRef={addBankCloseRef}
            languages={languages}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            passwordError={passwordError}
            passwordSuccess={passwordSuccess}
            handlePasswordChange={handlePasswordChange}
            deleteConfirmOpen={deleteConfirmOpen}
            setDeleteConfirmOpen={setDeleteConfirmOpen}
            setAccountToDelete={setAccountToDelete}
            confirmDelete={confirmDelete}
            handleDeleteClick={handleDeleteClick}
            GetBankAccounts={GetBankAccounts}
          />
        </TabsContent>

        <TabsContent value="staffDetails">
          <StaffDetail staff={staff} />
        </TabsContent>

        <TabsContent value="rentEscalation">
          <SystemSettingsTab propertyId={propertyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}