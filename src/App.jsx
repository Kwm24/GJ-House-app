import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { AuthProvider } from "./components/AuthProvider.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { AccentColorInjector } from "./components/AccentColorInjector.jsx";
import { AuthLayout } from "./layouts/AuthLayout.jsx";
import { DashboardLayout } from "./layouts/DashboardLayout.jsx";
import { Login } from "./pages/Login.jsx";
import { CustomerSignup } from "./pages/CustomerSignup.jsx";
import { RootRedirect } from "./pages/RootRedirect.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { CS } from "./pages/CS.jsx";
import { CSLogin } from "./pages/CSLogin.jsx";
import { CSSignup } from "./pages/CSSignup.jsx";
import { ProductionPage } from "./pages/ProductionPage.jsx";
import { ProductionLogin } from "./pages/ProductionLogin.jsx";
import { ProductionSignup } from "./pages/ProductionSignup.jsx";
import { DesignerPage } from "./pages/DesignerPage.jsx";
import { DesignerLogin } from "./pages/DesignerLogin.jsx";
import { DesignerSignup } from "./pages/DesignerSignup.jsx";
import { AccountsPage } from "./pages/AccountsPage.jsx";
import { AccountsLogin } from "./pages/AccountsLogin.jsx";
import { CustomerPage } from "./pages/CustomerPage.jsx";
import { AdminPage } from "./pages/AdminPage.jsx";

export function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <AccentColorInjector />
        <Routes>
          <Route path="/"    element={<LandingPage />} />
          <Route path="/app" element={<RootRedirect />} />

          <Route element={<AuthLayout />}>
            <Route path="/login"  element={<Login />} />
            <Route path="/signup" element={<CustomerSignup />} />
          </Route>

          {/* ── Lobby-specific login + signup pages (no auth required, full-page dark UI) ── */}
          <Route path="/cs/login"            element={<CSLogin />} />
          <Route path="/cs/signup"           element={<CSSignup />} />
          <Route path="/designer/login"      element={<DesignerLogin />} />
          <Route path="/designer/signup"     element={<DesignerSignup />} />
          <Route path="/production/login"    element={<ProductionLogin />} />
          <Route path="/production/signup"   element={<ProductionSignup />} />
          <Route path="/accounts/login"      element={<AccountsLogin />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route
                path="/cs"
                element={
                  <ProtectedRoute allowedRoles={["cs"]} loginPath="/cs/login">
                    <CS />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/production"
                element={
                  <ProtectedRoute allowedRoles={["production"]} loginPath="/production/login">
                    <ProductionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/designer"
                element={
                  <ProtectedRoute allowedRoles={["designer"]} loginPath="/designer/login">
                    <DesignerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts"
                element={
                  <ProtectedRoute allowedRoles={["accounts"]} loginPath="/accounts/login">
                    <AccountsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer"
                element={
                  <ProtectedRoute allowedRoles={["customer"]}>
                    <CustomerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
