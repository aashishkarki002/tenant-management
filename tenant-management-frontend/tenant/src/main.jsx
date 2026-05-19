import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "../utils/i18n.js";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "./context/AuthContext.jsx";
import { EntityProvider } from "./context/EntityContext.jsx";
import HashLoader from "react-spinners/HashLoader";
import { Suspense } from "react";
import { LanguageProvider } from "./context/LanguageContext.jsx";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <EntityProvider>
          <LanguageProvider>
            <Toaster />
            <Suspense fallback={<HashLoader color="#1a5276" />}>
              <App />
            </Suspense>
          </LanguageProvider>
        </EntityProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
