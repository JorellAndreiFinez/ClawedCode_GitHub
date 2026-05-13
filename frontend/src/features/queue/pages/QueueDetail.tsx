import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, onValue, push, ref, runTransaction, set, update } from "firebase/database";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Clock3,
  Info,
  Lightbulb,
  LockKeyhole,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getCrowdInsight } from "@/lib/crowdInsight";

type Establishment = {
  id?: string;
  name: string;
  location: string;
  queue_capacity: number;
  service_time: number;
  status: "active" | "paused" | "closed";
};

type QueueStatus = "waiting" | "called" | "serving" | "skipped" | "done" | "cancelled" | "no_show";

type QueueEntry = {
  id: string;
  user_id?: string;
  qr_id?: string;
  ticket_number?: number;
  status: QueueStatus;
  is_priority?: boolean;
  priority_type?: string;
  name?: string;
  joined_at?: number;
  called_at?: number | null;
  completed_at?: number | null;
  left_at?: number | null;
  checked_in?: boolean;
};

type NoShowEntry = Omit<QueueEntry, "status"> & {
  status: QueueStatus;
  expires_at?: number;
  moved_at?: number;
  station_id?: string | null;
};

type QueueStation = {
  status?: "active" | "paused" | "closed";
};

type ActivityItem = {
  id: string;
  label: string;
  time: string;
  dot: string;
};

const LOGO_SRC = "/linea/linea-logo.png";
const ACTIVE_STATUSES = new Set<QueueStatus>(["waiting", "called", "serving", "no_show"]);
const COOLDOWN_MS = 20 * 60 * 1000;

function getName(email?: string | null) {
  if (!email) return "Guest";
  return email.split("@")[0].replace(/[._-]+/g, " ");
}

function getInitial(email?: string | null) {
  return (email?.[0] || "L").toUpperCase();
}

function formatWait(minutes: number) {
  if (minutes <= 0) return "0min";
  return `~${minutes}min`;
}

function formatElapsed(timestamp?: number | null) {
  if (!timestamp) return "Just Now";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Just Now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} hr ago`;
  return `${hours} hr ${remaining} min ago`;
}

function formatDate(timestamp?: number | null) {
  const date = timestamp ? new Date(timestamp) : new Date();

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return "0 mins";
  if (minutes === 1) return "1 min";
  return `${minutes} mins`;
}

function getMinuteDiff(start?: number | null, end?: number | null) {
  if (!start || !end || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / 60000));
}

function formatCountdown(ms: number) {
  const safeMs = Math.max(ms, 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function getCrowdLevel(score: number) {
  if (score >= 0.7) {
    return {
      label: "High",
      badge: "border-[#fe7952] bg-[#ffdbd1] text-[#862201]",
    };
  }

  if (score >= 0.3) {
    return {
      label: "Moderate",
      badge: "border-[#fe7952] bg-[#ffdbd1] text-[#862201]",
    };
  }

  return {
    label: "Low",
    badge: "border-[#39b580] bg-[#83f9be]/35 text-[#006c47]",
  };
}

function getUsualCrowdLevel(usualHigh: number, capacity: number) {
  return getCrowdLevel(usualHigh / Math.max(capacity, 1));
}

function getActiveUsers(users: QueueEntry[]) {
  return users.filter((user) => ACTIVE_STATUSES.has(user.status));
}

function computePosition(users: QueueEntry[], entry: QueueEntry) {
  if (entry.status !== "waiting") return 1;

  const waiting = users.filter((user) => user.status === "waiting");
  let ahead = 0;

  for (const user of waiting) {
    if (user.id === entry.id) continue;

    const userJoinedAt = user.joined_at || 0;
    const entryJoinedAt = entry.joined_at || 0;

    if (entry.is_priority) {
      if (user.is_priority && userJoinedAt < entryJoinedAt) ahead += 1;
    } else if (user.is_priority || userJoinedAt < entryJoinedAt) {
      ahead += 1;
    }
  }

  return ahead + 1;
}

function buildActivity(users: QueueEntry[]): ActivityItem[] {
  return users
    .filter(
      (user) =>
        user.status === "done" ||
        user.status === "skipped" ||
        Boolean(user.left_at),
    )
    .sort(
      (a, b) =>
        (b.left_at || b.completed_at || b.called_at || b.joined_at || 0) -
        (a.left_at || a.completed_at || a.called_at || a.joined_at || 0),
    )
    .slice(0, 6)
    .map((user) => {
      const number = user.ticket_number ? `#${user.ticket_number}` : "";

      if (user.left_at) {
        return {
          id: user.id,
          label: `User ${number} left the queue`,
          time: formatElapsed(user.left_at),
          dot: "bg-[#cb9900]",
        };
      }

      if (user.status === "skipped") {
        return {
          id: user.id,
          label: `User ${number} skipped - No Show`,
          time: formatElapsed(user.called_at || user.completed_at),
          dot: "bg-[#fe7952]",
        };
      }

      return {
        id: user.id,
        label: `User ${number} served`,
        time: formatElapsed(user.completed_at),
        dot: "bg-[#39b580]",
      };
    });
}

function Modal({
  children,
  onClose,
  maxWidth = "max-w-xl",
}: {
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 py-8">
      <button
        aria-label="Close modal"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidth} rounded-[28px] border border-[#303031] bg-white px-8 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.35)] md:px-14`}
      >
        {children}
      </div>
    </div>
  );
}

export default function QueueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [users, setUsers] = useState<QueueEntry[]>([]);
  const [joinOpen, setJoinOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [noShows, setNoShows] = useState<NoShowEntry[]>([]);
  const [stations, setStations] = useState<QueueStation[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isNoShowOpen, setIsNoShowOpen] = useState(true)

  useEffect(() => {
    if (!id) return;

    const estUnsub =  onValue(ref(db, `queues/${id}`), async (snapshot) => {
      if (snapshot.exists()) {
        const estId = snapshot.val().establishment_id;
        const estSnapshot = await get(ref(db, `establishments/${estId}`))
        if (estSnapshot.exists()) setEstablishment(estSnapshot.val())
      }
    })

    const queueUnsub = onValue(ref(db, `queues/${id}/users`), (snapshot) => {
      if (!snapshot.exists()) {
        setUsers([]);
        return;
      }

      const list = Object.entries(snapshot.val()).map(([entryId, value]) => ({
        id: entryId,
        ...(value as Omit<QueueEntry, "id">),
      }));

      setUsers(list);
    });

    const noShowUnsub = onValue(ref(db, `queues/${id}/no_shows`), (snapshot) => {
      if (!snapshot.exists()) {
        setNoShows([]);
        return;
      }

      const list = Object.entries(snapshot.val()).map(([entryId, value]) => ({
        id: entryId,
        ...(value as Omit<NoShowEntry, "id">),
      }));

      setNoShows(list);
    });

    const stationUnsub = onValue(ref(db, `queues/${id}/stations`), (snapshot) => {
      if (!snapshot.exists()) {
        setStations([]);
        return;
      }

      setStations(Object.values(snapshot.val()) as QueueStation[]);
    });

    return () => {
      estUnsub();
      queueUnsub();
      noShowUnsub();
      stationUnsub();
    };
  }, [id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeUsers = useMemo(() => getActiveUsers(users), [users]);
  const myUserEntry = useMemo(() => {
    if (!user) return null;
    return (
      [...users]
        .filter((entry) => entry.user_id === user.uid)
        .sort((a, b) => (b.joined_at || 0) - (a.joined_at || 0))[0] || null
    );
  }, [users, user]);
  const myEntry = useMemo(() => {
    if (!user) return null;
    return activeUsers.find((entry) => entry.user_id === user.uid) || null;
  }, [activeUsers, user]);
  const myNoShowEntry = useMemo(() => {
    if (!user) return null;
    return (
      [...noShows]
        .filter((entry) => entry.user_id === user.uid)
        .sort((a, b) => (b.moved_at || 0) - (a.moved_at || 0))[0] || null
    );
  }, [noShows, user]);

  const activeCount = activeUsers.length;
  const serviceTime = Math.max(establishment?.service_time || 3, 1);
  const capacity = Math.max(establishment?.queue_capacity || 1, 1);
  const crowd = getCrowdLevel(activeCount / capacity);
  const insight = getCrowdInsight({
    currentCount: activeCount,
    serviceTime,
    capacity,
  });
  const usualCrowd = getUsualCrowdLevel(insight.usualHigh, capacity);

  const currentPosition = myEntry ? computePosition(users, myEntry) : null;
  const peopleAhead = currentPosition === null ? activeCount : Math.max(0, currentPosition - 1);
  const eta = peopleAhead * serviceTime;
  const isJoined = Boolean(myEntry);
  const isFirstInLine =
    Boolean(myEntry) &&
    (currentPosition === 1 ||
      myEntry?.status === "called" ||
      myEntry?.status === "serving");
  const progress = isJoined
    ? isFirstInLine
      ? 92
      : Math.max(18, Math.min(75, 100 - peopleAhead * 14))
    : 0;

  const nowServing =
    users
      .filter((entry) => entry.status === "called" || entry.status === "serving")
      .sort((a, b) => (a.ticket_number || 0) - (b.ticket_number || 0))[0]
      ?.ticket_number ||
    users
      .filter((entry) => entry.status === "waiting")
      .sort((a, b) => (a.ticket_number || 0) - (b.ticket_number || 0))[0]
      ?.ticket_number ||
    0;
  const nextTicketNumber =
    Math.max(0, ...users.map((entry) => entry.ticket_number || 0)) + 1;
  const activity = useMemo(() => buildActivity(users), [users]);
  const areStationsPaused =
    stations.length > 0 && stations.every((station) => station.status === "paused");
  const isQueuePaused = establishment?.status === "paused" || areStationsPaused;
  const isQueueClosed = establishment?.status !== "active" || isQueuePaused;
  const qrCheckInValue = myEntry?.qr_id || myEntry?.id || "";
  const completedEntry =
    myUserEntry?.status === "done" && !myUserEntry.left_at ? myUserEntry : null;
  const leftCooldownEntry = myUserEntry?.left_at ? myUserEntry : null;
  const isNoShow = Boolean(myUserEntry?.status === "no_show");
  const noShowCooldownEntry =
    myNoShowEntry &&
    myNoShowEntry.status !== "cancelled" &&
    (myNoShowEntry.expires_at || 0) > now
      ? myNoShowEntry
      : null;
  const cooldownEntry = noShowCooldownEntry || leftCooldownEntry;
  const cooldownStartedAt =
    noShowCooldownEntry?.moved_at ||
    leftCooldownEntry?.left_at ||
    Math.max(0, now - COOLDOWN_MS);
  const cooldownExpiresAt =
    noShowCooldownEntry?.expires_at || cooldownStartedAt + COOLDOWN_MS;
  const cooldownRemainingMs = Math.max(0, cooldownExpiresAt - now);
  const isCooldownActive = Boolean(cooldownEntry && cooldownRemainingMs > 0);
  const isDoneView = Boolean(completedEntry && !isCooldownActive);
  const cooldownProgress = Math.min(
    100,
    Math.max(0, ((now - cooldownStartedAt) / COOLDOWN_MS) * 100),
  );
  const totalQueueMinutes = completedEntry
    ? getMinuteDiff(completedEntry.joined_at, completedEntry.completed_at || now)
    : 0;
  const remoteWaitMinutes = completedEntry
    ? Math.max(0, getMinuteDiff(completedEntry.joined_at, completedEntry.called_at) || eta)
    : 0;
  const inBranchWaitMinutes = completedEntry
    ? Math.max(1, getMinuteDiff(completedEntry.called_at, completedEntry.completed_at) || serviceTime)
    : 0;
  const banner =
    isCooldownActive
      ? { text: "Cooldown Period Active", color: "bg-[#c90000]" }
      : isDoneView
        ? null
        : isQueuePaused
          ? { text: "This Queue is Currently Paused", color: "bg-[#fe7952]" }
          : isJoined
            ? { text: "You are in this queue", color: "bg-[#39b580]" }
            : { text: "Join the Queue Now!", color: "bg-[#858583]" };

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!id || !user || isQueueClosed) return;
    if (!name.trim()) {
      setFormError("Enter your full name.");
      return;
    }
    await join();
  };

  const join = async () => {
    setIsSaving(true);
    setFormError("");

    try {
      const counterRef = ref(db, `queues/${id}/ticket_counter`);
      let ticketNumber = nextTicketNumber;

      await runTransaction(counterRef, (current) => {
        ticketNumber = (current || 0) + 1;
        return ticketNumber;
      });

      const entryRef = push(ref(db, `queues/${id}/users`));
      const pushKey = entryRef.key;

      if (!pushKey) throw new Error("Queue entry key unavailable");

      await set(entryRef, {
        user_id: user.uid,
        qr_id: pushKey,
        name: name.trim(),
        status: "waiting",
        ticket_number: ticketNumber,
        station_id: null,
        is_priority: false,
        priority_type: "none",
        join_method: "remote",
        joined_at: Date.now(),
        called_at: null,
        completed_at: null,
        left_at: null,
        checked_in: false,
        eta: activeCount * serviceTime,
        position: activeCount + 1,
      });

      setJoinOpen(false);
      setName("");
    } catch (error) {
      console.error(error);
      setFormError("Failed to join queue. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const handleLeave = async () => {
    if (!id || !myEntry) return;

    setIsSaving(true);

    try {
      await update(ref(db, `queues/${id}/users/${myEntry.id}`), {
        status: "cancelled",
        completed_at: Date.now(),
        left_at: Date.now(),
      });
      setLeaveOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckIn = async () => {
    if (!id || !myEntry) return;

    setIsSaving(true);

    try {
      await update(ref(db, `queues/${id}/users/${myEntry.id}`), {
        checked_in: true,
      });
      setQrOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNoShowWait = async () => {
    await Promise.all([handleLeave(), join()])
  }

  if (!establishment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-[#6d7a71]">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#1b1c1c]">
      <header className="sticky top-0 z-20 border-b border-[#e3e2e2] bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex min-h-11 cursor-pointer items-center"
            aria-label="Go to home"
          >
            <img src={LOGO_SRC} alt="linea" className="h-10 w-auto" />
          </button>

          <nav className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => navigate("/dashboard")}
              className="min-h-11 cursor-pointer rounded-full px-6 py-2 text-lg font-medium text-[#1b1c1c] transition-colors hover:bg-[#f5f3f3]"
            >
              Home
            </button>
            <button
              onClick={() => navigate("/discover")}
              className="min-h-11 rounded-full bg-[#303031] px-6 py-2 text-lg font-medium text-[#f2f0f0]"
            >
              Discover
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-bold sm:inline">
              Hi, {getName(user?.email)}
            </span>
            <div className="flex size-11 items-center justify-center rounded-full bg-[#83f9be]/35 text-sm font-extrabold text-[#303031]">
              {getInitial(user?.email)}
            </div>
          </div>
        </div>
      </header>

      {banner && (
        <div
          className={`py-3 text-center text-sm font-extrabold text-white ${banner.color}`}
        >
          {banner.text}
        </div>
      )}


      {(isNoShow && isNoShowOpen) && (
        <Modal onClose={() => setIsNoShowOpen(false)}>
          <div className="text-center">
            <h2 className="mx-auto max-w-md text-4xl font-extrabold leading-tight">
              You have been declared as a no-show
            </h2>
            <p className="mx-auto mt-6 max-w-md text-2xl font-medium leading-tight text-[#858583]">
              Do you want to continue waiting?
            </p>
            <div className="mt-12 flex flex-col justify-center gap-6 sm:flex-row">
              <button
                onClick={handleNoShowWait}
                className="min-h-16 rounded-2xl border border-[#858583] px-10 text-xl font-extrabold"
              >
                Wait
              </button>
              <button
                onClick={handleLeave}
                disabled={false}
                className="min-h-16 rounded-2xl bg-[#c90000] px-12 text-xl font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#858583]"
              >
                Leave
              </button>
            </div>
          </div>
        </Modal>
      )}

      <main className="mx-auto max-w-7xl px-6 py-16">
        <button
          onClick={() => navigate("/discover")}
          className="mb-10 inline-flex min-h-11 items-center gap-3 text-2xl font-medium text-[#858583] transition-colors hover:text-[#303031]"
        >
          <ArrowLeft className="size-6" />
          All queues
        </button>

        <section className="border-y border-[#e3e2e2] py-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-extrabold">{establishment.name}</h1>
              <p className="mt-3 flex items-center gap-2 text-2xl font-medium text-[#858583]">
                <MapPin className="size-7" />
                {establishment.location}
              </p>
            </div>

            {isDoneView || isCooldownActive ? (
              <button
                disabled
                className="min-h-16 cursor-not-allowed rounded-2xl bg-[#e7e7e5] px-12 text-xl font-extrabold text-[#858583]"
              >
                Leave queue
              </button>
            ) : isJoined ? (
              <button
                onClick={() => setLeaveOpen(true)}
                className="min-h-16 rounded-2xl bg-[#c90000] px-12 text-xl font-extrabold text-white transition-colors hover:bg-[#a80000]"
              >
                Leave queue
              </button>
            ) : (
              <button
                disabled={isQueueClosed}
                onClick={() => setJoinOpen(true)}
                className={`min-h-16 rounded-2xl px-12 text-xl font-extrabold text-white transition-colors ${
                  isQueueClosed
                    ? "cursor-not-allowed bg-[#858583]"
                    : "bg-[#39b580] hover:bg-[#006c47]"
                }`}
              >
                {isQueueClosed ? "Join queue" : "Join queue"}
              </button>
            )}
          </div>
        </section>

        {isCooldownActive ? (
          <section className="mt-12">
            <p className="text-lg font-medium uppercase">Live preview</p>
            <h2 className="mt-4 text-3xl font-extrabold">
              Your queue at a glance
            </h2>

            <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_520px]">
              <article className="rounded-2xl border border-[#bccabf] bg-white p-10 text-center shadow-[0_14px_45px_rgba(0,0,0,0.08)]">
                <div className="mx-auto flex w-fit items-end justify-center text-[#c90000]">
                  <LockKeyhole className="size-24" strokeWidth={2.3} />
                  <Clock3 className="-ml-7 size-12 rounded-full bg-white fill-white" />
                </div>

                <h3 className="mt-8 text-4xl font-extrabold">
                  Cooldown Period Active
                </h3>
                <p className="mt-7 text-2xl font-medium text-[#858583]">
                  {noShowCooldownEntry
                    ? `You missed your turn at ${establishment.name}`
                    : `You left the queue at ${establishment.name}`}
                </p>

                <div className="mx-auto mt-12 max-w-2xl rounded-3xl bg-[#f8e4e4] px-8 py-8">
                  <p className="text-xl font-medium uppercase">
                    Estimated time remaining
                  </p>
                  <p className="mt-4 text-7xl font-extrabold leading-none text-[#c90000]">
                    {formatCountdown(cooldownRemainingMs)}
                  </p>
                </div>

                <div className="mx-auto mt-14 max-w-2xl">
                  <div className="h-1.5 rounded-full bg-[#e7e7e5]">
                    <div
                      className="h-1.5 rounded-full bg-[#c90000]"
                      style={{ width: `${cooldownProgress}%` }}
                    />
                  </div>
                  <div className="mt-7 flex items-center justify-between text-2xl font-medium text-[#858583]">
                    <span>
                      Started {formatElapsed(cooldownStartedAt)}
                    </span>
                    <span>20 mins total</span>
                  </div>
                </div>
              </article>

              <aside className="rounded-2xl border border-[#bccabf] bg-white p-10 shadow-[0_14px_45px_rgba(0,0,0,0.08)]">
                <h3 className="text-3xl font-extrabold">
                  Access Restricted Policy
                </h3>

                <div className="mt-10 space-y-10">
                  <div className="flex gap-6">
                    <ShieldCheck className="mt-1 size-10 shrink-0 text-[#c90000]" />
                    <div>
                      <h4 className="text-lg font-extrabold">
                        Security Protection
                      </h4>
                      <p className="mt-2 text-base leading-tight">
                        To protect your digital queue position and identity, our
                        system automatically triggers a cooldown after
                        unsuccessful interactions.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-6">
                    <Clock3 className="mt-1 size-10 shrink-0 text-[#c90000]" />
                    <div>
                      <h4 className="text-lg font-extrabold">
                        Mandatory Wait Time
                      </h4>
                      <p className="mt-2 text-base leading-tight">
                        Cooldown periods cannot be manually bypassed by support
                        staff to preserve queue integrity.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-6">
                    <Info className="mt-1 size-10 shrink-0 text-[#c90000]" />
                    <div>
                      <h4 className="text-lg font-extrabold">
                        What happens next?
                      </h4>
                      <p className="mt-2 text-base leading-tight">
                        Once the timer hits zero, access restores automatically.
                        You may join the queue again.
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        ) : isDoneView && completedEntry ? (
          <section className="mt-12">
            <p className="text-lg font-medium uppercase">Live preview</p>
            <h2 className="mt-4 text-3xl font-extrabold">
              Your queue at a glance
            </h2>

            <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_390px]">
              <article className="rounded-2xl border border-[#bccabf] bg-white p-10 shadow-[0_14px_45px_rgba(0,0,0,0.08)]">
                <div className="text-center">
                  <p className="text-xl font-extrabold text-[#39b580]">
                    Service Completed
                  </p>
                  <h3 className="mt-4 text-4xl font-extrabold">
                    You have been served!
                  </h3>
                </div>

                <div className="mt-16">
                  <div className="flex items-center justify-between gap-5">
                    <p className="text-lg font-medium">Queue Progress</p>
                    <p className="text-lg font-extrabold">Completed</p>
                  </div>
                  <div className="mt-3 h-3 rounded-full bg-[#39b580]" />
                  <div className="mt-2 grid grid-cols-3 text-sm font-medium text-[#858583]">
                    <span>Check in</span>
                    <span className="text-center">Waiting</span>
                    <span className="text-right">Service</span>
                  </div>
                </div>

                <div className="mt-16 grid gap-8 md:grid-cols-4">
                  <div>
                    <p className="text-xl font-medium text-[#858583]">Date</p>
                    <p className="mt-2 text-2xl font-extrabold">
                      {formatDate(completedEntry.completed_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xl font-medium text-[#858583]">
                      Total Queue Time
                    </p>
                    <p className="mt-2 text-2xl font-extrabold">
                      {formatDuration(totalQueueMinutes)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xl font-medium text-[#858583]">
                      Remote Wait
                    </p>
                    <p className="mt-2 text-2xl font-extrabold">
                      {formatDuration(remoteWaitMinutes)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xl font-medium text-[#858583]">
                      In-branch Wait
                    </p>
                    <p className="mt-2 text-2xl font-extrabold">
                      {formatDuration(inBranchWaitMinutes)}
                    </p>
                  </div>
                </div>
              </article>

              <div className="space-y-5">
                <aside className="rounded-2xl border border-[#bccabf] bg-white p-7 shadow-[0_14px_45px_rgba(0,0,0,0.08)]">
                  <h3 className="text-xl font-extrabold">Queue Details</h3>
                  <div className="mt-6 space-y-5 text-xl">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[#858583]">Crowd Now</span>
                      <span
                        className={`rounded-full border px-5 py-1 text-sm font-medium ${crowd.badge}`}
                      >
                        {crowd.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[#858583]">Usual Crowd</span>
                      <span
                        className={`rounded-full border px-5 py-1 text-sm font-medium ${usualCrowd.badge}`}
                      >
                        {usualCrowd.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[#858583]">Best time</span>
                      <span className="font-extrabold">{insight.bestTime}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[#858583]">Cut-off time</span>
                      <span className="font-extrabold text-[#fe7952]">
                        5:00 PM
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[#858583]">Cooldown</span>
                      <span className="font-extrabold">20 mins</span>
                    </div>
                  </div>
                </aside>

                <button
                  disabled
                  className="min-h-16 w-full rounded-2xl bg-[#39b580] text-xl font-extrabold text-white"
                >
                  {completedEntry.checked_in ? "Checked-in" : "Completed"}
                </button>
              </div>
            </div>

            <div className="mt-9 flex max-w-4xl items-start gap-5 rounded-2xl bg-[#fe7952] px-8 py-5 text-white">
              <Lightbulb className="mt-1 size-7 shrink-0" />
              <div>
                <p className="text-xl font-extrabold">Smart Scheduler Tip</p>
                <p className="mt-1 max-w-xl text-sm leading-5">
                  You saved time by joining remotely. Based on your history,
                  weekday mornings are usually faster for this branch.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
        <section className="mt-12">
          <p className="text-lg font-medium uppercase">Live preview</p>
          <h2 className="mt-4 text-3xl font-extrabold">
            {isJoined ? "Your queue at a glance" : "The queue at a glance"}
          </h2>

          <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_390px]">
            <article className="rounded-2xl border border-[#bccabf] bg-white p-8 shadow-[0_14px_45px_rgba(0,0,0,0.08)]">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xl font-medium uppercase">
                    {isJoined ? "Your number" : "Now serving"}
                  </p>
                  <p
                    className={`mt-3 text-[96px] font-extrabold leading-none ${
                      isJoined ? "text-[#39b580]" : "text-black"
                    }`}
                  >
                    {isJoined ? myEntry?.ticket_number || nextTicketNumber : nowServing}
                  </p>
                </div>

                <span className="inline-flex items-center gap-2 rounded-full border border-[#39b580] bg-[#83f9be]/35 px-4 py-1 text-sm font-extrabold text-[#006c47]">
                  <span className="size-2 rounded-full bg-[#39b580]" />
                  Live
                </span>
              </div>

              {isJoined && (
                <div className="mt-2">
                  <div className="flex items-center justify-between gap-5">
                    <p className="text-lg font-medium">Queue Progress</p>
                    {isFirstInLine ? (
                      <p className="text-lg font-extrabold text-[#fe7952]">
                        Scan QR to Confirm Arrival
                      </p>
                    ) : (
                      <p className="text-lg font-extrabold">
                        {Math.round(progress)}% Complete
                      </p>
                    )}
                  </div>
                  <div className="mt-3 h-3 rounded-full bg-[#f2f0f0]">
                    <div
                      className="h-3 rounded-full bg-[#fe7952]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-3 text-sm font-bold">
                    <span className={myEntry?.checked_in ? "text-[#39b580]" : "text-[#858583]"}>
                      Check in
                    </span>
                    <span className="text-center text-[#fe7952]">Waiting</span>
                    <span className="text-right text-[#858583]">Service</span>
                  </div>
                </div>
              )}

              {isFirstInLine && (
                <div className="mt-6 text-center">
                  <p className="text-3xl font-extrabold">You're now first in line</p>
                </div>
              )}

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-[#39b580] p-5 text-white">
                  <p className="text-lg font-medium">
                    {isJoined ? "Now serving" : "Your number"}
                  </p>
                  <p className="mt-2 text-4xl font-extrabold">
                    {isJoined ? nowServing : nextTicketNumber}
                  </p>
                  {!isJoined && (
                    <p className="text-sm font-bold uppercase">(when you join)</p>
                  )}
                </div>
                <div className="rounded-2xl bg-[#eaf7f2] p-5">
                  <p className="text-lg font-medium">People ahead</p>
                  <p className="mt-4 text-4xl font-extrabold">{peopleAhead}</p>
                </div>
                <div className="rounded-2xl bg-[#eaf7f2] p-5">
                  <p className="text-lg font-medium">ETA</p>
                  <p className="mt-4 text-4xl font-extrabold">
                    {formatWait(eta)}
                  </p>
                </div>
              </div>
            </article>

            <div className="space-y-5">
              {isQueuePaused && !isJoined && (
                <p className="px-4 text-center text-lg leading-tight">
                  <span className="font-extrabold">NOTE:</span> You cannot join
                  right now because the admin paused the queue
                </p>
              )}

              <aside className="rounded-2xl border border-[#bccabf] bg-white p-7 shadow-[0_14px_45px_rgba(0,0,0,0.08)]">
                <h3 className="text-xl font-extrabold">Queue Details</h3>
                <div className="mt-6 space-y-5 text-xl">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#858583]">Crowd Now</span>
                    <span
                      className={`rounded-full border px-5 py-1 text-sm font-medium ${crowd.badge}`}
                    >
                      {crowd.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#858583]">Usual Crowd</span>
                    <span
                      className={`rounded-full border px-5 py-1 text-sm font-medium ${usualCrowd.badge}`}
                    >
                      {usualCrowd.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#858583]">Best time</span>
                    <span className="font-extrabold">{insight.bestTime}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#858583]">Cut-off time</span>
                    <span className="font-extrabold text-[#fe7952]">5:00 PM</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#858583]">Cooldown</span>
                    <span className="font-extrabold">20 mins</span>
                  </div>
                </div>
              </aside>

              {isJoined && (
                <button
                  onClick={() => setQrOpen(true)}
                  className="min-h-16 w-full rounded-2xl border border-[#bccabf] bg-[#e7e7e5] text-xl font-extrabold transition-colors hover:bg-[#d8d8d6]"
                >
                  QR Check-in
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-[#bccabf] bg-white p-9 shadow-[0_14px_45px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-extrabold">Live Activity</h3>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#39b580] bg-[#83f9be]/35 px-4 py-1 text-sm font-extrabold text-[#006c47]">
              <span className="size-2 rounded-full bg-[#39b580]" />
              Streaming
            </span>
          </div>

          {activity.length === 0 ? (
            <p className="mt-8 text-lg font-medium text-[#858583]">
              No completed activity yet.
            </p>
          ) : (
            <div className="mt-8 divide-y divide-[#e3e2e2]">
              {activity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-6 py-4 text-xl"
                >
                  <p className="flex items-center gap-5">
                    <span className={`size-3 rounded-full ${item.dot}`} />
                    {item.label}
                  </p>
                  <span className="text-[#858583]">{item.time}</span>
                </div>
              ))}
            </div>
          )}
        </section>
          </>
        )}
      </main>

      <footer className="mt-20 border-t border-[#e3e2e2] bg-[#fbf9f9]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-6 py-16 md:flex-row md:items-end">
          <div>
            <img src={LOGO_SRC} alt="linea" className="h-12 w-auto" />
            <p className="mt-8 max-w-xl text-xl font-medium leading-7 text-[#6d7a71]">
              The queue that waits for you. Built with care by Clawed Code.
            </p>
          </div>
          <p className="text-xl font-extrabold text-[#6d7a71]">
            &copy; 2026 Clawed Code
          </p>
        </div>
      </footer>

      {joinOpen && (
        <Modal onClose={() => setJoinOpen(false)}>
          <form onSubmit={handleJoin} className="text-center">
            <h2 className="text-4xl font-extrabold">Join Queue</h2>
            <label
              htmlFor="join-name"
              className="mt-10 block text-2xl font-medium text-[#858583]"
            >
              Full Name
            </label>
            <input
              id="join-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              className="mx-auto mt-5 block h-16 w-full max-w-sm rounded-2xl border border-[#858583] px-5 text-center text-2xl font-medium outline-none placeholder:text-[#d8d8d6] focus:border-[#006c47]"
            />
            {formError && (
              <p className="mt-4 text-sm font-bold text-[#c90000]">{formError}</p>
            )}
            <button
              disabled={isSaving}
              className="mt-10 min-h-16 rounded-2xl bg-[#39b580] px-14 text-xl font-extrabold text-white transition-colors hover:bg-[#006c47] disabled:cursor-not-allowed disabled:bg-[#858583]"
            >
              {isSaving ? "Joining..." : "Join queue"}
            </button>
          </form>
        </Modal>
      )}

      {leaveOpen && (
        <Modal onClose={() => setLeaveOpen(false)}>
          <div className="text-center">
            <h2 className="mx-auto max-w-md text-4xl font-extrabold leading-tight">
              Are you sure you wanna leave the queue?
            </h2>
            <p className="mx-auto mt-6 max-w-md text-2xl font-medium leading-tight text-[#858583]">
              You will not be able to join after 20 mins cooldown.
            </p>
            <div className="mt-12 flex flex-col justify-center gap-6 sm:flex-row">
              <button
                onClick={() => setLeaveOpen(false)}
                className="min-h-16 rounded-2xl border border-[#858583] px-10 text-xl font-extrabold"
              >
                Cancel
              </button>
              <button
                onClick={handleLeave}
                disabled={isSaving}
                className="min-h-16 rounded-2xl bg-[#c90000] px-12 text-xl font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#858583]"
              >
                {isSaving ? "Leaving..." : "Leave queue"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {qrOpen && (
        <Modal onClose={() => setQrOpen(false)} maxWidth="max-w-lg">
          <div className="text-center">
            <h2 className="text-4xl font-extrabold">QR Check-in</h2>
            <p className="mx-auto mt-6 max-w-sm text-2xl font-medium leading-tight text-[#858583]">
              Scan the QR code provided by the queue admin.
            </p>

            <div className="mx-auto mt-9 flex aspect-square max-w-sm items-center justify-center rounded-[32px] border-[3px] border-[#1b1c1c] p-4">
              <div className="flex h-full w-full items-center justify-center rounded-[24px] border-[3px] border-[#83f9be]">
                <div className="flex h-1/2 w-full items-center justify-center border-y-2 border-[#39b580]">
                  {qrCheckInValue ? (
                    <QRCodeSVG
                      value={qrCheckInValue}
                      size={136}
                      bgColor="transparent"
                      fgColor="#3d4a42"
                      level="M"
                      marginSize={1}
                    />
                  ) : (
                    <span className="text-sm font-bold text-[#858583]">
                      QR unavailable
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckIn}
              disabled={isSaving}
              className="mt-10 min-h-16 w-full max-w-sm rounded-2xl border border-[#858583] bg-[#e7e7e5] text-xl font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Verifying..." : "Verify Check-in"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
