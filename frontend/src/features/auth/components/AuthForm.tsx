import { type FormEvent, useState } from "react";
import { Eye, EyeOff, Lock, Mail, QrCode, User, Users } from "lucide-react";

import { cn } from "@/lib/utils";

type Role = "user" | "admin";
type SignupStep = "identity" | "password" | "role";

type LoginResult = {
  profile?: {
    fullName?: string;
  };
};

type Props = {
  onLogin: (email: string, password: string) => Promise<LoginResult>;
  onRegister: (
    fullName: string,
    email: string,
    password: string,
    role: Role,
  ) => Promise<unknown>;
};

const inputBase =
  "h-[52px] w-full rounded-[8px] border border-[#7f7a76] bg-white px-14 text-[15px] font-medium text-[#1c1c1c] outline-none transition focus:border-[#36b37e] focus:ring-3 focus:ring-[#36b37e]/15";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const trustedEmailProviders = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
]);
const temporaryEmailDomains = new Set([
  "10minutemail.com",
  "dispostable.com",
  "fakeinbox.com",
  "getnada.com",
  "guerrillamail.com",
  "mailinator.com",
  "sharklasers.com",
  "temp-mail.org",
  "tempmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
]);

function getEmailDomain(value: string) {
  return value.trim().toLowerCase().split("@")[1] || "";
}

function isTemporaryEmailDomain(domain: string) {
  return temporaryEmailDomains.has(domain);
}

function isTrustedEmailDomain(domain: string) {
  if (!domain || isTemporaryEmailDomain(domain)) return false;
  if (trustedEmailProviders.has(domain)) return true;

  const parts = domain.split(".");
  const topLevelDomain = parts.at(-1) || "";
  const domainName = parts.at(-2) || "";

  return Boolean(
    parts.length >= 2 &&
      /^[a-z]{2,}$/.test(topLevelDomain) &&
      /^[a-z0-9-]{2,}$/.test(domainName),
  );
}

function validateEmail(value: string, options?: { trustedOnly?: boolean }) {
  const normalized = value.trim().toLowerCase();
  const domain = getEmailDomain(normalized);

  if (!normalized) return "Email address is required.";
  if (/\s/.test(normalized)) return "Email cannot contain spaces.";
  if (!emailPattern.test(normalized)) return "Enter a valid email address.";
  if (options?.trustedOnly && isTemporaryEmailDomain(domain)) {
    return "Temporary email addresses are not allowed.";
  }
  if (options?.trustedOnly && !isTrustedEmailDomain(domain)) {
    return "Use a trusted email provider or company email.";
  }

  return "";
}

function getSignupEmailRules(value: string) {
  const normalized = value.trim().toLowerCase();
  const domain = getEmailDomain(normalized);

  return [
    { label: "Valid email format", met: emailPattern.test(normalized) },
    {
      label: "Trusted provider or company domain",
      met: isTrustedEmailDomain(domain),
    },
    {
      label: "No temporary email",
      met: Boolean(domain) && !isTemporaryEmailDomain(domain),
    },
  ];
}

function getPasswordRules(value: string) {
  return [
    { label: "At least 8 characters", met: value.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(value) },
    { label: "One lowercase letter", met: /[a-z]/.test(value) },
    { label: "One number", met: /\d/.test(value) },
    { label: "No spaces", met: value.length > 0 && !/\s/.test(value) },
  ];
}

function formatAccountName(value: string) {
  const localPart = value.split("@")[0] || "";
  const name = localPart.replace(/[._-]+/g, " ").trim();

  if (!name) return "Account";

  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AuthForm({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginStep, setLoginStep] = useState<"email" | "password">("email");
  const [signupStep, setSignupStep] = useState<SignupStep>("identity");
  const [loginEmail, setLoginEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const isLogin = mode === "login";
  const normalizedEmail = email.trim().toLowerCase();
  const loginEmailError = isLogin ? validateEmail(email) : "";
  const signupEmailError = !isLogin ? validateEmail(email, { trustedOnly: true }) : "";
  const signupEmailRules = getSignupEmailRules(email);
  const passwordRules = getPasswordRules(password);
  const passwordError =
    !isLogin && password && passwordRules.some((rule) => !rule.met)
      ? "Password does not meet requirements."
      : "";
  const accountEmail = loginEmail || normalizedEmail;
  const accountName = formatAccountName(accountEmail);
  const signupIdentityReady = Boolean(
    fullName.trim() &&
      normalizedEmail &&
      !signupEmailError &&
      signupEmailRules.every((rule) => rule.met),
  );
  const signupPasswordReady = Boolean(
    password &&
      confirmPassword &&
      password === confirmPassword &&
      passwordRules.every((rule) => rule.met),
  );
  const canSubmit = isLogin
    ? loginStep === "email"
      ? Boolean(normalizedEmail)
      : Boolean(accountEmail && password)
    : signupStep === "identity"
      ? signupIdentityReady
      : signupStep === "password"
        ? signupPasswordReady
        : Boolean(role);

  const switchMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setLoginStep("email");
    setSignupStep("identity");
    setLoginEmail("");
    setPassword("");
    setConfirmPassword("");
    setMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (isLogin && loginStep === "email") {
      if (loginEmailError) {
        setMessage({ tone: "error", text: loginEmailError });
        return;
      }

      setLoginEmail(normalizedEmail);
      setLoginStep("password");
      setPassword("");
      return;
    }

    if (!isLogin) {
      if (signupStep === "identity") {
        if (!fullName.trim()) {
          setMessage({ tone: "error", text: "Full name is required." });
          return;
        }

        if (signupEmailError) {
          setMessage({ tone: "error", text: signupEmailError });
          return;
        }

        setSignupStep("password");
        return;
      }

      if (signupStep === "password") {
        if (passwordError) {
          setMessage({ tone: "error", text: passwordError });
          return;
        }

        if (password !== confirmPassword) {
          setMessage({ tone: "error", text: "Passwords do not match." });
          return;
        }

        setSignupStep("role");
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const result = await onLogin(accountEmail, password);
        setMessage({
          tone: "success",
          text: `Welcome ${result.profile?.fullName || "back"}.`,
        });
        return;
      }

      await onRegister(fullName.trim(), normalizedEmail, password, role);
      setMessage({
        tone: "success",
        text: "Account created. You can sign in now.",
      });
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("user");
      setMode("login");
      setLoginStep("password");
      setSignupStep("identity");
      setLoginEmail(normalizedEmail);
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[#f8fbf9] lg:grid-cols-[minmax(420px,0.82fr)_minmax(560px,1fr)]">
      <section className="relative hidden overflow-hidden bg-[#030503] px-12 py-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_85%,rgba(20,154,101,0.28),transparent_28%),radial-gradient(circle_at_96%_100%,rgba(255,98,61,0.18),transparent_30%)]" />
        <div className="relative z-10 flex h-full max-w-xl flex-col">
          <img
            src="/linea/auth-logo.png"
            alt="linea"
            className="h-14 w-fit rounded-[2px] bg-black object-contain px-3 py-2"
          />

          <div className="mt-20 pl-10">
            <h1 className="max-w-[430px] text-[56px] font-extrabold leading-[0.95] tracking-normal text-white">
              The <span className="text-[#36b37e]">queue</span> that{" "}
              <span className="text-[#ff6b43]">waits</span> for you
            </h1>
            <div className="mt-12 h-3 w-40 bg-[#36b37e]" />
            <p className="mt-10 max-w-[390px] text-2xl font-semibold leading-[1.08] text-white/75">
              Join remotely. Track live. Get called when it's your turn. No
              more standing around.
            </p>
          </div>

          <img
            src="/linea/login-hero.png"
            alt=""
            className="ml-1 mt-12 w-[540px] max-w-full object-contain"
          />

          <div className="mt-auto flex items-center gap-6 pl-10 pb-8">
            <div className="flex size-22 items-center justify-center rounded-full bg-[#145b3e] text-[#36b37e]">
              <QrCode className="size-9" strokeWidth={2.5} />
            </div>
            <p className="max-w-[300px] text-[25px] font-semibold leading-[1.08] text-white/80">
              Join queues instantly using{" "}
              <span className="text-[#36b37e]">QR Codes</span>
            </p>
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(46,179,126,0.24),transparent_36%),radial-gradient(circle_at_35%_100%,rgba(255,107,67,0.13),transparent_30%)]" />

        <form
          onSubmit={handleSubmit}
          className="relative z-10 w-full max-w-[536px] rounded-[18px] border border-[#c4beb8] bg-white/96 px-10 py-10 shadow-[0_30px_80px_rgba(23,49,36,0.12)] sm:px-14 sm:py-14"
        >
          <img
            src="/linea/auth-logo.png"
            alt="linea"
            className="mx-auto mb-8 h-12 w-fit rounded-[2px] bg-black object-contain px-3 py-2 lg:hidden"
          />
          <div className="text-center">
            <h2 className="text-[38px] font-extrabold leading-none tracking-normal text-black">
              {isLogin && loginStep === "password"
                ? `Welcome, ${accountName}`
                : isLogin
                  ? "Welcome back!"
                  : signupStep === "password"
                    ? "Secure your account"
                    : signupStep === "role"
                      ? "Choose account type"
                      : "Create an account"}
            </h2>
            <p className="mt-4 text-[15px] font-semibold text-[#8b8582]">
              Let's get {isLogin ? "you back in" : "in"} the queue!
            </p>
          </div>

          <div className="mt-9 grid h-[60px] grid-cols-2 overflow-hidden rounded-[8px] border border-[#36b37e] bg-[#f4f4f4]">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={cn(
                "text-lg font-extrabold transition",
                isLogin ? "bg-[#eaf8f2] text-[#2fad78]" : "text-[#211c1a]",
              )}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={cn(
                "border-l border-[#7f7a76]/45 text-lg font-extrabold transition",
                !isLogin ? "bg-[#eaf8f2] text-[#2fad78]" : "text-[#211c1a]",
              )}
            >
              Sign up
            </button>
          </div>

          {message ? (
            <div
              className={cn(
                "mt-6 rounded-[8px] border px-4 py-3 text-sm font-bold",
                message.tone === "success"
                  ? "border-[#36b37e]/35 bg-[#eaf8f2] text-[#19714e]"
                  : "border-[#ff6b43]/35 bg-[#fff0eb] text-[#bd3c18]",
              )}
            >
              {message.text}
            </div>
          ) : null}

          {!isLogin ? (
            <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs font-extrabold uppercase tracking-normal">
              {[
                ["identity", "Details"],
                ["password", "Password"],
                ["role", "Role"],
              ].map(([step, label]) => (
                <span
                  key={step}
                  className={cn(
                    "rounded-full border px-2 py-2",
                    signupStep === step
                      ? "border-[#36b37e] bg-[#eaf8f2] text-[#19714e]"
                      : "border-[#d8d2cc] bg-[#f7f6f5] text-[#8b8582]",
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-8 space-y-6">
            {!isLogin && signupStep === "identity" ? (
              <label className="block">
                <span className="mb-3 block text-[16px] font-extrabold text-[#8b8582]">
                  Full Name
                </span>
                <span className="relative block">
                  <User className="absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[#36b37e]" />
                  <input
                    className={inputBase}
                    placeholder="e.g. Juan Dela Cruz"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    autoComplete="name"
                    required={!isLogin}
                  />
                </span>
              </label>
            ) : null}

            {isLogin && loginStep === "password" ? (
              <div className="flex items-center justify-between gap-4 rounded-[14px] border border-[#36b37e]/35 bg-[#eaf8f2] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#36b37e] text-lg font-extrabold text-white">
                    {accountName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-extrabold text-black">
                      {accountName}
                    </p>
                    <p className="truncate text-sm font-bold text-[#6f6a66]">
                      {accountEmail}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLoginStep("email");
                    setLoginEmail("");
                    setPassword("");
                    setMessage(null);
                  }}
                  className="shrink-0 text-sm font-extrabold text-[#2fad78]"
                >
                  Change
                </button>
              </div>
            ) : isLogin || signupStep === "identity" ? (
              <label className="block">
                <span className="mb-3 block text-[16px] font-extrabold text-[#8b8582]">
                  Email Address
                </span>
                <span className="relative block">
                  <Mail className="absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[#36b37e]" />
                  <input
                    className={inputBase}
                    type="email"
                    placeholder="test@gmail.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value.trimStart())}
                    onBlur={() => setEmail(normalizedEmail)}
                    autoComplete="email"
                    required
                    aria-invalid={!isLogin && Boolean(signupEmailError)}
                  />
                </span>
                {!isLogin && email ? (
                  <div className="mt-3 grid gap-2 text-sm font-bold sm:grid-cols-2">
                    {signupEmailRules.map((rule) => (
                      <span
                        key={rule.label}
                        className={cn(
                          "rounded-[8px] border px-3 py-2",
                          rule.met
                            ? "border-[#36b37e]/30 bg-[#eaf8f2] text-[#19714e]"
                            : "border-[#c4beb8] bg-[#f7f6f5] text-[#8b8582]",
                        )}
                      >
                        {rule.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </label>
            ) : null}

            {(isLogin && loginStep === "password") ||
            (!isLogin && signupStep === "password") ? (
              <label className="block">
                <span className="mb-3 block text-[16px] font-extrabold text-[#8b8582]">
                  Password
                </span>
                <span className="relative block">
                  <Lock className="absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[#36b37e]" />
                  <input
                    className={cn(inputBase, "pr-14")}
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                    aria-invalid={!isLogin && Boolean(passwordError)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-[#36b37e]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-5" />
                    ) : (
                      <Eye className="size-5" />
                    )}
                  </button>
                </span>
                {!isLogin && password ? (
                  <div className="mt-3 grid gap-2 text-sm font-bold sm:grid-cols-2">
                    {passwordRules.map((rule) => (
                      <span
                        key={rule.label}
                        className={cn(
                          "rounded-[8px] border px-3 py-2",
                          rule.met
                            ? "border-[#36b37e]/30 bg-[#eaf8f2] text-[#19714e]"
                            : "border-[#c4beb8] bg-[#f7f6f5] text-[#8b8582]",
                        )}
                      >
                        {rule.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </label>
            ) : null}

            {!isLogin && signupStep === "password" ? (
              <label className="block">
                <span className="mb-3 block text-[16px] font-extrabold text-[#8b8582]">
                  Confirm Password
                </span>
                <span className="relative block">
                  <Lock className="absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[#36b37e]" />
                  <input
                    className={cn(inputBase, "pr-14")}
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    aria-invalid={Boolean(
                      confirmPassword && password !== confirmPassword,
                    )}
                  />
                </span>
                {confirmPassword ? (
                  <span
                    className={cn(
                      "mt-2 block text-sm font-bold",
                      password === confirmPassword
                        ? "text-[#19714e]"
                        : "text-[#bd3c18]",
                    )}
                  >
                    {password === confirmPassword
                      ? "Passwords match."
                      : "Passwords do not match."}
                  </span>
                ) : null}
              </label>
            ) : null}

            {isLogin && loginStep === "password" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-[15px] font-semibold">
                <label className="flex items-center gap-3 text-[#8b8582]">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(event) => setRememberDevice(event.target.checked)}
                    className="size-5 accent-[#36b37e]"
                  />
                  Remember this device
                </label>
                <button type="button" className="font-bold text-[#2fad78]">
                  Forgot Password?
                </button>
              </div>
            ) : !isLogin && signupStep === "role" ? (
              <div>
                <div className="mb-6 rounded-[14px] border border-[#36b37e]/35 bg-[#eaf8f2] px-4 py-3">
                  <p className="truncate text-[16px] font-extrabold text-black">
                    {fullName.trim()}
                  </p>
                  <p className="truncate text-sm font-bold text-[#6f6a66]">
                    {normalizedEmail}
                  </p>
                </div>
                <span className="mb-4 block text-[16px] font-extrabold text-[#8b8582]">
                  I am a
                </span>
                <div className="grid grid-cols-2 gap-6">
                  <button
                    type="button"
                    onClick={() => setRole("user")}
                    className={cn(
                      "flex h-[52px] items-center justify-center gap-2 rounded-[8px] border border-[#7f7a76] text-[15px] font-extrabold transition",
                      role === "user"
                        ? "border-[#120602] bg-[#120602] text-white"
                        : "bg-white text-[#120602]",
                    )}
                  >
                    <User className="size-4" />
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("admin")}
                    className={cn(
                      "flex h-[52px] items-center justify-center gap-2 rounded-[8px] border border-[#7f7a76] text-[15px] font-extrabold transition",
                      role === "admin"
                        ? "border-[#120602] bg-[#120602] text-white"
                        : "bg-white text-[#120602]",
                    )}
                  >
                    <Users className="size-4" />
                    Business Owner
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {!isLogin && signupStep !== "identity" ? (
            <button
              type="button"
              onClick={() => {
                setSignupStep(
                  signupStep === "role" ? "password" : "identity",
                );
                setMessage(null);
              }}
              className="mt-6 w-full text-sm font-extrabold text-[#2fad78]"
            >
              Back
            </button>
          ) : null}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="mt-8 h-[50px] w-full rounded-[8px] bg-[#41b27f] text-[15px] font-extrabold uppercase text-white transition hover:bg-[#309f6d] disabled:cursor-not-allowed disabled:bg-[#9bd6bb]"
          >
            {loading
              ? "Processing..."
              : isLogin
                ? loginStep === "email"
                  ? "Continue"
                  : "Sign in"
                : signupStep === "role"
                  ? "Create account"
                  : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
