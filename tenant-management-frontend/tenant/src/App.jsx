import { Routes, Route, useLocation } from 'react-router-dom';
import Signup from './Signup';
import Login from './Login';
import { Toaster } from "@/components/ui/sonner";
import Home from './Home';
import AppLayout from './components/layout/Applayout';
import Tenants from './tenants';
import Dashboard from './Dashboard';
import Rent_Payment from './Rent_Payment';
import Accounting from './Accounting';
import Revenue from './Revenue';
import Maintenance from './Maintenance';
import Cheque_drafts from './Cheque_drafts';
import AddTenants from './addTenants';
import Demo from './demo';
export default function App() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const hideSidebar = path.startsWith('/login') || path.startsWith('/signup');

  const routedContent = (
    <Routes>
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/tenants" element={<Tenants />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/rent-payment" element={<Rent_Payment />} />
      <Route path="/accounting" element={<Accounting />} />
      <Route path="/revenue" element={<Revenue />} />
      <Route path="/maintenance" element={<Maintenance />} />
      <Route path="/cheque-drafts" element={<Cheque_drafts />} />
      <Route path="/addTenants" element={<AddTenants />} />
      <Route path="/demo" element={<Demo />} />
    </Routes>
  );

  return (
    <>
      {hideSidebar ? routedContent : <AppLayout>{routedContent}</AppLayout>}
      <Toaster />
    </>
  );
}
