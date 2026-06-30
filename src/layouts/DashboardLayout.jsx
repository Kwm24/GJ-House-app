import { Outlet } from "react-router-dom";

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-brand-dark">
      <Outlet />
    </div>
  );
}
