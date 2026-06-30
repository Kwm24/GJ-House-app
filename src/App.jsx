import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { AuthLayout } from "./layouts/AuthLayout.jsx";
import { DashboardLayout } from "./layouts/DashboardLayout.jsx";
import { Login } from "./pages/Login.jsx";
import { RootRedirect } from "./pages/RootRedirect.jsx";
import { CS } from "./pages/CS.jsx";
import { ProductionPage } from "./pages/ProductionPage.jsx";
import { DesignerPage } from "./pages/DesignerPage.jsx";
import { AccountsPage } from "./pages/AccountsPage.jsx";
import { CustomerPage } from "./pages/CustomerPage.jsx";
import { AdminPage } from "./pages/AdminPage.jsx";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route
                path="/cs"
                element={
                  <ProtectedRoute allowedRoles={["cs"]}>
                    <CS />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/production"
                element={
                  <ProtectedRoute allowedRoles={["production"]}>
                    <ProductionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/designer"
                element={
                  <ProtectedRoute allowedRoles={["designer"]}>
                    <DesignerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts"
                element={
                  <ProtectedRoute allowedRoles={["accounts"]}>
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
  );
}
