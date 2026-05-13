import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import { logout } from "@/lib/auth";
import { useAuth } from "@/features/auth";
import { getCrowdInsight } from "@/lib/crowdInsight";
import WeatherBanner from "@/components/WeatherBanner";

type Establishment = {
  id: string;
  name: string;
  location: string;
  queue_capacity: number;
  service_time: number;
  status: "active" | "paused" | "closed";
};

type QueueEntry = {
  status: "waiting" | "called" | "serving" | "skipped" | "done";
};

function getCrowdLevel(score: number) {
  if (score >= 0.7) {
    return {
      label: "High",
      color: "text-red-600 bg-red-50 border-red-200",
      text: "text-red-600",
    };
  }

  if (score >= 0.3) {
    return {
      label: "Moderate",
      color: "text-yellow-600 bg-yellow-50 border-yellow-200",
      text: "text-yellow-600",
    };
  }

  return {
    label: "Low",
    color: "text-green-600 bg-green-50 border-green-200",
    text: "text-green-600",
  };
}

function getStatusBadge(status: string) {
  if (status === "paused") {
    return { label: "Paused", color: "bg-yellow-100 text-yellow-700" };
  }
  if (status === "closed") {
    return { label: "Closed", color: "bg-red-100 text-red-700" };
  }
  return { label: "Open", color: "bg-green-100 text-green-700" };
}

export default function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = onValue(ref(db, "establishments"), (snapshot) => {
      if (!snapshot.exists()) return;
      const list = Object.values(snapshot.val()) as Establishment[];
      setEstablishments(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (establishments.length === 0) return;

    const unsubs = establishments.map((est) =>
      onValue(ref(db, `queues/${est.id}/users`), (snapshot) => {
        let active = 0;
        if (snapshot.exists()) {
          const users = Object.values(snapshot.val()) as QueueEntry[];
          active = users.filter(
            (u) =>
              u.status === "waiting" ||
              u.status === "called" ||
              u.status === "serving"
          ).length;
        }
        setQueueCounts((prev) => ({ ...prev, [est.id]: active }));
      })
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [establishments]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">LINEA</h1>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm px-3 py-1.5 border rounded-lg hover:bg-gray-50"
        >
          Logout
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <WeatherBanner />
        <h2 className="text-lg font-semibold mb-4">Available Queues</h2>

        {establishments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">No queues</p>
            <p className="font-medium">No queues available right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            {establishments.map((est) => {
              const queueLength = queueCounts[est.id] ?? 0;
              const score = Math.min(queueLength / est.queue_capacity, 1);
              const crowd = getCrowdLevel(score);
              const statusBadge = getStatusBadge(est.status);
              const eta = queueLength * (est.service_time || 3);
              const insight = getCrowdInsight({
                currentCount: queueLength,
                serviceTime: est.service_time,
                capacity: est.queue_capacity,
              });
              const isDisabled = est.status !== "active";

              return (
                <div
                  key={est.id}
                  className="bg-white border rounded-xl p-4 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-base">{est.name}</h3>
                      <p className="text-sm text-gray-500">{est.location}</p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadge.color}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="flex gap-4 text-sm text-gray-600 mb-3">
                    <span>{queueLength} waiting</span>
                    <span>~{eta} min wait</span>
                  </div>

                  <div className="text-xs text-gray-500 mb-3 space-y-1">
                    <p>
                      Current queue:{" "}
                      <span className={`font-medium ${crowd.text}`}>
                        {crowd.label} load
                      </span>
                    </p>
                    <p>
                      Compared with usual:{" "}
                      <span className={`font-medium ${insight.text}`}>
                        {insight.label}
                      </span>
                    </p>
                    <p>
                      Usual now: {insight.usualLow}-{insight.usualHigh} people,{" "}
                      {insight.usualLabel}
                    </p>
                    <p>
                      Best time to go: {insight.bestTime} today - ~
                      {insight.bestWait} min wait
                    </p>
                  </div>

                  <div className="mt-2">
                    {score >= 0.7 ? (
                      <button
                        onClick={() => navigate(`/queue/${est.id}/join`)}
                        className="w-full py-2 text-sm font-medium bg-black text-white rounded-lg"
                      >
                        Join Remotely (Walk-in disabled)
                      </button>
                    ) : (
                      <button
                        disabled={isDisabled}
                        onClick={() => navigate(`/queue/${est.id}`)}
                        className={`w-full py-2 text-sm font-medium rounded-lg ${
                          isDisabled
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-black text-white"
                        }`}
                      >
                        {isDisabled ? "Queue Unavailable" : "View Queue"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
