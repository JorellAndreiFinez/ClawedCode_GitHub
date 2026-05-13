import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth";

type QueueEntry = {
  id: string;
  user_id: string;
  qr_id: string;
  name: string;
  status: "waiting" | "called" | "serving" | "skipped" | "done";
  ticket_number: number;
  station_id: string | null;
  is_priority: boolean;
  joined_at: number;
  called_at: number | null;
  completed_at: number | null;
  eta: number;
  position: number;
};

type Establishment = {
  name: string;
  service_time: number;
};

type ActiveQueue = {
  establishmentName: string;
  entry: QueueEntry;
  currentServing: string | null;
};

export default function LiveQueueTracking() {
  const { user } = useAuth();
  const [activeQueue, setActiveQueue] = useState<ActiveQueue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let establishments: Record<string, Establishment> = {};

    const estUnsub = onValue(ref(db, "establishments"), (snapshot) => {
      if (snapshot.exists()) establishments = snapshot.val();
    });

    const queuesUnsub = onValue(ref(db, "queues"), (snapshot) => {
      if (!snapshot.exists()) {
        setActiveQueue(null);
        setLoading(false);
        return;
      }

      const queuesData = snapshot.val() as Record<
        string,
        { users: Record<string, Omit<QueueEntry, "id">> }
      >;

      let found: ActiveQueue | null = null;

      for (const [estId, estQueue] of Object.entries(queuesData)) {
        if (!estQueue.users) continue;

        const users: QueueEntry[] = Object.entries(estQueue.users).map(
          ([id, entry]) => ({ id, ...entry })
        );

        const userEntry = users.find(
          (u) =>
            u.user_id === user.uid &&
            (u.status === "waiting" ||
              u.status === "called" ||
              u.status === "serving" ||
              u.status === "skipped")
        );

        if (!userEntry) continue;

        const currentServing =
          users.find((u) => u.status === "serving" || u.status === "called")
            ?.name || null;

        found = {
          establishmentName: establishments[estId]?.name || "Unknown",
          entry: userEntry,
          currentServing,
        };
        break;
      }

      setActiveQueue(found);
      setLoading(false);
    });

    return () => {
      estUnsub();
      queuesUnsub();
    };
  }, [user]);

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-3">Your Queue</h2>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      {!loading && !activeQueue && (
        <p className="text-sm text-gray-500">You are not in any queue.</p>
      )}

      {!loading && activeQueue && (
        <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{activeQueue.establishmentName}</h3>
            {activeQueue.entry.is_priority && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                Priority
              </span>
            )}
          </div>

          {activeQueue.entry.status === "called" ||
          activeQueue.entry.status === "serving" ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-green-700 font-semibold text-lg">
                It's your turn!
              </p>
              <p className="text-green-600 text-sm">
                Please proceed to the counter.
              </p>
            </div>
          ) : activeQueue.entry.status === "skipped" ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <p className="text-red-700 font-semibold">You missed your turn</p>
              <p className="text-red-600 text-sm">
                Please ask the staff to rejoin the queue.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold">
                    #{activeQueue.entry.ticket_number}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Ticket</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold">
                    {activeQueue.entry.position}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Position</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold">
                    ~{activeQueue.entry.eta}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Min wait</p>
                </div>
              </div>

              {activeQueue.currentServing && (
                <p className="text-sm text-gray-600 text-center">
                  Now serving:{" "}
                  <span className="font-medium">
                    {activeQueue.currentServing}
                  </span>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
