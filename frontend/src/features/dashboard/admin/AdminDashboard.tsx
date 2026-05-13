import { useNavigate } from "react-router-dom";
import { logout } from "@/lib/auth";
import { useAuth } from "@/features/auth";

export default function AdminDashboard() {
  const { user } = useAuth();

  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();

      navigate("/");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <p className="mt-2 text-gray-600">Welcome Admin: {user?.email}</p>

      <button
        onClick={handleLogout}
        className="mt-4 px-4 py-2 bg-black text-white rounded-lg"
      >
        Logout
      </button>
    </div>
  );
}
