import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth";

export function useRedirectAfterAuth() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    if (role === "admin") {
      navigate("/admin");
    } else {
      navigate("/dashboard");
    }
  }, [user, role, loading]);
}
