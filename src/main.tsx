import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "@/App.tsx";
import { AuthProvider } from "@/context/auth-context";
import { AuthModalProvider } from "@/context/auth-modal-context";
import { CatalogProvider } from "@/context/catalog-context";
import { I18nProvider } from "@/context/i18n-context";
import { ThemeProvider } from "@/context/theme-context";
import { getStoredLang } from "@/lib/prefs";
import "./styles.css";

document.documentElement.lang = getStoredLang();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <AuthModalProvider>
              <CatalogProvider>
                <App />
              </CatalogProvider>
            </AuthModalProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
