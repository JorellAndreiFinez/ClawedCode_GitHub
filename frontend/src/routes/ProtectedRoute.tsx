import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth";

type Props = {
  children: React.ReactNode;
  allowedRole?: "user" | "admin";
};

export default function ProtectedRoute({ children, allowedRole }: Props) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}
