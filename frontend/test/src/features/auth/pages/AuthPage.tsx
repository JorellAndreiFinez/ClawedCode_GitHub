import AuthForm from "../components/AuthForm";
import { login, register } from "@/lib/auth";

import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <AuthForm
        onLogin={async (email, password) => {
          try {
            const result = await login(email, password);

            await result.user.getIdToken(true);

            if (result.profile.role === "admin") {
              if (result.profile.establishment_completed === false) {
                navigate("/establishment-setup");
              } else {
                navigate("/admin");
              }
            } else {
              navigate("/dashboard");
            }

            return result;
          } catch (e: any) {
            throw new Error(e.message || "Login failed");
          }
        }}
        onRegister={async (fullName, email, password, role) => {
          try {
            const result = await register(fullName, email, password, role);

            console.log("REGISTER SUCCESS:", result);

            return result;
          } catch (e: any) {
            if (e.message.includes("auth/email-already-in-use")) {
              throw new Error("Email already exists. Please login instead.");
            }

            throw new Error("Registration failed");
          }
        }}
      />
    </div>
  );
}
