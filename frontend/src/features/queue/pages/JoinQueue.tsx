import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue, push, set, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth";

type Establishment = {
  name: string;
  location: string;
  service_time: number;
  queue_capacity: number;
};

type Priority = "none" | "senior" | "pwd" | "pregnant";

export default function JoinQueue() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [isOnSite, setIsOnSite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    const estUnsub = onValue(ref(db, `establishments/${id}`), (snapshot) => {
      if (snapshot.exists()) setEstablishment(snapshot.val());
    });

    const queueUnsub = onValue(ref(db, `queues/${id}/users`), (snapshot) => {
      if (!snapshot.exists()) { setWaitingCount(0); return; }
      const users = Object.values(snapshot.val()) as { status: string }[];
      setWaitingCount(
        users.filter((u) => u.status === "waiting" || u.status === "serving" || u.status === "called").length
      );
    });

    return () => { estUnsub(); queueUnsub(); };
  }, [id]);

  const handleJoin = async () => {
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!user || !id) return;

    setLoading(true);
    setError("");

    try {
      // Atomically increment ticket counter
      const counterRef = ref(db, `queues/${id}/ticket_counter`);
      let ticketNumber = 1;

      await runTransaction(counterRef, (current) => {
        ticketNumber = (current || 0) + 1;
        return ticketNumber;
      });

      const position = waitingCount + 1;
      const serviceTime = establishment?.service_time || 3;
      const eta = (position - 1) * serviceTime;

      // Push new queue entry
      const entryRef = push(ref(db, `queues/${id}/users`));
      const pushKey = entryRef.key!;

      await set(entryRef, {
        user_id: user.uid,
        qr_id: pushKey,
        name: name.trim(),
        status: "waiting",
        ticket_number: ticketNumber,
        station_id: null,
        is_priority: priority !== "none",
        priority_type: priority,
        join_method: isOnSite ? "walk_in" : "remote",
        joined_at: Date.now(),
        called_at: null,
        completed_at: null,
        eta,
        position,
      });

      navigate(`/ticket/${id}/${pushKey}`);
    } catch (err) {
      setError("Failed to join queue. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!establishment) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  const eta = waitingCount * (establishment.service_time || 3);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(`/queue/${id}`)}
          className="text-gray-500 hover:text-black text-sm"
        >
          ← Back
        </button>
        <div>
          <h1 className="font-bold text-base">Join Queue</h1>
          <p className="text-xs text-gray-500">{establishment.name}</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">

        {/* QUEUE SNAPSHOT */}
        <div className="bg-white border rounded-xl p-4 shadow-sm flex justify-between text-sm text-gray-600">
          <span>{waitingCount} people waiting</span>
          <span>~{eta} min estimated wait</span>
        </div>

        {/* FORM */}
        <div className="bg-white border rounded-xl p-4 shadow-sm space-y-4">

          {/* NAME */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* PRIORITY */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority Lane
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="none">None (Regular)</option>
              <option value="senior">Senior Citizen</option>
              <option value="pwd">PWD</option>
              <option value="pregnant">Pregnant</option>
            </select>
          </div>

          {/* ON-SITE TOGGLE */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">I'm at the venue</p>
              <p className="text-xs text-gray-400">Toggle if you're joining on-site</p>
            </div>
            <button
              onClick={() => setIsOnSite(!isOnSite)}
              className={`w-11 h-6 rounded-full transition-colors ${
                isOnSite ? "bg-black" : "bg-gray-200"
              }`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
                  isOnSite ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* ERROR */}
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* SUBMIT */}
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full py-3 bg-black text-white rounded-xl font-semibold text-sm disabled:opacity-50"
          >
            {loading ? "Joining..." : "Confirm & Join Queue"}
          </button>
        </div>
      </div>
    </div>
  );
}
