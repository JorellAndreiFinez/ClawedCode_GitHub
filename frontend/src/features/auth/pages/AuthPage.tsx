import AuthForm from "../components/AuthForm";
import { login, register } from "@/lib/auth";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AuthPage() {
  return (
    <AuthForm
      onLogin={async (email, password) => {
        try {
          const result = await login(email, password);

          await result.user.getIdToken(true);

          return result;
        } catch (error) {
          throw new Error(getErrorMessage(error, "Login failed"), {
            cause: error,
          });
        }
      }}
      onRegister={async (fullName, email, password, role) => {
        try {
          return await register(fullName, email, password, role);
        } catch (error) {
          const message = getErrorMessage(error, "Registration failed");

          if (message.includes("auth/email-already-in-use")) {
            throw new Error("Email already exists. Please login instead.", {
              cause: error,
            });
          }

          throw new Error(message || "Registration failed", { cause: error });
        }
      }}
    />
  );
}
