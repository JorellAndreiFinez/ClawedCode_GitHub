import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { ArrowRight, LogOut, MapPin } from "lucide-react";
import { db } from "@/lib/firebase";
import { logout } from "@/lib/auth";
import { useAuth } from "@/features/auth";
import { getCrowdInsight, type CrowdTrend } from "@/lib/crowdInsight";
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

const ASSETS = {
  logo: "/linea/linea-logo.png",
  hero: "/linea/hero-image.png",
  steps: [
    "/linea/skip-line-1.png",
    "/linea/skip-line-2.png",
    "/linea/skip-line-3.png",
    "/linea/skip-line-4.png",
  ],
};

const STEPS = [
  {
    eyebrow: "Step 1",
    title: "Find a queue",
    body: "Browse nearby stores, banks, and counters with live crowd levels.",
  },
  {
    eyebrow: "Step 2",
    title: "Tap to join",
    body: "Receive your number remotely. No paper tickets, no standing.",
  },
  {
    eyebrow: "Step 3",
    title: "Wait remotely",
    body: "Track your spot live and head over when the timing looks right.",
  },
  {
    eyebrow: "Step 4",
    title: "Show up & scan",
    body: "Confirm arrival on-site when your turn is close.",
  },
];

const STATUS_ORDER = {
  active: 0,
  paused: 1,
  closed: 2,
};

function getCrowdLevel(score: number) {
  if (score >= 0.7) {
    return {
      label: "High",
      shortLabel: "High load",
      bar: "bg-[#fe7952]",
      badge: "border-[#fe7952] bg-[#ffdbd1] text-[#862201]",
      text: "text-[#a73a18]",
    };
  }

  if (score >= 0.3) {
    return {
      label: "Moderate",
      shortLabel: "Moderate load",
      bar: "bg-[#cb9900]",
      badge: "border-[#cb9900] bg-[#ffdf9e] text-[#5b4300]",
      text: "text-[#785900]",
    };
  }

  return {
    label: "Low",
    shortLabel: "Low load",
    bar: "bg-[#39b580]",
    badge: "border-[#39b580] bg-[#83f9be]/35 text-[#004029]",
    text: "text-[#006c47]",
  };
}

function getInsightStyle(trend: CrowdTrend) {
  if (trend === "surge") {
    return {
      dot: "bg-[#fe7952]",
      badge: "border-[#fe7952] bg-[#ffdbd1] text-[#862201]",
      text: "text-[#a73a18]",
    };
  }

  if (trend === "low") {
    return {
      dot: "bg-[#39b580]",
      badge: "border-[#39b580] bg-[#83f9be]/35 text-[#004029]",
      text: "text-[#006c47]",
    };
  }

  return {
    dot: "bg-[#bccabf]",
    badge: "border-[#bccabf] bg-[#f5f3f3] text-[#303031]",
    text: "text-[#303031]",
  };
}

function getStatusBadge(status: string) {
  if (status === "paused") {
    return {
      label: "Paused",
      color: "border-[#fe7952] bg-[#ffdbd1] text-[#862201]",
      dot: "bg-[#fe7952]",
    };
  }

  if (status === "closed") {
    return {
      label: "Closed",
      color: "border-[#ba1a1a] bg-[#ffdad6] text-[#93000a]",
      dot: "bg-[#ba1a1a]",
    };
  }

  return {
    label: "Live",
    color: "border-[#39b580] bg-[#83f9be]/35 text-[#004029]",
    dot: "bg-[#39b580]",
  };
}

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

export default function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = onValue(ref(db, "establishments"), (snapshot) => {
      if (!snapshot.exists()) {
        setEstablishments([]);
        setQueueCounts({});
        return;
      }

      const list = Object.values(snapshot.val()) as Establishment[];
      setEstablishments(list);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (establishments.length === 0) {
      return;
    }

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

  const queueCards = useMemo(() => {
    return establishments.map((est) => {
      const queueLength = queueCounts[est.id] ?? 0;
      const capacity = Math.max(est.queue_capacity || 1, 1);
      const serviceTime = Math.max(est.service_time || 3, 1);
      const score = Math.min(queueLength / capacity, 1);
      const crowd = getCrowdLevel(score);
      const statusBadge = getStatusBadge(est.status);
      const eta = queueLength * serviceTime;
      const insight = getCrowdInsight({
        currentCount: queueLength,
        serviceTime,
        capacity,
      });

      return {
        ...est,
        capacity,
        serviceTime,
        queueLength,
        score,
        crowd,
        statusBadge,
        eta,
        insight,
        isDisabled: est.status !== "active",
      };
    });
  }, [establishments, queueCounts]);

  const orderedQueues = useMemo(() => {
    return [...queueCards].sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.eta - b.eta;
    });
  }, [queueCards]);

  const bestQueue = orderedQueues.find((est) => est.status === "active");
  const totalWaiting = queueCards.reduce(
    (sum, queue) => sum + queue.queueLength,
    0
  );
  const liveQueueCount = queueCards.filter(
    (queue) => queue.status === "active"
  ).length;
  const totalCapacity = queueCards.reduce(
    (sum, queue) => sum + queue.capacity,
    0
  );
  const overallCrowd = getCrowdLevel(
    totalCapacity > 0 ? totalWaiting / totalCapacity : 0
  );
  const previewInsight =
    bestQueue?.insight ||
    getCrowdInsight({
      currentCount: totalWaiting,
      capacity: totalCapacity || 50,
    });
  const previewStyle = getInsightStyle(previewInsight.trend);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error(err);
    }
  };

  const scrollToPreview = () => {
    document
      .getElementById("live-preview")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#fbf9f9] text-[#1b1c1c]">
      <header className="sticky top-0 z-20 border-b border-[#e3e2e2] bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex min-h-11 cursor-pointer items-center"
            aria-label="Go to home"
          >
            <img src={ASSETS.logo} alt="linea" className="h-10 w-auto" />
          </button>

          <nav className="hidden items-center gap-2 md:flex">
            <button className="min-h-11 rounded-full bg-[#303031] px-6 py-2 text-sm font-bold text-[#f2f0f0]">
              Home
            </button>
            <button
              onClick={() => navigate("/discover")}
              className="min-h-11 cursor-pointer rounded-full px-6 py-2 text-sm font-bold text-[#3d4a42] transition-colors hover:bg-[#f5f3f3]"
            >
              Discover
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-bold sm:inline">
              Hi, {getName(user?.email)}
            </span>
            <div className="flex size-11 items-center justify-center rounded-full bg-[#f5f3f3] text-sm font-extrabold text-[#303031]">
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

      <main>
        <section className="border-b border-[#e3e2e2] bg-[linear-gradient(112deg,#ffffff_0%,#ffffff_48%,#f5f3f3_100%)]">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-[1fr_0.95fr] lg:py-20">
            <div>
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#39b580] bg-[#83f9be]/25 px-5 py-2 text-sm font-extrabold text-[#006c47]">
                <span className="size-2.5 rounded-full bg-[#39b580]" />
                The line starts here
              </div>

              <h1 className="max-w-2xl text-5xl font-extrabold leading-none md:text-[84px]">
                The queue that{" "}
                <span className="text-[#fe7952]">waits</span> for you
              </h1>

              <p className="mt-7 max-w-xl text-lg font-medium leading-7 text-[#303031]">
                Join remotely. Track live. Get called when it is your turn. No
                more standing around.
              </p>

              <p className="mt-7 text-2xl font-extrabold">
                <span className="text-[#fe7952]">Join.</span>{" "}
                <span className="text-[#39b580]">Wait.</span>{" "}
                <span>Show up.</span>
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => navigate("/discover")}
                  className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#39b580] px-8 text-base font-extrabold text-white transition-colors hover:bg-[#006c47]"
                >
                  Find a Queue Near You
                  <ArrowRight className="size-5" />
                </button>
                <button
                  onClick={scrollToPreview}
                  className="inline-flex min-h-14 cursor-pointer items-center justify-center rounded-xl border border-[#bccabf] bg-white px-8 text-base font-extrabold text-[#1b1c1c] transition-colors hover:bg-[#f5f3f3]"
                >
                  View Live Preview
                </button>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <img
                src={ASSETS.hero}
                alt="Live queue number, QR scan, and mobile ticket preview"
                className="w-full max-w-[560px] object-contain"
              />
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-[#39b580] bg-[#83f9be]/25 px-5 py-2 text-sm font-extrabold text-[#006c47]">
                <span className="size-2.5 rounded-full bg-[#39b580]" />
                How to use linea
              </div>
              <h2 className="mx-auto mt-8 max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
                Skip the line in{" "}
                <span className="text-[#fe7952]">four</span>{" "}
                <span className="text-[#39b580]">easy steps</span>
              </h2>
            </div>

            <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <article
                  key={step.title}
                  className="relative rounded-2xl border border-[#e3e2e2] bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
                >
                  <div className="absolute -top-4 left-6 flex size-8 items-center justify-center rounded-full bg-[#1b1c1c] text-sm font-extrabold text-white">
                    {index + 1}
                  </div>
                  <img
                    src={ASSETS.steps[index]}
                    alt=""
                    className="h-28 w-full rounded-xl bg-[#83f9be]/20 object-contain"
                    loading="lazy"
                  />
                  <p className="mt-5 text-xs font-extrabold uppercase text-[#006c47]">
                    {step.eyebrow}
                  </p>
                  <h3 className="mt-2 text-xl font-extrabold">{step.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-5 text-[#3d4a42]">
                    {step.body}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-14 text-center">
              <button
                onClick={() => navigate("/discover")}
                className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#39b580] px-8 text-base font-extrabold text-white transition-colors hover:bg-[#006c47]"
              >
                Find a Queue Near You
                <ArrowRight className="size-5" />
              </button>
            </div>
          </div>
        </section>

        <section
          id="live-preview"
          className="border-y border-[#e3e2e2] bg-[#f5f3f3] py-20"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase text-[#6d7a71]">
                  Live preview
                </p>
                <h2 className="mt-3 text-3xl font-extrabold md:text-4xl">
                  Queue at a glance
                </h2>
              </div>
              <button
                disabled={!bestQueue}
                onClick={() => bestQueue && navigate(`/queue/${bestQueue.id}`)}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold text-[#6d7a71] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Open full view
                <ArrowRight className="size-4" />
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_0.48fr]">
              <article className="rounded-2xl border border-[#e3e2e2] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-extrabold uppercase text-[#303031]">
                      {bestQueue ? "Best option now" : "Waiting now"}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm font-bold text-[#6d7a71]">
                      <MapPin className="size-4" />
                      {bestQueue
                        ? `${bestQueue.name} - ${bestQueue.location}`
                        : "No live queue selected"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold ${bestQueue?.statusBadge.color || "border-[#bccabf] bg-white text-[#303031]"}`}
                  >
                    <span
                      className={`size-2 rounded-full ${bestQueue?.statusBadge.dot || "bg-[#bccabf]"}`}
                    />
                    {bestQueue ? bestQueue.statusBadge.label : "Idle"}
                  </span>
                </div>

                <div className="mt-8">
                  <p className="text-[84px] font-extrabold leading-none text-[#1b1c1c]">
                    {bestQueue?.queueLength ?? totalWaiting}
                  </p>
                  <p className="mt-2 text-sm font-extrabold uppercase text-[#6d7a71]">
                    People waiting
                  </p>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-[#39b580] p-5 text-white">
                    <p className="text-xs font-extrabold uppercase">
                      Fastest queue
                    </p>
                    <p className="mt-2 text-xl font-extrabold">
                      {bestQueue?.name || "No queue"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f5f3f3] p-5">
                    <p className="text-xs font-extrabold uppercase text-[#6d7a71]">
                      Live queues
                    </p>
                    <p className="mt-2 text-3xl font-extrabold">
                      {liveQueueCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f5f3f3] p-5">
                    <p className="text-xs font-extrabold uppercase text-[#6d7a71]">
                      ETA
                    </p>
                    <p className="mt-2 text-3xl font-extrabold">
                      {formatWait(bestQueue?.eta ?? 0)}
                    </p>
                  </div>
                </div>
              </article>

              <div className="space-y-5">
                <article className="rounded-2xl border border-[#e3e2e2] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                  <h3 className="text-lg font-extrabold">
                    Crowd intelligence
                  </h3>

                  <div className="mt-5 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-bold text-[#6d7a71]">
                        Now
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-extrabold ${bestQueue?.crowd.badge || overallCrowd.badge}`}
                      >
                        {bestQueue?.crowd.shortLabel || overallCrowd.shortLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-bold text-[#6d7a71]">
                        Usually
                      </span>
                      <span className="text-right text-sm font-extrabold text-[#1b1c1c]">
                        {previewInsight.usualLow}-{previewInsight.usualHigh}{" "}
                        people
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-bold text-[#6d7a71]">
                        Compared
                      </span>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold ${previewStyle.badge}`}
                      >
                        <span
                          className={`size-2 rounded-full ${previewStyle.dot}`}
                        />
                        {previewInsight.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-[#e3e2e2] pt-4">
                      <span className="text-sm font-bold text-[#6d7a71]">
                        Best time
                      </span>
                      <span className="text-base font-extrabold">
                        {previewInsight.bestTime}
                      </span>
                    </div>
                  </div>
                </article>

                <WeatherBanner />
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-[#e3e2e2] bg-[#fbf9f9]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-6 py-12 md:flex-row md:items-end">
          <div>
            <img src={ASSETS.logo} alt="linea" className="h-11 w-auto" />
            <p className="mt-6 max-w-md text-base font-medium leading-6 text-[#6d7a71]">
              The queue that waits for you. Built with care by Clawed Code.
            </p>
          </div>
          <p className="text-base font-extrabold text-[#6d7a71]">
            &copy; 2026 Clawed Code
          </p>
        </div>
      </footer>
    </div>
  );
}
