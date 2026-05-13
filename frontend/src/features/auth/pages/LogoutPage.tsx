import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "@/lib/auth";

export default function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      try {
        await logout();
      } catch (e) {
        console.log("logout error ignored", e);
      }

      navigate("/", { replace: true });
    };

    run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      Logging out...
    </div>
  );
}
