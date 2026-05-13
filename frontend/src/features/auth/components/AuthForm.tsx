import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { toast } from "sonner";

type Role = "user" | "admin";

type Props = {
  onLogin: (email: string, password: string) => void;
  onRegister: (
    fullName: string,
    email: string,
    password: string,
    role: Role,
  ) => Promise<any>;
};

export default function AuthForm({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");

  // NEW STATES
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const isLogin = mode === "login";

  const handleRegister = async () => {
    try {
      setLoading(true);
      setError("");

      await onRegister(fullName, email, password, role);

      toast.success("Account created successfully 🎉");

      setFullName("");
      setEmail("");
      setPassword("");
      setRole("user");

      setTimeout(() => {
        setMode("login");
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Registration failed");
      toast.error("Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      const result = await onLogin(email, password);

      toast.success(`Welcome ${result.profile.fullName || "back"} 👋`);
    } catch (err: any) {
      setError(err.message || "Invalid login credentials");
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gray-50">
      {/* LEFT SIDE */}
      <div className="hidden lg:flex flex-col justify-center px-16 bg-black text-white">
        <h1 className="text-5xl font-bold">LINEA</h1>
        <p className="mt-4 text-white/70 max-w-md">
          Smart queue system for modern businesses.
        </p>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{isLogin ? "Welcome back" : "Create account"}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* TOGGLE */}
            <div className="grid grid-cols-2 bg-muted p-1 rounded-lg">
              <button
                onClick={() => setMode("login")}
                className={`py-2 rounded-md text-sm ${
                  isLogin ? "bg-white shadow" : "text-muted-foreground"
                }`}
              >
                Login
              </button>

              <button
                onClick={() => setMode("signup")}
                className={`py-2 rounded-md text-sm ${
                  !isLogin ? "bg-white shadow" : "text-muted-foreground"
                }`}
              >
                Sign up
              </button>
            </div>

            {/* SUCCESS / ERROR */}
            {success && (
              <div className="text-green-600 text-sm font-medium">
                {success}
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm font-medium">{error}</div>
            )}

            {/* FORM */}
            <div className="space-y-3">
              {!isLogin && (
                <Input
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              )}

              <Input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Account type
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole("user")}
                      className={`p-2 rounded-lg border text-sm ${
                        role === "user" ? "bg-black text-white" : "bg-white"
                      }`}
                    >
                      User
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("admin")}
                      className={`p-2 rounded-lg border text-sm ${
                        role === "admin" ? "bg-black text-white" : "bg-white"
                      }`}
                    >
                      Admin
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ACTION BUTTON */}
            <Button
              className="w-full"
              disabled={loading}
              onClick={isLogin ? handleLogin : handleRegister}
            >
              {loading
                ? "Processing..."
                : isLogin
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
