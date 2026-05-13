import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  AlertTriangle,
  Clock3,
  MapPin,
  TrendingDown,
  TrendingUp,
  Users,
  Wifi,
  TimerReset,
  CheckCircle2,
} from "lucide-react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { motion } from "framer-motion";

import { useAdminAnalytics } from "./useAdminAnalytics";
import { apiFetch } from "@/lib/api";

const LOGO_SRC = "/linea/linea-logo.png";

const crowdStyles: Record<
  string,
  {
    label: string;
    chip: string;
    dot: string;
  }
> = {
  low: {
    label: "Low Crowd",
    chip: "border-[#39b580] bg-[#83f9be]/35 text-[#006c47]",
    dot: "bg-[#39b580]",
  },

  moderate: {
    label: "Moderate Crowd",
    chip: "border-[#fe7952] bg-[#ffdbd1] text-[#862201]",
    dot: "bg-[#fe7952]",
  },

  high: {
    label: "High Crowd",
    chip: "border-[#ff6b7a] bg-[#ffdad6] text-[#ba1a1a]",
    dot: "bg-[#ff6b7a]",
  },
};

type QueueUser = {
  status?: string;
  station_id?: string;
  ticket_number?: number;
  join_method?: string;
  joined_at?: number;
  checked_in?: boolean;
  service_start_at?: number;
  service_end_at?: number;
  completed_at?: number;
  eta?: number;
  name?: string;
};

type Station = {
  id: string;
  name: string;
  status?: string;
  service_type?: string;
  queue_state?: {
    serving_ticket_number?: number;
  };
};

type Queue = {
  stations?: Record<string, Station>;
  users?: Record<string, QueueUser>;
  history?: Record<string, QueueUser>;

  analytics?: {
    total_served?: number;
    total_no_show?: number;
    avg_service_time?: number;
  };

  live_state?: {
    crowd_level?: "low" | "moderate" | "high";
    estimated_wait_time_avg?: number;
  };

  queue_state?: {
    total_waiting?: number;
    total_completed?: number;
    total_serving?: number;
    serving_ticket_number?: number;
  };

  settings?: {
    max_capacity?: number;
  };
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: string;
}) {
  return (
    <motion.article
      whileHover={{ y: -4 }}
      className="rounded-[28px] border border-white/40 bg-white/70 p-7 backdrop-blur-xl shadow-[0_10px_50px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a8a8a]">
            {label}
          </p>

          <h3 className={`mt-4 text-4xl font-black ${tone}`}>{value}</h3>

          {sub && (
            <p className="mt-2 text-sm font-medium text-gray-500">{sub}</p>
          )}
        </div>

        <div className="flex size-14 items-center justify-center rounded-2xl bg-black text-white">
          <Icon className="size-6" />
        </div>
      </div>
    </motion.article>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [queue, setQueue] = useState<Queue | null>(null);
  const [establishment, setEstablishment] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);

        const res = await apiFetch("/admin/queues/me");

        setQueue(res.queue || null);
        setEstablishment(res.establishment || null);
      } catch (err) {
        console.error("Failed to load admin dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const stats = useAdminAnalytics(queue);

  const stations = useMemo(() => {
    if (!queue?.stations) return [];

    return Object.values(queue.stations);
  }, [queue]);

  const users = useMemo(() => {
    const activeUsers = queue?.users ? Object.values(queue.users) : [];

    const historyUsers = queue?.history ? Object.values(queue.history) : [];

    return [...activeUsers, ...historyUsers];
  }, [queue]);

  /**
   * ---------------------------------------------------
   * DERIVED ANALYTICS
   * ---------------------------------------------------
   */

  const waitingUsers = users.filter((u) => u.status === "waiting");

  const servingUsers = users.filter((u) => u.status === "serving");

  const completedUsers = users.filter((u) =>
    ["completed", "done"].includes(u.status || ""),
  );

  const cancelledUsers = users.filter((u) =>
    ["cancelled", "no_show"].includes(u.status || ""),
  );

  const remoteUsers = users.filter((u) => u.join_method === "remote");

  const physicalUsers = users.filter((u) => u.join_method !== "remote");

  const completionRate =
    users.length > 0
      ? Math.round((completedUsers.length / users.length) * 100)
      : 0;

  const remoteRate =
    users.length > 0
      ? Math.round((remoteUsers.length / users.length) * 100)
      : 0;

  const avgServiceMinutes = queue?.analytics?.avg_service_time
    ? Number(queue.analytics.avg_service_time).toFixed(1)
    : "0";

  const pressure =
    (waitingUsers.length || 0) / (queue?.settings?.max_capacity || 1);

  const pressurePercent = Math.min(Math.round(pressure * 100), 100);

  const eliminatedMinutes =
    remoteUsers.length * (queue?.live_state?.estimated_wait_time_avg || 3);

  const workingHoursMap = useMemo(() => {
    const schedule = establishment?.working_hours?.schedule || [];

    const map: Record<
      string,
      { open: number; close: number; isOpen: boolean }
    > = {};

    schedule.forEach((s: any) => {
      map[s.day] = {
        open: parseInt(s.start?.split(":")[0] || "0"),
        close: parseInt(s.end?.split(":")[0] || "24"),
        isOpen: !!s.isOpen,
      };
    });

    return map;
  }, [establishment]);

  const isWithinWorkingHours = (user: QueueUser) => {
    if (!user.joined_at) return false;

    const date = new Date(user.joined_at);

    const day = date.toLocaleString("en-US", { weekday: "long" });
    const hour = date.getHours();

    const schedule = workingHoursMap[day];

    if (!schedule?.isOpen) return false;

    return hour >= schedule.open && hour <= schedule.close;
  };

  /**
   * ---------------------------------------------------
   * CHARTS
   * ---------------------------------------------------
   */

  const queueFlowData = [
    {
      value: users.length,
      name: "Joined",
      fill: "#111111",
    },

    {
      value: waitingUsers.length,
      name: "Waiting",
      fill: "#fe7952",
    },

    {
      value: servingUsers.length,
      name: "Serving",
      fill: "#0b84ff",
    },

    {
      value: completedUsers.length,
      name: "Completed",
      fill: "#39b580",
    },
  ];

  const remoteData = [
    {
      name: "Remote",
      value: remoteUsers.length,
    },

    {
      name: "Walk-in",
      value: physicalUsers.length,
    },
  ];

  const stationData = useMemo(() => {
    return stations.map((station) => {
      const stationUsers = Object.values(queue?.users || {}).filter(
        (user: any) => user?.station_id === station.id,
      );

      const waiting = stationUsers.filter(
        (user: any) => user?.status === "waiting",
      ).length;

      const called = stationUsers.filter(
        (user: any) => user?.status === "called",
      ).length;

      const serving = stationUsers.filter(
        (user: any) => user?.status === "serving",
      ).length;

      return {
        name: station.name,
        waiting,
        called,
        serving,
        total: waiting + called + serving,
      };
    });
  }, [stations, queue]);

  const hourlyMap: Record<string, number> = {};
  const dailyMap: Record<string, number> = {};
  const formatHour12 = (hour: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${formattedHour}:00 ${period}`;
  };
  users.forEach((user) => {
    if (!user.joined_at) return;

    // ❗ FILTER BY OPENING HOURS
    if (!isWithinWorkingHours(user)) return;

    const date = new Date(user.joined_at);

    const hour = date.getHours();
    const day = date.toLocaleString("en-US", { weekday: "long" });

    const hourLabel = formatHour12(hour);

    hourlyMap[hourLabel] = (hourlyMap[hourLabel] || 0) + 1;
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  });

  const heatmapData = Object.entries(hourlyMap).map(([hour, value]) => ({
    hour,
    value,
  }));

  const dailyTrendData = Object.entries(dailyMap).map(([day, value]) => ({
    day,
    value,
  }));

  const peakHour = useMemo(() => {
    let maxHour = "";
    let maxValue = 0;

    Object.entries(hourlyMap).forEach(([hour, value]) => {
      if (value > maxValue) {
        maxValue = value;
        maxHour = hour;
      }
    });

    return { hour: maxHour, value: maxValue };
  }, [queue, establishment]);

  const timeline = users
    .sort((a, b) => (b.joined_at || 0) - (a.joined_at || 0))
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <section className="mx-auto max-w-7xl px-6 py-10">
        {/* HERO */}
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#8a8a8a]">
              Queue Intelligence Center
            </p>

            <h1 className="mt-3 text-5xl font-black tracking-tight">
              {establishment?.name || "Admin Dashboard"}
            </h1>

            {establishment?.location && (
              <p className="mt-3 flex items-center gap-2 text-lg text-gray-500">
                <MapPin className="size-5" />
                {establishment.location}
              </p>
            )}
          </div>

          <div
            className={`rounded-full border px-5 py-3 text-sm font-bold ${
              crowdStyles[queue?.live_state?.crowd_level || "low"]?.chip
            }`}
          >
            {crowdStyles[queue?.live_state?.crowd_level || "low"]?.label}
          </div>
        </div>

        {/* KPI */}
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label="Queue Pressure"
            value={`${pressurePercent}%`}
            sub={`${waitingUsers.length} waiting users`}
            tone="text-[#0b84ff]"
          />

          <StatCard
            icon={Wifi}
            label="Remote Adoption"
            value={`${remoteRate}%`}
            sub={`${remoteUsers.length} users joined remotely`}
            tone="text-[#39b580]"
          />

          <StatCard
            icon={CheckCircle2}
            label="Completion Rate"
            value={`${completionRate}%`}
            sub={`${completedUsers.length} completed`}
            tone="text-[#111111]"
          />

          <StatCard
            icon={TimerReset}
            label="Time Eliminated"
            value={`${eliminatedMinutes}m`}
            sub="physical waiting removed"
            tone="text-[#fe7952]"
          />
        </div>

        {/* MAIN GRID */}
        <div className="mt-8 grid gap-6 xl:grid-cols-12">
          {/* QUEUE TREND */}
          <div className="rounded-[28px] border border-white/40 bg-white/70 p-7 backdrop-blur-xl shadow-[0_10px_50px_rgba(0,0,0,0.06)] xl:col-span-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-gray-400">
                  Queue Activity
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Crowd Trend Monitor
                </h2>
              </div>

              <Activity className="size-6 text-[#0b84ff]" />
            </div>

            <div className="mt-8 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={heatmapData}>
                  <defs>
                    <linearGradient
                      id="queueGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#0b84ff" stopOpacity={0.4} />

                      <stop offset="95%" stopColor="#0b84ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis dataKey="hour" />

                  <YAxis />

                  <Tooltip />

                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#0b84ff"
                    fill="url(#queueGradient)"
                    strokeWidth={4}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* REMOTE ADOPTION */}
          <div className="rounded-[28px] border border-white/40 bg-white/70 p-7 backdrop-blur-xl shadow-[0_10px_50px_rgba(0,0,0,0.06)] xl:col-span-4">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-gray-400">
              Queue Source
            </p>

            <h2 className="mt-2 text-2xl font-black">Remote vs Walk-in</h2>

            <div className="mt-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={remoteData}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    <Cell fill="#39b580" />

                    <Cell fill="#111111" />
                  </Pie>

                  <Tooltip />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FLOW */}
          <div className="rounded-[28px] border border-white/40 bg-white/70 p-7 backdrop-blur-xl shadow-[0_10px_50px_rgba(0,0,0,0.06)] xl:col-span-5">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-gray-400">
              Queue Flow
            </p>

            <h2 className="mt-2 text-2xl font-black">Queue Conversion</h2>

            <div className="mt-8 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip />

                  <Funnel
                    dataKey="value"
                    data={queueFlowData}
                    isAnimationActive
                  />
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* STATION LOAD */}
          <div className="rounded-[28px] border border-white/40 bg-white/70 p-7 backdrop-blur-xl shadow-[0_10px_50px_rgba(0,0,0,0.06)] xl:col-span-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-gray-400">
                  Counter Monitoring
                </p>

                <h2 className="mt-2 text-2xl font-black">Station Throughput</h2>
              </div>

              <TrendingUp className="size-6 text-[#39b580]" />
            </div>

            <div className="mt-8 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stationData}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis dataKey="name" />

                  <YAxis allowDecimals={false} />

                  <Tooltip />

                  <Legend />

                  <Bar dataKey="waiting" fill="#fe7952" radius={[8, 8, 0, 0]} />

                  <Bar dataKey="called" fill="#facc15" radius={[8, 8, 0, 0]} />

                  <Bar dataKey="serving" fill="#0b84ff" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* INSIGHTS */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-[28px] bg-black p-7 text-white">
            <TrendingUp className="size-8" />

            <h3 className="mt-6 text-2xl font-black">Predictive Insight</h3>

            <p className="mt-4 text-white/70 leading-relaxed">
              Peak queue activity occurs around{" "}
              <span className="font-bold text-white">
                {peakHour.hour || "N/A"}
              </span>{" "}
              with {peakHour.value || 0} user/s.
            </p>
          </div>

          <div className="rounded-[28px] bg-[#fe7952] p-7 text-white">
            <AlertTriangle className="size-8" />

            <h3 className="mt-6 text-2xl font-black">Queue Friction</h3>

            <p className="mt-4 text-white/80 leading-relaxed">
              Most cancellations occur after ETA exceeds 6 minutes. Consider
              auto-balancing stations during peak periods.
            </p>
          </div>

          <div className="rounded-[28px] bg-[#39b580] p-7 text-white">
            <TrendingDown className="size-8" />

            <h3 className="mt-6 text-2xl font-black">
              Physical Queue Reduction
            </h3>

            <p className="mt-4 text-white/80 leading-relaxed">
              Remote queueing reduced physical crowd buildup by an estimated{" "}
              {eliminatedMinutes} minutes today.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/40 bg-white/70 p-7">
          <h2 className="text-2xl font-black">Weekly Trend</h2>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyTrendData}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#0b84ff" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LIVE TIMELINE */}
        <div className="mt-8 rounded-[28px] border border-white/40 bg-white/70 p-7 backdrop-blur-xl shadow-[0_10px_50px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-gray-400">
                Live Activity
              </p>

              <h2 className="mt-2 text-2xl font-black">Queue Timeline</h2>
            </div>

            <Clock3 className="size-6 text-[#111]" />
          </div>

          <div className="mt-8 space-y-5">
            {timeline.map((user, index) => (
              <div
                key={index}
                className="flex items-start gap-4 border-b border-dashed border-gray-200 pb-5"
              >
                <div className="mt-1 size-3 rounded-full bg-[#0b84ff]" />

                <div>
                  <p className="font-bold text-black">
                    Ticket #{user.ticket_number}
                  </p>

                  <p className="mt-1 text-gray-500">
                    {user.name || "Anonymous"} joined via{" "}
                    {user.join_method || "walk-in"} queue.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-20 border-t bg-[#f4f7f6]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between px-6 py-16 md:flex-row">
          <div>
            <img src={LOGO_SRC} alt="linea" className="h-10" />

            <p className="mt-6 max-w-md text-gray-600">
              The queue that waits for you. Built to remove waiting pain.
            </p>
          </div>

          <p className="mt-6 font-bold text-gray-500 md:mt-0">
            © 2026 Clawed Code
          </p>
        </div>
      </footer>
    </div>
  );
}
