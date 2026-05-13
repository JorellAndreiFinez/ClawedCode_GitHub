import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue, update } from "firebase/database";
import { QRCodeSVG } from "qrcode.react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth";

type QueueEntry = {
  user_id: string;
  name: string;
  status: "waiting" | "called" | "serving" | "skipped" | "done";
  ticket_number: number;
  is_priority: boolean;
  priority_type: string;
  join_method: string;
  joined_at: number;
  called_at: number | null;
  completed_at: number | null;
  eta: number;
  position: number;
};

type Establishment = {
  name: string;
  location: string;
  service_time: number;
  queue_capacity: number;
};

function getCrowdLevel(score: number) {
  if (score >= 0.7) return { label: "High", emoji: "🔴", color: "text-red-600 bg-red-50 border-red-200" };
  if (score >= 0.3) return { label: "Moderate", emoji: "🟡", color: "text-yellow-600 bg-yellow-50 border-yellow-200" };
  return { label: "Low", emoji: "🟢", color: "text-green-600 bg-green-50 border-green-200" };
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 600);
  } catch (_) {}
}

function computePosition(
  allUsers: { id: string; joined_at: number; is_priority: boolean; status: string }[],
  myEntry: { id: string; joined_at: number; is_priority: boolean }
): number {
  const waiting = allUsers.filter((u) => u.status === "waiting");
  let ahead = 0;

  for (const u of waiting) {
    if (u.id === myEntry.id) continue;
    if (myEntry.is_priority) {
      if (u.is_priority && u.joined_at < myEntry.joined_at) ahead++;
    } else {
      if (u.is_priority || (!u.is_priority && u.joined_at < myEntry.joined_at)) ahead++;
    }
  }

  return ahead + 1;
}

const STATUS_STEPS = ["waiting", "called", "serving", "done"] as const;
const STATUS_LABELS: Record<string, string> = {
  waiting: "Joined",
  called: "Called",
  serving: "Serving",
  done: "Done",
};

export default function TicketPage() {
  const { estId, pushKey } = useParams<{ estId: string; pushKey: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: string; joined_at: number; is_priority: boolean; status: string }[]>([]);
  const [position, setPosition] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);

  const prevPositionRef = useRef<number | null>(null);
  const beepedRef = useRef(false);

  useEffect(() => {
    if (!estId) return;
    return onValue(ref(db, `establishments/${estId}`), (snap) => {
      if (snap.exists()) setEstablishment(snap.val());
    });
  }, [estId]);

  useEffect(() => {
    if (!estId || !pushKey) return;
    return onValue(ref(db, `queues/${estId}/users/${pushKey}`), (snap) => {
      if (snap.exists()) setEntry(snap.val());
    });
  }, [estId, pushKey]);

  useEffect(() => {
    if (!estId) return;
    return onValue(ref(db, `queues/${estId}/users`), (snap) => {
      if (!snap.exists()) { setAllUsers([]); return; }
      const list = Object.entries(snap.val()).map(([id, val]: [string, any]) => ({
        id,
        joined_at: val.joined_at,
        is_priority: val.is_priority,
        status: val.status,
      }));
      setAllUsers(list);
    });
  }, [estId]);

  useEffect(() => {
    if (!entry || !pushKey) return;
    if (entry.status !== "waiting") { setPosition(null); return; }

    const pos = computePosition(allUsers, {
      id: pushKey,
      joined_at: entry.joined_at,
      is_priority: entry.is_priority,
    });

    if (pos === 1 && prevPositionRef.current !== 1 && !beepedRef.current) {
      playBeep();
      beepedRef.current = true;
    }
    if (pos !== 1) beepedRef.current = false;

    prevPositionRef.current = pos;
    setPosition(pos);
  }, [allUsers, entry, pushKey]);

  const handleRejoin = async () => {
    if (!estId || !pushKey) return;
    await update(ref(db, `queues/${estId}/users/${pushKey}`), {
      status: "waiting",
      joined_at: Date.now(),
      called_at: null,
    });
  };

  const handleLeave = async () => {
    if (!estId || !pushKey) return;
    await update(ref(db, `queues/${estId}/users/${pushKey}`), {
      status: "done",
      completed_at: Date.now(),
    });
    navigate("/dashboard");
  };

  if (!entry || !establishment) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  const serviceTime = establishment.service_time || 3;
  const eta = position != null ? (position - 1) * serviceTime : 0;
  const isYouAreNext = position === 1 && entry.status === "waiting";
  const activeStep = STATUS_STEPS.indexOf(entry.status as any);

  const activeCount = allUsers.filter(
    (u) => u.status === "waiting" || u.status === "called" || u.status === "serving"
  ).length;
  const crowdScore = Math.min(activeCount / (establishment.queue_capacity || 1), 1);
  const crowd = getCrowdLevel(crowdScore);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* YOU ARE NEXT BANNER */}
      {isYouAreNext && (
        <div className="animate-pulse bg-green-500 text-white text-center py-4 px-4">
          <p className="text-xl font-bold tracking-wide">🔔 YOU ARE NEXT!</p>
          <p className="text-sm opacity-90">Please proceed to the counter now.</p>
        </div>
      )}

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

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">

        {/* TICKET NUMBER + QR */}
        <div className="bg-white border rounded-xl p-6 shadow-sm flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Your Ticket</p>
            <p className="text-6xl font-black">#{entry.ticket_number}</p>
            {entry.is_priority && (
              <span className="mt-2 inline-block text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                {entry.priority_type === "senior" ? "Senior Citizen" : entry.priority_type === "pwd" ? "PWD" : "Pregnant"} Priority
              </span>
            )}
          </div>
          <QRCodeSVG value={pushKey!} size={140} />
          <p className="text-xs text-gray-400">Show this QR at the venue</p>

          {/* CROWD BADGE */}
          <div className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full border ${crowd.color}`}>
            {crowd.emoji} {crowd.label} Crowd · {activeCount} in queue
          </div>
        </div>

        {/* SKIPPED STATE */}
        {entry.status === "skipped" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center space-y-3">
            <p className="text-red-700 font-semibold">You missed your turn</p>
            <p className="text-red-500 text-sm">Ask staff or rejoin at the back of the queue.</p>
            <button
              onClick={handleRejoin}
              className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-semibold"
            >
              Rejoin at Back
            </button>
          </div>
        )}

        {/* CALLED / SERVING STATE */}
        {(entry.status === "called" || entry.status === "serving") && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-green-700 font-bold text-lg">It's your turn!</p>
            <p className="text-green-600 text-sm mt-1">Please proceed to the counter.</p>
          </div>
        )}

        {/* WAITING STATE */}
        {entry.status === "waiting" && (
          <div className="bg-white border rounded-xl p-4 shadow-sm space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className={`rounded-lg p-3 transition-all duration-500 ${isYouAreNext ? "bg-green-50" : "bg-gray-50"}`}>
                <p className={`text-3xl font-black transition-all duration-300 ${isYouAreNext ? "text-green-600" : ""}`}>
                  {position}
                </p>
                <p className="text-xs text-gray-500 mt-1">Position</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-3xl font-black">{position != null ? position - 1 : 0}</p>
                <p className="text-xs text-gray-500 mt-1">Ahead</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-3xl font-black">~{eta}</p>
                <p className="text-xs text-gray-500 mt-1">Min wait</p>
              </div>
            </div>
          </div>
        )}

        {/* DONE STATE */}
        {entry.status === "done" && (
          <div className="bg-gray-50 border rounded-xl p-4 text-center">
            <p className="text-gray-700 font-semibold">You've been served!</p>
            <p className="text-gray-400 text-sm mt-1">Thank you for using LINEA.</p>
          </div>
        )}

        {/* STATUS TIMELINE */}
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-widest">Status</p>
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${
                      i <= activeStep
                        ? "bg-black border-black"
                        : "bg-white border-gray-300"
                    }`}
                  />
                  <p className={`text-xs mt-1 ${i <= activeStep ? "text-black font-medium" : "text-gray-400"}`}>
                    {STATUS_LABELS[step]}
                  </p>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 ${i < activeStep ? "bg-black" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* I'M HERE BUTTON (mock check-in) */}
        {entry.status === "waiting" && !checkedIn && (
          <button
            onClick={() => setCheckedIn(true)}
            className="w-full py-2.5 border-2 border-black text-black rounded-xl text-sm font-semibold"
          >
            📍 I'm here (Check-in)
          </button>
        )}
        {checkedIn && (
          <p className="text-center text-green-600 text-sm font-medium">✅ Arrival confirmed</p>
        )}

        {/* LEAVE QUEUE */}
        {entry.status !== "done" && (
          <button
            onClick={handleLeave}
            className="w-full py-2.5 text-red-500 text-sm font-medium"
          >
            Leave Queue
          </button>
        )}
      </div>
    </div>
  );
}
