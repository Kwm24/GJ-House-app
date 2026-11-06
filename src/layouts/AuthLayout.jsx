import { Outlet } from "react-router-dom";
import { LoginBackdrop } from "../components/LoginBackdrop.jsx";

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4 relative">
      <LoginBackdrop />
      <div className="relative w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
