import { Routes, Route, useLocation, useParams, Navigate } from "react-router-dom";
import Signup from "./Auth/Signup";
import Login from "./Auth/Login";

import AppLayout from "./components/layout/Applayout";
import Tenants from "./Tenant/tenants";
import Dashboard from "./Dashboard/Dashboard";

import Account from "./Accounts/Account";
import ElectricityPage from "./electricity/ElectricityPage";
import Revenue from "./Revenue";
import Maintenance from "./Maintenance/Maintenance";
import Cheque_drafts from "./Cheque_drafts";
import Payments from "./payments";
import AddTenants from "./Tenant/addTenant/addTenants";

import VerifyEmail from "./verify_email";
import EditTenant from "./Tenant/editTenant/editTenant";
import Admin from "./Settings/Admin";
import ProtectedRoutes, { GuestRoute } from "./protectedRoutes";
import Test from "./test";

import RentPayment from "./RentPaymentDashboard/RentPayment";
import ViewDetail from "./ViewDetail/ViewDetail";
import BroadCast from "./BroadCast";

function TenantDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/tenant/viewDetail/${id}`} replace />;
}

export default function App() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const hideSidebar = path.startsWith("/login") || path.startsWith("/signup");

  const routedContent = (
    <Routes>
      <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />

      <Route
        path="/tenant/tenants"
        element={
          <ProtectedRoutes>
            <Tenants />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/tenants"
        element={
          <ProtectedRoutes>
            <Tenants />
          </ProtectedRoutes>
        }
      />
      {/* Redirect old /tenants/:id URLs (e.g. from search) to tenant detail */}
      <Route
        path="/tenants/:id"
        element={
          <ProtectedRoutes>
            <TenantDetailRedirect />
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
        path="/electricity"
        element={
          <ProtectedRoutes>
            <ElectricityPage />
          </ProtectedRoutes>
        }
      />

      <Route
        path="/rent-payment"
        element={
          <ProtectedRoutes>
            <RentPayment />
          </ProtectedRoutes>
        }
      />
      <Route
        path="/accounting"
        element={
          <ProtectedRoutes>
            <Account />
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
        path="/rent-payment/payments/:id"
        element={
          <ProtectedRoutes>
            <Payments />
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
      <Route
        path="/tenant/send-message"
        element={
          <ProtectedRoutes>
            <BroadCast />
          </ProtectedRoutes>
        }
      />
    </Routes>
  );

  return (
    <>{hideSidebar ? routedContent : <AppLayout>{routedContent}</AppLayout>}</>
  );
}
