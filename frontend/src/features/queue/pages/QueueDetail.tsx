import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";

type Establishment = {
  id: string;
  name: string;
  location: string;
  queue_capacity: number;
  service_time: number;
  status: "active" | "paused" | "closed";
};

type QueueEntry = {
  id: string;
  ticket_number: number;
  status: "waiting" | "called" | "serving" | "skipped" | "done";
  is_priority: boolean;
  name: string;
};

function getCrowdLevel(score: number) {
  if (score >= 0.7) return { label: "High", emoji: "🔴", bar: "bg-red-500", text: "text-red-600" };
  if (score >= 0.3) return { label: "Moderate", emoji: "🟡", bar: "bg-yellow-400", text: "text-yellow-600" };
  return { label: "Low", emoji: "🟢", bar: "bg-green-500", text: "text-green-600" };
}

export default function QueueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [users, setUsers] = useState<QueueEntry[]>([]);

  useEffect(() => {
    if (!id) return;

    const estUnsub = onValue(ref(db, `establishments/${id}`), (snapshot) => {
      if (snapshot.exists()) setEstablishment(snapshot.val());
    });

    const queueUnsub = onValue(ref(db, `queues/${id}/users`), (snapshot) => {
      if (!snapshot.exists()) {
        setUsers([]);
        return;
      }
      const list = Object.entries(snapshot.val()).map(([entryId, val]) => ({
        id: entryId,
        ...(val as Omit<QueueEntry, "id">),
      }));
      setUsers(list);
    });

    return () => {
      estUnsub();
      queueUnsub();
    };
  }, [id]);

  if (!establishment) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  const waiting = users.filter((u) => u.status === "waiting").length;
  const serving = users.filter((u) => u.status === "serving" || u.status === "called");
  const activeCount = waiting + serving.length;
  const score = Math.min(activeCount / establishment.queue_capacity, 1);
  const crowd = getCrowdLevel(score);
  const eta = waiting * (establishment.service_time || 3);
  const nextUp = users
    .filter((u) => u.status === "waiting")
    .sort((a, b) => a.ticket_number - b.ticket_number)[0];

  const isDisabled = establishment.status !== "active";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-gray-500 hover:text-black text-sm"
        >
          ← Back
        </button>
        <div>
          <h1 className="font-bold text-base">{establishment.name}</h1>
          <p className="text-xs text-gray-500">{establishment.location}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* CROWD LEVEL */}
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold text-sm text-gray-600">Crowd Level</h2>
            <span className={`text-sm font-bold ${crowd.text}`}>
              {crowd.emoji} {crowd.label}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${crowd.bar}`}
              style={{ width: `${Math.round(score * 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {Math.round(score * 100)}% capacity
          </p>
        </div>

        {/* QUEUE STATS */}
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-sm text-gray-600 mb-3">Queue Breakdown</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold">{waiting}</p>
              <p className="text-xs text-gray-500 mt-1">Waiting</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold">{serving.length}</p>
              <p className="text-xs text-gray-500 mt-1">Serving</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold">
                {nextUp ? `#${nextUp.ticket_number}` : "—"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Next</p>
            </div>
          </div>
        </div>

        {/* ETA */}
        <div className="bg-white border rounded-xl p-4 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Estimated Wait</p>
            <p className="text-2xl font-bold">~{eta} min</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Avg. service time</p>
            <p className="font-semibold">{establishment.service_time || 3} min / person</p>
          </div>
        </div>

        {/* CROWD SURGE STUB */}
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-sm text-gray-600 mb-2">Crowd Insight</h2>
          <div className="space-y-1 text-sm text-gray-600">
            <p>Right now: <span className="font-medium">{activeCount} people</span> · ~{eta} min wait</p>
            <p className="text-gray-400 text-xs">Usual at this time: 10–20 people (normal range)</p>
            <p className="text-gray-400 text-xs">Lighter period: typically early morning</p>
          </div>
        </div>

        {/* JOIN CTA */}
        <button
          disabled={isDisabled}
          onClick={() => navigate(`/queue/${id}/join`)}
          className={`w-full py-3 rounded-xl font-semibold text-sm ${
            isDisabled
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : score >= 0.7
              ? "bg-black text-white"
              : "bg-black text-white"
          }`}
        >
          {isDisabled
            ? `Queue ${establishment.status}`
            : score >= 0.7
            ? "Join Remotely (Walk-in disabled)"
            : "Join Queue"}
        </button>
      </div>
    </div>
  );
}
