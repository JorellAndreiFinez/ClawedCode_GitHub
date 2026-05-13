import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth";

const publicRoutes = ["/", "/logout"];
const userRoutePrefixes = ["/dashboard", "/discover", "/queue/", "/ticket/"];

function isUserRoute(pathname: string) {
  return userRoutePrefixes.some((route) => pathname.startsWith(route));
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      if (!isUserRoute(location.pathname)) {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, profile, loading, location.pathname, navigate]);

  return <>{children}</>;
}
