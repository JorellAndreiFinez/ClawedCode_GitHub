import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth";

export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* SIDEBAR */}
      <aside className="w-64 bg-black text-white p-4 space-y-4">
        <h1 className="text-lg font-bold">Admin Panel</h1>

        <button
          onClick={() => navigate("/admin")}
          className="w-full text-left px-2 py-2 hover:bg-white/10 rounded"
        >
          Dashboard
        </button>

        <button
          onClick={() => navigate("/admin/establishment")}
          className="w-full text-left px-2 py-2 hover:bg-white/10 rounded"
        >
          Establishment
        </button>

        <button
          onClick={() => navigate("/admin/queue")}
          className="w-full text-left px-2 py-2 hover:bg-white/10 rounded"
        >
          Live Queue
        </button>

        <div className="pt-6 text-xs text-white/60">{user?.email}</div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
