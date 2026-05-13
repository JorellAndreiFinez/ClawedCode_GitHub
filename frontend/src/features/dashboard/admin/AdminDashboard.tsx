import { useAuth } from "@/features/auth";

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-gray-600 mt-2">Welcome back, {user?.email}</p>
    </div>
  );
}
