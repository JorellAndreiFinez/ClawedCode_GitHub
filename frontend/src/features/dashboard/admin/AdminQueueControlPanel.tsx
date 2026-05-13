import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { getMyEstablishment } from "@/lib/establishment";
import { getAuth } from "firebase/auth";

export default function AdminQueueControlPanel() {
  const [queue, setQueue] = useState<any>(null);
  const [queueId, setQueueId] = useState<string | null>(null);

  useEffect(() => {
    let unsub: any;

    const init = async () => {
      const data: any = await getMyEstablishment();
      const qid = data?.queue_id;

      setQueueId(qid);
      if (!qid) return;

      unsub = onValue(ref(db, `queues/${qid}`), (snap) => {
        setQueue(snap.val());
      });
    };

    init();
    return () => unsub?.();
  }, []);

  const togglePause = async (station: any) => {
    const action = station.status === "paused" ? "resume" : "pause";
    await api(station.id, action);
  };

  /**
   * =========================
   * STATION API CALL (FIXED)
   * =========================
   */
  const api = async (stationId: string, action: string) => {
    if (!queueId) return;

    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();

    return fetch(
      `${import.meta.env.VITE_API_URL}/admin/queues/${queueId}/${stationId}/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
  };

  /**
   * =========================
   * RETURN NO SHOW USER (NEW)
   * =========================
   */
  const returnNoShow = async (userId: string) => {
    if (!queueId) return;

    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();

    return fetch(
      `${import.meta.env.VITE_API_URL}/admin/queues/${queueId}/no-show/${userId}/return`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
  };

  if (!queue) return <div className="p-6 text-sm">Loading queue...</div>;

  const users = Object.entries(queue.users || {}).map(([id, u]: any) => ({
    id,
    ...u,
  }));

  const stations = Object.values(queue.stations || {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Queue Control Center
        </h1>
        <p className="text-sm text-gray-500">Multi-Station Live Operations</p>
      </div>

      {/* ========================= */}
      {/* STATION DASHBOARD */}
      {/* ========================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stations.map((station: any) => {
          const state = station.queue_state || {};

          const activeUser = users.find(
            (u) => u.id === state.current_serving_user_id,
          );

          const stationUsers = users.filter((u) => u.station_id === station.id);

          return (
            <div
              key={station.id}
              className="bg-white border rounded-2xl shadow-sm p-4"
            >
              {/* HEADER */}
              <div className="flex justify-between items-center mb-3">
                <div className="text-xs bg-black text-white px-3 py-1 rounded-full">
                  {station.name}
                </div>

                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    station.status === "active"
                      ? "bg-green-100 text-green-600"
                      : station.status === "paused"
                        ? "bg-yellow-100 text-yellow-600"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {station.status}
                </span>
              </div>

              {/* NOW SERVING */}
              <div className="text-center py-4">
                <p className="text-xs text-gray-400 uppercase">Now Serving</p>

                <div className="text-4xl font-bold mt-2">
                  {activeUser ? `#${activeUser.ticket_number}` : "—"}
                </div>

                {activeUser?.name && (
                  <p className="text-xs text-gray-500 mt-1">
                    {activeUser.name}
                  </p>
                )}
              </div>

              {/* ACTIONS */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={() => api(station.id, "next")}
                  className="col-span-2 bg-black text-white rounded-xl py-2 text-sm"
                >
                  Next
                </button>

                <button
                  onClick={() => api(station.id, "skip")}
                  className="bg-amber-50 text-amber-600 rounded-lg py-2 text-xs"
                >
                  Skip
                </button>

                <button
                  onClick={() => api(station.id, "no-show")}
                  className="bg-red-50 text-red-600 rounded-lg py-2 text-xs"
                >
                  No Show
                </button>

                <button
                  onClick={() => togglePause(station)}
                  className={`rounded-lg py-2 text-xs ${
                    station.status === "paused"
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {station.status === "paused" ? "Resume" : "Pause"}
                </button>
              </div>

              {/* INFO */}
              <div className="mt-3 text-xs text-gray-500">
                Waiting: {stationUsers.length}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================= */}
      {/* LIVE QUEUE TABLE */}
      {/* ========================= */}
      <div className="mt-6 bg-white border rounded-2xl overflow-hidden">
        <div className="p-4 border-b flex justify-between">
          <h2 className="font-semibold">Live Queue</h2>
          <span className="text-xs text-gray-500">{users.length} users</span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="p-3 text-left">Ticket</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Station</th>
              <th className="p-3 text-left">ETA</th>
            </tr>
          </thead>

          <tbody>
            {users
              .sort((a, b) => a.position - b.position)
              .map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3 font-medium">#{u.ticket_number}</td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-1 rounded bg-gray-100">
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500">
                    {queue.stations?.[u.station_id]?.name || "—"}
                  </td>
                  <td className="p-3 text-gray-500">{u.eta || 0} min</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ========================= */}
      {/* NO SHOW TABLE */}
      {/* ========================= */}
      <div className="mt-6 bg-white border rounded-2xl overflow-hidden">
        <div className="p-4 border-b flex justify-between">
          <h2 className="font-semibold">No Show Queue</h2>
          <span className="text-xs text-gray-500">
            {Object.keys(queue?.no_shows || {}).length} users
          </span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-red-50 text-xs text-red-600">
            <tr>
              <th className="p-3 text-left">Ticket</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Station</th>
              <th className="p-3 text-left">Countdown</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {Object.entries(queue?.no_shows || {}).map(([id, u]: any) => {
              const remainingMs = (u.expires_at || 0) - Date.now();
              const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));
              const isExpired = remainingMs <= 0;

              return (
                <tr key={id} className="border-t">
                  <td className="p-3 font-medium">#{u.ticket_number}</td>
                  <td className="p-3 text-gray-700">{u.name}</td>
                  <td className="p-3 text-gray-500">
                    {queue.stations?.[u.station_id]?.name || "—"}
                  </td>

                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        isExpired
                          ? "bg-gray-200 text-gray-600"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {isExpired ? "Expired" : `${remainingMin} min left`}
                    </span>
                  </td>

                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        isExpired
                          ? "bg-red-200 text-red-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {isExpired ? "Cancelled" : "No Show"}
                    </span>
                  </td>

                  <td className="p-3">
                    {!isExpired && (
                      <button
                        onClick={() => returnNoShow(id)}
                        className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700"
                      >
                        Return
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
