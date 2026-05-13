import { Routes, Route } from "react-router-dom";

import { AuthPage } from "./features/auth";
import { AdminDashboard, UserDashboard } from "./features/dashboard";
import SetupEstablishment from "./features/establishment/pages/SetupEstablishment";

import AuthGate from "./routes/AuthGate";
import LogoutPage from "./features/auth/pages/LogoutPage";

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/establishment-setup" element={<SetupEstablishment />} />
        <Route path="/logout" element={<LogoutPage />} />
      </Routes>
    </AuthGate>
  );
}
