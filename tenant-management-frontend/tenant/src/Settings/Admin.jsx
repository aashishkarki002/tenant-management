import React, { useState, useEffect } from "react";
import { useFormik } from "formik";
import api from "../../plugins/axios";
import { useAuth } from "../context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import ElectricityRateTab from "./components/electricityRateTab";
import SettingTab from "./components/settingTab";
import StaffDetail from "./components/staffDetail";
import SubMetersTab from "./components/SubMetersTab";
import useProperty from "@/hooks/use-property";
import RentEscalationTab from "./components/RentEscalationTab";

// ─── Main Admin / Settings Page ───────────────────────────────────────────────

export default function Admin() {
  const usemobile = useIsMobile();
  const { user } = useAuth();

  const [bankAccounts, setBankAccounts] = useState([]);

  const ChangePassword = async (values) => {
    const response = await api.patch("/api/auth/change-password", values);
    if (response.data.success) {
      toast.success(response.data.message);
    }
  };

  const GetBankAccounts = async () => {
    const response = await api.get("/api/bank/get-bank-accounts");
    const data = await response.data;
    setBankAccounts(data.bankAccounts);
  };

  useEffect(() => {
    GetBankAccounts();
  }, []);

  const bankAccountFormik = useFormik({
    initialValues: {
      accountNumber: "",
      accountName: "",
      bankName: "",
      balance: "",
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        const response = await api.post("/api/bank/create-bank-account", {
          accountNumber: values.accountNumber,
          accountName: values.accountName,
          bankName: values.bankName,
          balance: parseFloat(values.balance) || 0,
        });
        if (response.data.success) {
          toast.success(response.data.message || "Bank account created successfully");
          resetForm();
          GetBankAccounts();
        }
      } catch (error) {
        console.error("Error creating bank account:", error);
        toast.error(error.response?.data?.message || "Failed to create bank account");
      } finally {
        setSubmitting(false);
      }
    },
  });

  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const { property } = useProperty();
  const languages = [{ code: "en", name: "English", flag: "🇺🇸" }];

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (!currentPassword) {
      setPasswordError("Please enter your current password");
      return;
    }

    try {
      await ChangePassword({
        oldPassword: currentPassword,
        newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err?.response?.data?.message || "Failed to change password");
    }
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [staff, setStaff] = useState([]);

  const DeleteBankAccount = async (id) => {
    try {
      const response = await api.patch(`/api/bank/delete-bank-account/${id}`);
      if (response.data.success) {
        GetBankAccounts();
        toast.success("Bank account deleted successfully");
        setDeleteConfirmOpen(false);
        setAccountToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting bank account:", error);
      toast.error(error?.response?.data?.message || "Failed to delete bank account");
      setDeleteConfirmOpen(false);
      setAccountToDelete(null);
    }
  };

  const handleDeleteClick = (accountId) => {
    setAccountToDelete(accountId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete) DeleteBankAccount(accountToDelete);
  };

  async function getStaff() {
    const response = await api.get("/api/staff/get-staffs");
    const data = await response.data;
    setStaff(data.data);
  }

  useEffect(() => {
    getStaff();
  }, []);

  // propertyId — property is an array, get the first property's ID
  const propertyId = property?.[0]?._id;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">
          Manage your account preferences, admin details, and financial settings
        </p>
      </div>

      <Tabs defaultValue="settings" className="mt-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="staffDetails">Staff Details</TabsTrigger>
          <TabsTrigger value="electricityRate">Electricity Rate</TabsTrigger>
          <TabsTrigger value="subMeters">Sub-Meters</TabsTrigger>
          <TabsTrigger value="rentEscalation">Rent Escalation</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
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
        </TabsContent>

        <TabsContent value="staffDetails">
          <StaffDetail staff={staff} />
        </TabsContent>

        <TabsContent value="electricityRate">
          <ElectricityRateTab propertyId={propertyId} />
        </TabsContent>

        <TabsContent value="subMeters">
          <SubMetersTab propertyId={propertyId} />
        </TabsContent>

        <TabsContent value="rentEscalation">
          <RentEscalationTab />
        </TabsContent>
      </Tabs>
    </>
  );
}