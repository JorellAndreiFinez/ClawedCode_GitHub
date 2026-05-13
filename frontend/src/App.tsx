import { Routes, Route } from "react-router-dom";

import { AuthPage } from "./features/auth";
import { UserDashboard } from "./features/dashboard";

import AdminLayout from "./features/dashboard/admin/AdminLayout";
import AdminDashboard from "./features/dashboard/admin/AdminDashboard";
import EstablishmentPage from "@/features/dashboard/admin/EstablishmentPage";
import AdminQueueControlPanel from "./features/dashboard/admin/AdminQueueControlPanel";

import SetupEstablishment from "./features/establishment/pages/SetupEstablishment";
import QueueDetail from "./features/queue/pages/QueueDetail";
import JoinQueue from "./features/queue/pages/JoinQueue";
import TicketPage from "./features/queue/pages/TicketPage";

import AuthGate from "./routes/AuthGate";
import LogoutPage from "./features/auth/pages/LogoutPage";

export default function App() {
  return (
    <AuthGate>
      <Routes>
        {/* PUBLIC */}
        <Route path="/" element={<AuthPage />} />

        {/* USER */}
        <Route path="/dashboard" element={<UserDashboard />} />

        <Route path="/queue/:id" element={<QueueDetail />} />
        <Route path="/queue/:id/join" element={<JoinQueue />} />
        <Route path="/ticket/:estId/:pushKey" element={<TicketPage />} />

        {/* ADMIN LAYOUT */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="establishment" element={<EstablishmentPage />} />
          <Route path="queue" element={<AdminQueueControlPanel />} />
        </Route>

        {/* OTHER PAGES */}
        <Route path="/establishment-setup" element={<SetupEstablishment />} />
        <Route path="/logout" element={<LogoutPage />} />
      </Routes>
    </AuthGate>
  );
}
