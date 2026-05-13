import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth";
import { logout } from "@/lib/auth";

const LOGO_SRC = "/linea/linea-logo.png";

const navItems = [
  { label: "Dashboard", path: "/admin" },
  { label: "Control", path: "/admin/queue" },
  { label: "Establishments", path: "/admin/establishment" },
];

function isActiveNav(pathname: string, label: string) {
  if (label === "Dashboard") return pathname === "/admin";
  if (label === "Control") return pathname.startsWith("/admin/queue");
  if (label === "Establishments")
    return pathname.startsWith("/admin/establishment");
  return false;
}

function getInitial(name?: string, email?: string) {
  if (name?.trim()) return name.trim()[0].toUpperCase();
  if (email?.trim()) return email.trim()[0].toUpperCase();
  return "U";
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  const [open, setOpen] = useState(false);

  const fullName = profile?.fullName;
  const email = user?.email || profile?.email;

  const handleLogout = async () => {
    setOpen(false);
    await logout().catch(() => {});
    navigate("/logout");
  };

  return (
    <div className="min-h-screen bg-white text-[#1b1c1c]">
      <header className="sticky top-0 z-30 border-b border-[#e3e2e2] bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <button
            onClick={() => navigate("/admin")}
            className="flex min-h-11 cursor-pointer items-center"
          >
            <img src={LOGO_SRC} alt="linea" className="h-10 w-auto" />
          </button>

          <nav className="hidden items-center gap-3 md:flex">
            {navItems.map((item) => {
              const active = isActiveNav(location.pathname, item.label);

              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className={`min-h-11 cursor-pointer rounded-full px-6 py-2 text-lg font-medium transition-colors ${
                    active
                      ? "bg-black text-white"
                      : "text-[#1b1c1c] hover:bg-[#f5f3f3]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* USER MENU */}
          <div className="relative flex items-center gap-3">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-3 rounded-full px-2 py-1 hover:bg-[#f5f3f3]"
            >
              <span className="hidden text-sm font-bold sm:inline">
                Hi, {fullName || "Admin"}!
              </span>

              <div className="flex size-11 items-center justify-center rounded-full bg-[#83f9be]/35 text-sm font-extrabold text-[#303031]">
                {getInitial(fullName, email)}
              </div>
            </button>

            {open && (
              <div className="absolute right-0 top-14 z-50 w-44 rounded-xl border border-[#e3e2e2] bg-white shadow-lg">
                <div className="border-b px-4 py-3 text-sm">
                  <p className="font-bold text-[#1b1c1c]">
                    {fullName || "Admin"}
                  </p>
                  <p className="truncate text-xs text-[#777]">{email}</p>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
