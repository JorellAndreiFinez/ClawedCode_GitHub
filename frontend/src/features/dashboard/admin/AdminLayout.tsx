import { Outlet, useLocation, useNavigate } from "react-router-dom";

const LOGO_SRC = "/linea/linea-logo.png";

const navItems = [
  { label: "Dashboard", path: "/admin" },
  { label: "Control", path: "/admin/queue" },
  { label: "Analytics", path: "/admin" },
  { label: "Settings", path: "/admin/establishment" },
];

function isActiveNav(pathname: string, label: string) {
  if (label === "Dashboard") return pathname === "/admin";
  if (label === "Control") return pathname.startsWith("/admin/queue");
  if (label === "Settings") return pathname.startsWith("/admin/establishment");
  return false;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-white text-[#1b1c1c]">
      <header className="sticky top-0 z-30 border-b border-[#e3e2e2] bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <button
            onClick={() => navigate("/admin")}
            className="flex min-h-11 cursor-pointer items-center"
            aria-label="Go to admin dashboard"
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

          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-bold sm:inline">
              Hi, Admin!
            </span>
            <div className="flex size-11 items-center justify-center rounded-full bg-[#83f9be]/35 text-sm font-extrabold text-[#303031]">
              A
            </div>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
