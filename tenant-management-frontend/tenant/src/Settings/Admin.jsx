import React, { useState, useEffect } from "react";
import { useFormik } from "formik";
import api from "../../plugins/axios";
import { useAuth } from "../context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import SettingTab from "./components/settingTab";
import StaffDetail from "./components/staffDetail";
import SubMetersTab from "../Submeter/components/SubMetersTab";
import useProperty from "@/hooks/use-property";
import SystemSettingsTab from "./components/SystemSettingTab";
import {
  Settings,
  Users,
  TrendingUp
} from "lucide-react";
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

  const languages = [{ code: "en", name: "English", flag: "🇺🇸" }];
  const propertyId = property?.[0]?._id;

  const searchParams = new URLSearchParams(location.search);
  const urlTab = searchParams.get("tab");
  const initialTab =
    urlTab === "subMeters" || location.pathname.includes("sub-meters")
      ? "subMeters"
      : "settings";

  // ─── API Calls
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

  // ─── Formik
  const bankAccountFormik = useFormik({
    initialValues: { accountNumber: "", accountName: "", bankName: "", balance: "" },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        const response = await api.post("/api/bank/create-bank-account", {
          ...values,
          balance: parseFloat(values.balance) || 0,
        });
        if (response.data.success) {
          toast.success(response.data.message || "Bank account created successfully");
          resetForm();
          GetBankAccounts();
        }
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || "Failed to create bank account");
      } finally {
        setSubmitting(false);
      }
    },
  });

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

  const handleDeleteClick = (accountId) => {
    setAccountToDelete(accountId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete) DeleteBankAccount(accountToDelete);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm sm:text-base text-slate-500">
          Manage your account preferences, admin details, and financial settings
        </p>
      </div>

      {/* Vertical Tabs Layout */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
        <Tabs defaultValue={initialTab} className="flex-1 flex sm:flex-row">
          {/* Tabs List */}
          <TabsList className="flex sm:flex-col w-full sm:w-52 flex-row justify-start sm:justify-start overflow-x-auto sm:overflow-visible space-x-2 sm:space-x-0 sm:space-y-2">
            <TabsTrigger className="flex items-center space-x-2 sm:space-x-2 sm:justify-start p-2 hover:bg-slate-100 rounded" value="settings">
              <Settings size={20} />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger className="flex items-center space-x-2 sm:space-x-2 sm:justify-start p-2 hover:bg-slate-100 rounded" value="staffDetails">
              <Users size={20} />
              <span className="hidden sm:inline">Staff Details</span>
            </TabsTrigger>
            <TabsTrigger className="flex items-center space-x-2 sm:space-x-2 sm:justify-start p-2 hover:bg-slate-100 rounded" value="rentEscalation">
              <TrendingUp size={20} />
              <span className="hidden sm:inline">Rate & Fees</span>
            </TabsTrigger>
          </TabsList>

          {/* Tabs Content */}
          <div className="flex-1 mt-4 sm:mt-0">
            <TabsContent value="settings">
              <div className="overflow-x-auto">
                <SettingTab
                  user={user}
                  bankAccounts={bankAccounts}
                  bankAccountFormik={bankAccountFormik}
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
              </div>
            </TabsContent>

            <TabsContent value="staffDetails">
              <div className="overflow-x-auto">
                <StaffDetail staff={staff} />
              </div>
            </TabsContent>

            <TabsContent value="subMeters">
              <div className="overflow-x-auto">
                <SubMetersTab propertyId={propertyId} />
              </div>
            </TabsContent>

            <TabsContent value="rentEscalation">
              <div className="overflow-x-auto">
                <SystemSettingsTab propertyId={propertyId} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}