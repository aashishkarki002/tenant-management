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
import ProtectedRoutes from "./protectedRoutes";
import Test from "./test";
import ViewDetail from "./ViewDetail";
export default function App() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const hideSidebar = path.startsWith("/login") || path.startsWith("/signup");

  const routedContent = (
    <Routes>
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/tenants"
        element={
          <ProtectedRoutes>
            <Tenants />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoutes>
            <Dashboard />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/rent-payment"
        element={
          <ProtectedRoutes>
            <Rent_Payment />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/accounting"
        element={
          <ProtectedRoutes>
            <Accounting />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/revenue"
        element={
          <ProtectedRoutes>
            <Revenue />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/maintenance"
        element={
          <ProtectedRoutes>
            <Maintenance />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/cheque-drafts"
        element={
          <ProtectedRoutes>
            <Cheque_drafts />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/tenant/addTenants"
        element={
          <ProtectedRoutes>
            <AddTenants />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/demo"
        element={
          <ProtectedRoutes>
            <Demo />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/verify-email"
        element={
          <ProtectedRoutes>
            <VerifyEmail />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/tenant/editTenant/:id"
        element={
          <ProtectedRoutes>
            <EditTenant />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoutes>
            <Admin />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/test"
        element={
          <ProtectedRoutes>
            <Test />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/tenant/viewDetail/:id"
        element={
          <ProtectedRoutes>
            <ViewDetail />
          </ProtectedRoutes>
        }
      />
    </Routes>
  );

  return (
    <>{hideSidebar ? routedContent : <AppLayout>{routedContent}</AppLayout>}</>
  );
}
