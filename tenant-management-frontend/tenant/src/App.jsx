import { Routes, Route, useLocation } from "react-router-dom";
import Signup from "./Signup";
import Login from "./Login";
import { Toaster } from "@/components/ui/sonner";
import Home from "./Home";
import AppLayout from "./components/layout/Applayout";
import Tenants from "./tenants";
import Dashboard from "./Dashboard";
import Rent_Payment from "./Rent_Payment";
import Accounting from "./Accounting";
import Revenue from "./Revenue";
import Maintenance from "./Maintenance";
import Cheque_drafts from "./Cheque_drafts";
import AddTenants from "./addTenants";
import Demo from "./demo";
import VerifyEmail from "./verify_email";
import EditTenant from "./editTenant";
import Admin from "./Admin";

export default function App() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const hideSidebar = path.startsWith("/login") || path.startsWith("/signup");

  const routedContent = (
    <Routes>
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />

      <Route path="/tenants" element={<Tenants />} />
      <Route path="/" element={<Dashboard />} />
      <Route path="/rent-payment" element={<Rent_Payment />} />
      <Route path="/accounting" element={<Accounting />} />
      <Route path="/revenue" element={<Revenue />} />
      <Route path="/maintenance" element={<Maintenance />} />
      <Route path="/cheque-drafts" element={<Cheque_drafts />} />
      <Route path="/tenant/addTenants" element={<AddTenants />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/tenant/editTenant" element={<EditTenant />} />
      <Route path="/admin" element={<Admin />} />
      
    </Routes>
  );

  return (
    <>{hideSidebar ? routedContent : <AppLayout>{routedContent}</AppLayout>}</>
  );
}
