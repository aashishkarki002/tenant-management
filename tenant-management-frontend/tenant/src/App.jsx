import { Routes, Route } from 'react-router-dom';
import Signup from './Signup';
import Login from './Login';
import { Toaster } from "@/components/ui/sonner";
import Home from './Home';
import AppLayout from './components/layout/Applayout';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
      </Routes>
      <Toaster />
    </AppLayout>
  );
}
