import { Routes, Route } from "react-router-dom";

import { AuthPage } from "./features/auth";
import { UserDashboard } from "./features/dashboard";
import AdminLayout from "./features/dashboard/admin/AdminLayout";
import AdminDashboard from "./features/dashboard/admin/AdminDashboard";
import SetupEstablishment from "./features/establishment/pages/SetupEstablishment";
import EstablishmentPage from "@/features/dashboard/admin/EstablishmentPage";

import AuthGate from "./routes/AuthGate";
import LogoutPage from "./features/auth/pages/LogoutPage";
import AdminQueueControlPanel from "./features/dashboard/admin/AdminQueueControlPanel";

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<AuthPage />} />

        <Route path="/dashboard" element={<UserDashboard />} />

        {/* ADMIN LAYOUT */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="establishment" element={<EstablishmentPage />} />
          <Route path="queue" element={<AdminQueueControlPanel />} />
        </Route>

        <Route path="/establishment-setup" element={<SetupEstablishment />} />
        <Route path="/logout" element={<LogoutPage />} />
      </Routes>
    </AuthGate>
  );
}
