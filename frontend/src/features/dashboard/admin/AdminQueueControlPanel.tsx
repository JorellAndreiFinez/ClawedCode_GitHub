import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { getMyEstablishment } from "@/lib/establishment";
import { getAuth } from "firebase/auth";

import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  MapPin,
  Users,
  UserX,
  TrendingUp,
  Clock,
  History,
  Activity,
} from "lucide-react";

function SortableCard({ user, queue }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: user.id,
    disabled: user.status !== "waiting",
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white border rounded-xl p-4 shadow-sm
        flex items-center justify-between gap-4
        transition
        hover:shadow-md hover:-translate-y-[1px]
        ${isDragging ? "opacity-60 scale-[1.02] shadow-lg" : ""}
      `}
    >
      {/* LEFT SIDE */}
      <div className="flex items-center gap-3">
        {/* DRAG HANDLE (BIG + EASY) */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 text-lg px-2"
        >
          ⋮⋮
        </div>

        {/* TICKET */}
        <div>
          <div className="font-semibold text-gray-900">
            #{user.ticket_number}
          </div>
          <div className="text-xs text-gray-500">
            {queue.stations?.[user.station_id]?.name || "Unassigned"}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-4">
        {/* STATUS */}
        <span
          className={`
            text-[11px] px-2 py-1 rounded-full font-medium
            ${
              user.status === "waiting"
                ? "bg-blue-50 text-blue-600"
                : "bg-gray-100 text-gray-500"
            }
          `}
        >
          {user.status}
        </span>

        {/* ETA */}
        <div className="text-right">
          <div className="text-sm font-medium text-gray-700">
            {user.eta || 0} min
          </div>
          <div className="text-[10px] text-gray-400">ETA</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminQueueControlPanel() {
  const [queue, setQueue] = useState<any>(null);
  const [localUsers, setLocalUsers] = useState<any[]>([]);
  const [queueId, setQueueId] = useState<string | null>(null);

  const [establishment, setEstablishment] = useState<any>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanLockRef = useRef(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeStationId, setActiveStationId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const data: any = await getMyEstablishment();
      const qid = data?.queue_id;

      setEstablishment(data);
      setQueueId(qid);

      if (!qid) return;

      const unsub = onValue(ref(db, `queues/${qid}`), (snap) => {
        setQueue(snap.val());
      });

      return () => unsub();
    };

    init();
  }, []);

  const capacity = establishment?.queue_capacity ?? 1;
  const waitingCount = Object.values(queue?.users || {}).filter(
    (u: any) => u.status === "waiting",
  ).length;

  const servedCount = queue?.analytics?.total_served || 0;

  const ratio = waitingCount / capacity;

  const crowdLevel = ratio <= 0.3 ? "Low" : ratio <= 0.7 ? "Moderate" : "High";

  const [verifiedStations, setVerifiedStations] = useState<
    Record<string, boolean>
  >({});

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    if (!queue) return;

    const sortedUsers = Object.entries(queue.users || {})
      .map(([id, u]: any) => ({
        id,
        ...u,
      }))
      .filter((u: any) => u.status !== "completed" && u.status !== "cancelled")
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

    setLocalUsers(sortedUsers);
  }, [queue]);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = localUsers.findIndex((u) => u.id === active.id);
    const newIndex = localUsers.findIndex((u) => u.id === over.id);

    const reordered = arrayMove(localUsers, oldIndex, newIndex);

    setLocalUsers(reordered);

    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      await fetch(
        `${import.meta.env.VITE_API_URL}/admin/queues/${queueId}/reorder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderedUserIds: reordered
              .filter((u) => u.status === "waiting")
              .map((u) => u.id),
          }),
        },
      );

      toast.success("Queue reordered");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const startScanner = async (stationId: string) => {
    const station = queue.stations?.[stationId];

    const activeUser = users.find(
      (u) => u.id === station?.queue_state?.current_serving_user_id,
    );

    if (!activeUser || activeUser.status !== "called") {
      toast.error("Call next user first before scanning QR");
      return;
    }

    scanLockRef.current = false; // ✅ reset ONLY here

    setActiveStationId(stationId);
    setScannerOpen(true);
  };

  const handleFinish = async (stationId: string) => {
    await api(stationId, "finish");

    setVerifiedStations((prev) => ({
      ...prev,
      [stationId]: false,
    }));
  };

  useEffect(() => {
    if (!scannerOpen) return;

    const qrScanner = new Html5Qrcode("qr-reader");
    scannerRef.current = qrScanner;
    scanLockRef.current = false; // reset lock

    Html5Qrcode.getCameras()
      .then(async (cameras) => {
        if (!cameras.length) {
          toast.error("No camera found");
          return;
        }

        await qrScanner.start(
          cameras[0].id,
          { fps: 10, qrbox: 250 },
          async (decodedText) => {
            if (scanLockRef.current) return;
            scanLockRef.current = true;

            // 🛑 STOP CAMERA IMMEDIATELY (CRITICAL FIX)
            await stopScanner();

            try {
              const auth = getAuth();
              const token = await auth.currentUser?.getIdToken();

              const res = await fetch(
                `${import.meta.env.VITE_API_URL}/admin/queues/${queueId}/${activeStationId}/verify-scan`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    scannedUserId: decodedText,
                  }),
                },
              );

              const data = await res.json();

              if (!res.ok) {
                toast.error(data.error || "QR mismatch");
                return;
              }

              toast.success("Verified ✔️");

              setVerifiedStations((prev) => ({
                ...prev,
                [activeStationId!]: true,
              }));
            } catch (err: any) {
              toast.error(err.message);
            }
          },
          () => {},
        );
      })
      .catch((err) => {
        toast.error("Camera error");
        console.error(err);
      });

    return () => {
      stopScanner();
    };
  }, [scannerOpen]);

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

  const stopScanner = async () => {
    try {
      const scanner = scannerRef.current;

      if (scanner) {
        await scanner.stop();
        await scanner.clear();
      }

      scannerRef.current = null;

      // 🧠 EXTRA SAFETY RESET
      scanLockRef.current = true; // permanently block until reopened
    } catch (err) {
      console.log("Scanner stop error:", err);
    } finally {
      setScannerOpen(false);
    }
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

  const completedUsers = Object.entries(queue.history || {}).map(
    ([id, u]: any) => ({
      id,
      ...u,
      _type: "completed",
    }),
  );

  const noShowUsers = Object.entries(queue.users || {}).map(([id, u]: any) => ({
    id,
    ...u,
    _type: u.status === "cancelled" ? "cancelled" : "noshow",
  }));

  const historyLogs = [...completedUsers, ...noShowUsers].sort(
    (a: any, b: any) =>
      (b.service_end_at || b.moved_at || 0) -
      (a.service_end_at || a.moved_at || 0),
  );

  const stations = Object.values(queue.stations || {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text:3xl sm:text-4xl font-semibold">
              {establishment?.name}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xl text-slate-500 mt-1">
            <MapPin className="w-4 h-4" />
            {establishment?.location}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
        {/* SERVED */}
        <div className="bg-white border rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-green-600" />
            <span className="text-lg font-bold">{servedCount}</span>
            <span className="text-xs text-gray-500">served</span>
          </div>
        </div>

        {/* CROWD */}
        <div className="bg-white border rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-lg font-bold capitalize">{crowdLevel}</span>
            <span className="text-xs text-gray-500">
              {waitingCount}/{capacity}
            </span>
          </div>
        </div>

        {/* WAITING */}
        <div className="bg-white border rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-lg font-bold">{waitingCount}</span>
            <span className="text-xs text-gray-500">waiting</span>
          </div>
        </div>
      </div>

      {/* ========================= */}
      {/* STATION DASHBOARD */}
      {/* ========================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stations.map((station: any) => {
          const state = station.queue_state || {};
          const isServing = !!state.current_serving_user_id;

          const activeUser = users.find(
            (u) => u.id === state.current_serving_user_id,
          );

          const stationUsers = users.filter((u) => u.station_id === station.id);

          return (
            <div
              key={station.id}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition"
            >
              {/* HEADER */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-medium px-3 py-1 rounded-full bg-gray-900 text-white">
                  {station.name}
                </div>

                <span
                  className={`text-[11px] px-2 py-1 rounded-full font-medium ${
                    station.status === "active"
                      ? "bg-green-50 text-green-600"
                      : station.status === "paused"
                        ? "bg-yellow-50 text-yellow-600"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {station.status}
                </span>
              </div>

              {/* NOW SERVING */}
              <div className="flex flex-col items-center justify-center py-5">
                <div className="text-[11px] text-gray-400 tracking-wide uppercase">
                  Now serving
                </div>

                <div className="text-4xl font-bold mt-2 tracking-tight">
                  {activeUser ? `#${activeUser.ticket_number}` : "—"}
                </div>

                {activeUser?.name && (
                  <div className="text-xs text-gray-500 mt-1">
                    {activeUser.name}
                  </div>
                )}
              </div>

              {/* ACTIONS */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {/* PRIMARY ACTION */}
                <button
                  onClick={() =>
                    isServing
                      ? verifiedStations[station.id] && handleFinish(station.id)
                      : api(station.id, "next")
                  }
                  disabled={
                    station.status === "paused" ||
                    (isServing && !verifiedStations[station.id])
                  }
                  className={`group col-span-2 rounded-xl py-2 text-[13px] font-medium transition ${
                    station.status === "paused"
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : isServing && !verifiedStations[station.id]
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-[#35AE7C] text-white group-hover:border group-hover:bg-none"
                  }`}
                >
                  {station.status === "paused"
                    ? "Paused"
                    : isServing
                      ? "Finish"
                      : "Next Customer"}
                </button>

                {/* VERIFY */}
                <button
                  onClick={() => startScanner(station.id)}
                  disabled={
                    station.status === "paused" || verifiedStations[station.id]
                  }
                  className={`col-span-2 rounded-xl py-2 text-sm font-medium transition ${
                    station.status === "paused"
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : verifiedStations[station.id]
                        ? "shadow-2xl text-[#35AE7C] bg-gray-800"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {station.status === "paused"
                    ? "Scan disabled"
                    : verifiedStations[station.id]
                      ? "Verified"
                      : "Scan QR"}
                </button>

                {/* SECONDARY ACTIONS */}

                <button
                  onClick={async () => {
                    if (station.status === "paused") return;

                    await api(station.id, "skip");

                    setVerifiedStations((prev) => ({
                      ...prev,
                      [station.id]: false,
                    }));
                  }}
                  disabled={station.status === "paused"}
                  className="rounded-lg py-2 text-xs font-medium
    bg-amber-100 text-amber-700 border border-amber-200
    hover:bg-amber-200 hover:border-amber-300
    transition
    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Skip
                </button>

                <button
                  onClick={() => {
                    if (station.status === "paused") return;
                    api(station.id, "no-show");
                  }}
                  disabled={station.status === "paused"}
                  className="rounded-lg py-2 text-xs font-medium
                    bg-red-100 text-red-700 border border-red-200
                    hover:bg-red-200 hover:border-red-300
                    transition
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  No show
                </button>

                <button
                  onClick={() => togglePause(station)}
                  className="col-span-2 rounded-lg py-2 text-xs font-medium
                    bg-slate-100 text-slate-700 border border-slate-200
                    hover:bg-slate-200 hover:border-slate-300
                    transition"
                >
                  {station.status === "paused" ? "Resume" : "Pause"}
                </button>
              </div>

              {/* FOOTER */}
              <div className="mt-4 text-[11px] text-gray-400">
                {stationUsers.length} in queue
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl p-4 my-5">
        <div className="flex justify-between py-2 px-3 items-center mb-3">
          <div className="flex items-center gap-2 font-lg text-gray-800">
            <Activity className="w-7 h-7 text-green-500 animate-pulse" />
            Live Queue
          </div>

          <span className="text-[11px] px-2 py-1 rounded-full bg-green-50 text-green-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            LIVE
          </span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localUsers.map((u) => u.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {localUsers.map((u) => (
                <SortableCard key={u.id} user={u} queue={queue} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* ========================= */}
      {/* HISTORY LOGS */}
      {/* ========================= */}
      <div className="bg-white rounded-2xl overflow-hidden mt-6">
        <div className="py-5 px-7 flex justify-between items-center">
          {/* LEFT */}
          <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <History className="w-6 h-6 text-gray-500" />
            History Logs
          </div>

          {/* RIGHT */}
          <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
            {historyLogs.length} records
          </div>
        </div>

        <div className="px-6 py-2 space-y-2">
          {historyLogs.map((h: any) => {
            const durationMin = h.service_duration_ms
              ? Math.ceil(h.service_duration_ms / 60000)
              : null;

            const isCompleted = h._type === "completed";
            const isNoShow = h._type === "noshow";
            const isCancelled = h._type === "cancelled";

            return (
              <div
                key={h.id}
                className="bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between gap-4 transition hover:shadow-md hover:-translate-y-[1px]"
              >
                {/* LEFT SIDE */}
                <div className="flex items-center gap-3">
                  {/* ICON / STATUS DOT */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isCompleted
                        ? "bg-green-500"
                        : isNoShow
                          ? "bg-red-500"
                          : "bg-gray-400"
                    }`}
                  />

                  {/* TICKET + INFO */}
                  <div>
                    <div className="font-semibold text-gray-900">
                      #{h.ticket_number}
                    </div>

                    <div className="text-xs text-gray-500">
                      {h.name || "Unknown"} •{" "}
                      {h.service_end_at
                        ? new Date(h.service_end_at).toLocaleTimeString()
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="flex items-center gap-4">
                  {/* DURATION */}
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-700">
                      {durationMin ? `${durationMin} min` : "—"}
                    </div>
                    <div className="text-[10px] text-gray-400">Duration</div>
                  </div>

                  {/* STATUS */}
                  <span
                    className={`text-[11px] px-2 py-1 rounded-full font-medium ${
                      isCompleted
                        ? "bg-green-50 text-green-600"
                        : isNoShow
                          ? "bg-red-50 text-red-600"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {isCompleted
                      ? "Completed"
                      : isNoShow
                        ? "No Show"
                        : "Cancelled"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================= */}
      {/* NO SHOW TABLE */}
      {/* ========================= */}
      <div className="mt-6 bg-white rounded-2xl overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-2 font-semibold">
            <UserX className="w-4 h-4 text-red-500" />
            No Show Queue
          </div>

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
              const remainingMs =
                u.status === "noshow" ? (u.expires_at || 0) - Date.now() : 0;
              const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));
              const isExpired = u.status === "cancelled";
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
                      {u.status === "noshow" && "No Show"}
                      {u.status === "cancelled" && "Expired"}
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

      {scannerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-[360px] rounded-2xl shadow-2xl overflow-hidden">
            {/* HEADER */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Scan User QR
                </h2>
                <p className="text-[11px] text-gray-400">
                  Align QR inside the frame
                </p>
              </div>

              {/* LIVE DOT */}
              <div className="flex items-center gap-2 text-xs text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </div>
            </div>

            {/* CAMERA AREA */}
            <div className="p-4">
              <div className="relative rounded-xl overflow-hidden border bg-black">
                {/* CAMERA FEED (UNCHANGED LOGIC) */}
                <div id="qr-reader" className="w-full" />

                {/* SCAN OVERLAY FRAME */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 border-2 border-white/20 rounded-xl" />

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-44 h-44 border-2 border-blue-500 rounded-xl shadow-lg animate-pulse" />
                  </div>
                </div>
              </div>

              {/* FOOTER BUTTON */}
              <button
                onClick={stopScanner}
                className="mt-4 w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
