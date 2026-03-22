import { Routes, Route, useLocation, useParams, Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Signup from "./Auth/Signup";
import Login from "./Auth/Login";
import Transaction from "./Dashboard/component/Transaction";
import AppLayout from "./components/layout/Applayout";
import Tenants from "./Tenant/tenants";
import Dashboard from "./Dashboard/Dashboard";
import StaffDashboard from "./Dashboard/StaffDashboard";
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
import ProtectedRoutes, { GuestRoute, RoleRoute } from "./protectedRoutes";
import Test from "./test";
import RentPayment from "./RentPaymentDashboard/RentPayment";
import ViewDetail from "./ViewDetail/ViewDetail";
import BroadCast from "./BroadCast";
import Submeter from "./submeter/Submeter";
import Generator from "./Generators/Generator";
import DailyChecks from "./DailyChecks/dailyChecks";
import Loans from "./Loans/loan";
import { setupSwMessageListener } from "./hooks/usePushNotification";
import AdminDailyChecks from "./adminDailyChecks/dailychecks";
import Units from "./units/units";
import api from "../plugins/axios";
import { useAuth } from "./context/AuthContext";

// Roles that can access admin-level features
const ADMIN_ROLES = ["admin", "super_admin"];
// All authenticated roles
const ALL_ROLES = ["admin", "super_admin", "staff"];

function TenantDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/tenant/viewDetail/${id}`} replace />;
}

/**
 * Role-aware dashboard — renders different home screen per role.
 * This is the standard pattern: one "/" route, role decides the view.
 */
function RoleDashboard() {
  const { user } = useAuth();
  if (user?.role === "staff") return <StaffDashboard />;
  return <Dashboard />;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.toLowerCase();
  const hideSidebar = path.startsWith("/login") || path.startsWith("/signup");

  useEffect(() => {
    return setupSwMessageListener(navigate, async (notificationId) => {
      try {
        await api.patch(
          `/api/notification/mark-notification-as-read/${notificationId}`
        );
        window.dispatchEvent(
          new CustomEvent("notification:read", { detail: notificationId })
        );
      } catch (err) {
        console.error("[push] Failed to mark notification as read:", err.message);
      }
    });
  }, [navigate]);

  const routedContent = (
    <Routes>
      {/* ── Public (guest-only) routes ── */}
      <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />

      {/* ── Shared routes: all authenticated roles ── */}
      <Route path="/"
        element={<ProtectedRoutes><RoleDashboard /></ProtectedRoutes>}
      />
      <Route path="/admin"
        element={<ProtectedRoutes><Admin /></ProtectedRoutes>}
      />
      <Route path="/maintenance"
        element={<ProtectedRoutes><Maintenance /></ProtectedRoutes>}
      />
      <Route path="/maintenance/generator"
        element={<ProtectedRoutes><Generator /></ProtectedRoutes>}
      />
      <Route path="/electricity"
        element={<ProtectedRoutes><ElectricityPage /></ProtectedRoutes>}
      />

      {/* Tenants — staff gets read-only view (enforcement is on individual actions/buttons) */}
      <Route path="/tenant/tenants"
        element={<ProtectedRoutes><Tenants /></ProtectedRoutes>}
      />
      <Route path="/tenants"
        element={<ProtectedRoutes><Tenants /></ProtectedRoutes>}
      />
      <Route path="/tenants/:id"
        element={<ProtectedRoutes><TenantDetailRedirect /></ProtectedRoutes>}
      />
      <Route path="/tenant/viewDetail/:id"
        element={<ProtectedRoutes><ViewDetail /></ProtectedRoutes>}
      />
      <Route path="/verify-email"
        element={<ProtectedRoutes><VerifyEmail /></ProtectedRoutes>}
      />

      {/* ── Admin-only routes — staff gets redirected to "/" ── */}
      <Route path="/accounting"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><Account /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/revenue"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><Revenue /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/rent-payment"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><RentPayment /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/rent-payment/payments/:id"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><Payments /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/cheque-drafts"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><Cheque_drafts /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/tenant/addTenants"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><AddTenants /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/tenant/editTenant/:id"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><EditTenant /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/tenant/send-message"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><BroadCast /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/submeter"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><Submeter /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/dashboard/transactions"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><Transaction /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/dashboard/units"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><Units /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/test"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><Test /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/checklists"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ALL_ROLES}><DailyChecks /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/loans"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ALL_ROLES}><Loans /></RoleRoute></ProtectedRoutes>}
      />
      <Route path="/admin-daily-checks"
        element={<ProtectedRoutes><RoleRoute allowedRoles={ADMIN_ROLES}><AdminDailyChecks /></RoleRoute></ProtectedRoutes>}
      />
    </Routes>
  );

  return (
    <>{hideSidebar ? routedContent : <AppLayout>{routedContent}</AppLayout>}</>
  );
}