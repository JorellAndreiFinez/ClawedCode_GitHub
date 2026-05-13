import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const publicRoutes = ["/", "/logout"];

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (!publicRoutes.includes(location.pathname)) {
        navigate("/", { replace: true });
      }
      return;
    }

    if (!profile) return;

    // ADMIN FLOW
    if (profile?.role === "admin") {
      if (profile.establishment_completed === false) {
        if (location.pathname !== "/establishment-setup") {
          navigate("/establishment-setup", { replace: true });
        }
      } else {
        if (
          location.pathname === "/" ||
          location.pathname === "/establishment-setup"
        ) {
          navigate("/admin", { replace: true });
        }
      }
      return;
    }

    // USER FLOW
    if (profile?.role === "user") {
      if (location.pathname !== "/dashboard") {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, profile, loading, location.pathname]);

  return <>{children}</>;
}
