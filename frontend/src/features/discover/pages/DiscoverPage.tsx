import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { Clock3, LogOut, MapPin, Search, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { logout } from "@/lib/auth";
import { useAuth } from "@/features/auth";

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

type QueueStats = {
  waiting: number;
  served: number;
};

const LOGO_SRC = "/linea/linea-logo.png";

const STATUS_ORDER = {
  active: 0,
  paused: 1,
  closed: 2,
};

function getName(email?: string | null) {
  if (!email) return "Guest";
  return email.split("@")[0].replace(/[._-]+/g, " ");
}

function getInitial(email?: string | null) {
  return (email?.[0] || "L").toUpperCase();
}

function getStatusBadge(status: Establishment["status"]) {
  if (status === "paused") {
    return {
      label: "Paused",
      color: "border-[#fe7952] bg-[#ffdbd1] text-[#862201]",
    };
  }

  if (status === "closed") {
    return {
      label: "Closed",
      color: "border-[#ba1a1a] bg-[#ffdad6] text-[#93000a]",
    };
  }

  return {
    label: "Open",
    color: "border-[#39b580] bg-[#39b580] text-white",
  };
}

function getCrowdLevel(score: number) {
  if (score >= 0.7) {
    return {
      label: "High Crowd",
      color: "border-[#fe7952] bg-[#ffdbd1] text-[#862201]",
      dot: "bg-[#fe7952]",
    };
  }

  if (score >= 0.3) {
    return {
      label: "Moderate Crowd",
      color: "border-[#cb9900] bg-[#ffdf9e] text-[#5b4300]",
      dot: "bg-[#cb9900]",
    };
  }

  return {
    label: "Low Crowd",
    color: "border-[#39b580] bg-[#83f9be]/35 text-[#006c47]",
    dot: "bg-[#39b580]",
  };
}

function formatWait(minutes: number) {
  if (minutes <= 0) return "0min";
  return `~${minutes}min`;
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [queueStats, setQueueStats] = useState<Record<string, QueueStats>>({});

  useEffect(() => {
    const unsub = onValue(ref(db, "establishments"), (snapshot) => {
      if (!snapshot.exists()) {
        setEstablishments([]);
        setQueueStats({});
        return;
      }

      setEstablishments(Object.values(snapshot.val()) as Establishment[]);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (establishments.length === 0) return;

    const unsubs = establishments.map((est) =>
      onValue(ref(db, `queues/${est.id}/users`), (snapshot) => {
        let waiting = 0;
        let served = 0;

        if (snapshot.exists()) {
          const users = Object.values(snapshot.val()) as QueueEntry[];
          waiting = users.filter(
            (u) =>
              u.status === "waiting" ||
              u.status === "called" ||
              u.status === "serving"
          ).length;
          served = users.filter((u) => u.status === "done").length;
        }

        setQueueStats((prev) => ({ ...prev, [est.id]: { waiting, served } }));
      })
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [establishments]);

  const queues = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return establishments
      .map((est) => {
        const stats = queueStats[est.id] || { waiting: 0, served: 0 };
        const capacity = Math.max(est.queue_capacity || 1, 1);
        const serviceTime = Math.max(est.service_time || 3, 1);
        const score = Math.min(stats.waiting / capacity, 1);

        return {
          ...est,
          stats,
          eta: stats.waiting * serviceTime,
          crowd: getCrowdLevel(score),
          statusBadge: getStatusBadge(est.status),
        };
      })
      .filter((est) => {
        if (!normalizedQuery) return true;
        return `${est.name} ${est.location}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (statusDiff !== 0) return statusDiff;
        return a.eta - b.eta;
      });
  }, [establishments, queueStats, query]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error(err);
    }
  };

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
            <button className="min-h-11 rounded-full bg-[#303031] px-6 py-2 text-lg font-medium text-[#f2f0f0]">
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
            <button
              onClick={handleLogout}
              className="flex size-11 cursor-pointer items-center justify-center rounded-xl border border-[#bccabf] bg-white text-[#303031] transition-colors hover:bg-[#f5f3f3]"
              aria-label="Logout"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-20rem)] max-w-7xl px-6 py-24">
        <section className="mb-16 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <h1 className="text-5xl font-extrabold leading-none md:text-6xl">
              Find a queue
            </h1>
            <p className="mt-5 text-2xl font-medium text-[#1b1c1c]">
              Check crowd levels before you go.
            </p>
          </div>

          <div className="relative">
            <label htmlFor="discover-search" className="sr-only">
              Search queues
            </label>
            <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[#6d7a71]" />
            <input
              id="discover-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search banks, stores, offices..."
              className="h-14 w-full rounded-2xl border border-[#bccabf] bg-white pl-14 pr-5 text-base font-medium text-[#1b1c1c] outline-none transition-colors placeholder:text-[#6d7a71] focus:border-[#006c47]"
            />
          </div>
        </section>

        {queues.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#bccabf] bg-[#fbf9f9] p-10 text-center">
            <p className="text-xl font-extrabold">No queues found</p>
            <p className="mt-2 text-sm font-medium text-[#6d7a71]">
              Try another search or check back when a business opens.
            </p>
          </div>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {queues.map((queue) => {
              const disabled = queue.status !== "active";

              return (
                <article
                  key={queue.id}
                  className="rounded-2xl border border-[#bccabf] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-extrabold">
                        {queue.name}
                      </h2>
                      <p className="mt-4 flex items-center gap-2 text-base font-medium text-[#6d7a71]">
                        <MapPin className="size-5" />
                        {queue.location}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-5 py-1 text-sm font-bold ${queue.statusBadge.color}`}
                    >
                      {queue.statusBadge.label}
                    </span>
                  </div>

                  <div className="mt-7 flex items-end justify-between gap-5">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-base font-extrabold ${queue.crowd.color}`}
                    >
                      <span className={`size-2 rounded-full ${queue.crowd.dot}`} />
                      {queue.crowd.label}
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#6d7a71]">ETA</p>
                      <p className="text-2xl font-extrabold text-[#fe7952]">
                        {formatWait(queue.eta)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 border-t border-[#e3e2e2] pt-5">
                    <div className="flex items-center gap-12">
                      <p className="flex items-center gap-2 text-base font-medium text-[#6d7a71]">
                        <Clock3 className="size-5 text-[#1b1c1c]" />
                        <span className="font-extrabold text-[#1b1c1c]">
                          {queue.stats.waiting}
                        </span>
                        waiting
                      </p>
                      <p className="flex items-center gap-2 text-base font-medium text-[#6d7a71]">
                        <Users className="size-5 text-[#1b1c1c]" />
                        <span className="font-extrabold text-[#1b1c1c]">
                          {queue.stats.served}
                        </span>
                        served
                      </p>
                    </div>
                  </div>

                  <button
                    disabled={disabled}
                    onClick={() => navigate(`/queue/${queue.id}`)}
                    className={`mt-7 flex min-h-16 w-full items-center justify-center rounded-2xl text-xl font-extrabold transition-colors ${
                      disabled
                        ? "cursor-not-allowed bg-[#6d7a71] text-white"
                        : "cursor-pointer bg-[#303031] text-white hover:bg-[#1b1c1c]"
                    }`}
                  >
                    {disabled ? "Queue unavailable" : "View queue"}
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </main>

      <footer className="border-t border-[#e3e2e2] bg-[#fbf9f9]">
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
    </div>
  );
}
