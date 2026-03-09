import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "./context/AuthContext.jsx";
import HashLoader from "react-spinners/HashLoader";
import { Suspense } from "react";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Toaster />
        <Suspense fallback={<HashLoader color="var(--color-accent)" />}>
          <App />
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
