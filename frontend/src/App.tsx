import { Routes, Route } from "react-router-dom";

import { AuthPage } from "./features/auth";
import { AdminDashboard, UserDashboard } from "./features/dashboard";
import ProtectedRoute from "./routes/ProtectedRoute";
import SetupEstablishment from "./features/establishment/pages/SetupEstablishment";
import QueueDetail from "./features/queue/pages/QueueDetail";
import JoinQueue from "./features/queue/pages/JoinQueue";
import TicketPage from "./features/queue/pages/TicketPage";

export default function App() {
  return (
    <Routes>
      {/* AUTH */}
      <Route path="/" element={<AuthPage />} />

      {/* USER */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRole="user">
            <UserDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/queue/:id"
        element={
          <ProtectedRoute allowedRole="user">
            <QueueDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/queue/:id/join"
        element={
          <ProtectedRoute allowedRole="user">
            <JoinQueue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ticket/:estId/:pushKey"
        element={
          <ProtectedRoute allowedRole="user">
            <TicketPage />
          </ProtectedRoute>
        }
      />

      {/* ADMIN */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/establishment-setup"
        element={
          <ProtectedRoute allowedRole="admin">
            <SetupEstablishment />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
