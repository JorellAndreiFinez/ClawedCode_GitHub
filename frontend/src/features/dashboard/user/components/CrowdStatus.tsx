import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";

type Establishment = {
  id: string;
  name: string;
  location: string;
  queue_capacity: number;
  service_time: number;
  status: string;
};

type QueueEntry = {
  status: "waiting" | "called" | "serving" | "skipped" | "done";
};

function getCrowdLevel(score: number) {
  if (score >= 0.7) return { label: "High", emoji: "🔴" };
  if (score >= 0.3) return { label: "Moderate", emoji: "🟡" };
  return { label: "Low", emoji: "🟢" };
}

export default function CrowdStatus() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const estRef = ref(db, "establishments");
    const unsub = onValue(estRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const list = Object.values(snapshot.val()) as Establishment[];
      setEstablishments(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (establishments.length === 0) return;

    const unsubs = establishments.map((est) => {
      const queueRef = ref(db, `queues/${est.id}/users`);
      return onValue(queueRef, (snapshot) => {
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
      });
    });

    return () => unsubs.forEach((unsub) => unsub());
  }, [establishments]);

  if (establishments.length === 0) {
    return (
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">Crowd Status</h2>
        <p className="text-sm text-gray-500">No establishments available.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-3">Crowd Status</h2>
      <div className="space-y-3">
        {establishments.map((est) => {
          const queueLength = queueCounts[est.id] ?? 0;
          const score = queueLength / est.queue_capacity;
          const crowd = getCrowdLevel(score);
          const eta = queueLength * (est.service_time || 3);

          return (
            <div
              key={est.id}
              className="border rounded-lg p-4 bg-white shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{est.name}</h3>
                  <p className="text-sm text-gray-500">{est.location}</p>
                </div>
                <span className="text-sm font-medium">
                  {crowd.emoji} {crowd.label}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-sm text-gray-600">
                <span>{queueLength} in queue</span>
                <span>~{eta} min wait</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
