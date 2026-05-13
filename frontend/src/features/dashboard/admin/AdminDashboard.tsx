import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock3, MapPin, Plus, TrendingUp, Users } from "lucide-react";

const LOGO_SRC = "/linea/linea-logo.png";

type CrowdLevel = "low" | "moderate" | "high";

type StationCard = {
  id: string;
  name: string;
  location: string;
  status: "Open" | "Paused";
  nowServing: string;
  crowd: CrowdLevel;
  waiting: number;
  served: number;
  eta: string;
};

const stationCards: StationCard[] = [
  {
    id: "bdo-main",
    name: "BDO Teller Line",
    location: "SM North EDSA, Quezon City",
    status: "Open",
    nowServing: "#45",
    crowd: "low",
    waiting: 3,
    served: 14,
    eta: "~12m",
  },
  {
    id: "bpi-counter-4",
    name: "BPI Teller Counter 4",
    location: "SM North EDSA, Quezon City",
    status: "Open",
    nowServing: "#89",
    crowd: "moderate",
    waiting: 3,
    served: 102,
    eta: "~45m",
  },
  {
    id: "sm-retail-1",
    name: "SM Retail Counter 1",
    location: "SM North EDSA, Quezon City",
    status: "Open",
    nowServing: "#534",
    crowd: "high",
    waiting: 300,
    served: 140,
    eta: "~1h30m",
  },
  {
    id: "bdo-south-1",
    name: "BDO Teller Line",
    location: "SM North EDSA, Quezon City",
    status: "Open",
    nowServing: "#45",
    crowd: "low",
    waiting: 3,
    served: 14,
    eta: "~12m",
  },
  {
    id: "bdo-south-2",
    name: "BDO Teller Line",
    location: "SM North EDSA, Quezon City",
    status: "Open",
    nowServing: "#45",
    crowd: "low",
    waiting: 3,
    served: 14,
    eta: "~12m",
  },
  {
    id: "bdo-south-3",
    name: "BDO Teller Line",
    location: "SM North EDSA, Quezon City",
    status: "Open",
    nowServing: "#45",
    crowd: "low",
    waiting: 3,
    served: 14,
    eta: "~12m",
  },
  {
    id: "bdo-south-4",
    name: "BDO Teller Line",
    location: "SM North EDSA, Quezon City",
    status: "Open",
    nowServing: "#45",
    crowd: "low",
    waiting: 3,
    served: 14,
    eta: "~12m",
  },
  {
    id: "bdo-south-5",
    name: "BDO Teller Line",
    location: "SM North EDSA, Quezon City",
    status: "Open",
    nowServing: "#45",
    crowd: "low",
    waiting: 3,
    served: 14,
    eta: "~12m",
  },
  {
    id: "bdo-south-6",
    name: "BDO Teller Line",
    location: "SM North EDSA, Quezon City",
    status: "Open",
    nowServing: "#45",
    crowd: "low",
    waiting: 3,
    served: 14,
    eta: "~12m",
  },
];

const crowdStyles = {
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

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <article className="rounded-2xl border border-[#d9d9d9] bg-white p-8 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-[#e3e2e2] text-[#8a8a8a]">
          <Icon className="size-5" />
        </span>
        <p className="text-sm font-extrabold uppercase text-[#8a8a8a]">
          {label}
        </p>
      </div>
      <p className={`mt-6 text-4xl font-extrabold leading-none ${tone}`}>
        {value}
      </p>
    </article>
  );
}

function StationCardView({
  station,
  onOpenControls,
}: {
  station: StationCard;
  onOpenControls: () => void;
}) {
  const crowd = crowdStyles[station.crowd];

  return (
    <article className="rounded-2xl border border-[#d9d9d9] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-extrabold leading-tight">
            {station.name}
          </h3>
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#7c7c7c]">
            <MapPin className="size-4" />
            {station.location}
          </p>
        </div>
        <span className="rounded-full bg-[#39b580] px-4 py-1 text-sm font-medium text-white">
          {station.status}
        </span>
      </div>

      <div className="mt-9 flex items-end justify-between gap-4">
        <div>
          <p className="text-base font-medium uppercase text-[#8a8a8a]">
            Now serving
          </p>
          <p className="mt-3 text-4xl font-extrabold leading-none text-[#25262a]">
            {station.nowServing}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-extrabold ${crowd.chip}`}
        >
          <span className={`size-2 rounded-full ${crowd.dot}`} />
          {crowd.label}
        </span>
      </div>

      <div className="mt-7 border-t border-[#e3e2e2] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-[#555]">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-4 text-black" />
            <strong className="text-black">{station.waiting}</strong>
            waiting
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4 text-black" />
            <strong className="text-black">{station.served}</strong>
            served
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="size-4 text-black" />
            <strong className="text-black">{station.eta}</strong>
            ETA
          </span>
        </div>
      </div>

      <button
        onClick={onOpenControls}
        className="mt-7 flex min-h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-black text-lg font-extrabold text-white transition-colors hover:bg-[#25262a]"
      >
        Open Controls
      </button>
    </article>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <section className="mx-auto max-w-7xl px-6 py-12 md:py-14">
        <p className="text-xl font-bold text-[#8a8a8a]">Overview</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
          Admin Dashboard
        </h1>

        <div className="mt-9 grid gap-6 md:grid-cols-3">
          <StatCard
            icon={Users}
            label="Active stations"
            value="8 stations"
            tone="text-[#0b84ff]"
          />
          <StatCard
            icon={Clock3}
            label="People waiting"
            value="38 users"
            tone="text-[#fe7952]"
          />
          <StatCard
            icon={TrendingUp}
            label="Served today"
            value="176 users"
            tone="text-[#39b580]"
          />
        </div>

        <div className="mt-20 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <h2 className="text-4xl font-extrabold tracking-tight">
            Active Stations
          </h2>
          <button
            onClick={() => navigate("/admin/establishment")}
            className="inline-flex min-h-16 cursor-pointer items-center justify-center gap-4 rounded-2xl bg-[#39b580] px-10 text-lg font-extrabold text-white transition-colors hover:bg-[#006c47]"
          >
            <Plus className="size-8" />
            Create New Station
          </button>
        </div>

        <section className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {stationCards.map((station) => (
            <StationCardView
              key={station.id}
              station={station}
              onOpenControls={() => navigate("/admin/queue")}
            />
          ))}
        </section>
      </section>

      <footer className="mt-20 border-t border-[#e3e2e2] bg-[#f4f7f6]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-6 py-16 md:flex-row md:items-end">
          <div>
            <img src={LOGO_SRC} alt="linea" className="h-12 w-auto" />
            <p className="mt-8 max-w-xl text-xl font-medium leading-7 text-[#6d7a71]">
              The queue that waits for you. Built with care by a small team
              that hates standing in lines as much as you do.
            </p>
          </div>
          <p className="text-xl font-extrabold text-[#7c7c7c]">
            &copy; 2026 Clawed Code
          </p>
        </div>
      </footer>
    </div>
  );
}
