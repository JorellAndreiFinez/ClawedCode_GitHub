import { Routes, Route } from "react-router-dom";

import { AuthPage } from "./features/auth";

import { AdminDashboard, UserDashboard } from "./features/dashboard";

import ProtectedRoute from "./routes/ProtectedRoute";

import SetupEstablishment from "./features/establishment/pages/SetupEstablishment";

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
