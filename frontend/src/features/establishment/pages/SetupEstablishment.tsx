import { useState } from "react";
import { createEstablishment } from "@/lib/establishment";
import { toast } from "sonner";
import {
  Building2,
  Mail,
  MapPin,
  Users,
  Plus,
  Trash2,
  Clock3,
} from "lucide-react";

type Station = {
  name: string;
  service_type: "regular" | "priority";
};

export default function SetupEstablishment() {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    work_email: "",
    location: "",
    queue_capacity: 50,

    stations: [
      {
        name: "Counter 1",
        service_type: "regular",
      },
    ] as Station[],

    working_hours: {
      timezone: "Asia/Manila",
      schedule: [
        { day: "Monday", isOpen: true, start: "09:00", end: "18:00" },
        { day: "Tuesday", isOpen: true, start: "09:00", end: "18:00" },
        { day: "Wednesday", isOpen: true, start: "09:00", end: "18:00" },
        { day: "Thursday", isOpen: true, start: "09:00", end: "18:00" },
        { day: "Friday", isOpen: true, start: "09:00", end: "18:00" },
        { day: "Saturday", isOpen: false, start: "09:00", end: "18:00" },
        { day: "Sunday", isOpen: false, start: "09:00", end: "18:00" },
      ],
    },
  });

  const handleSubmit = async () => {
    try {
      setLoading(true);

      await createEstablishment(form);

      toast.success("Establishment created successfully");

      await new Promise((resolve) => setTimeout(resolve, 500));

      window.location.replace("/admin");
    } catch (err: any) {
      toast.error(err.message || "Failed to create establishment");
    } finally {
      setLoading(false);
    }
  };

  const addStation = () => {
    setForm((prev) => ({
      ...prev,
      stations: [
        ...prev.stations,
        {
          name: `Counter ${prev.stations.length + 1}`,
          service_type: "regular",
        },
      ],
    }));
  };

  const removeStation = (index: number) => {
    setForm((prev) => ({
      ...prev,
      stations: prev.stations.filter((_, i) => i !== index),
    }));
  };

  const updateStation = (index: number, key: keyof Station, value: any) => {
    const updated = [...form.stations];

    updated[index] = {
      ...updated[index],
      [key]: value,
    };

    setForm((prev) => ({
      ...prev,
      stations: updated,
    }));
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold shadow-sm">
            <Building2 className="size-4" />
            LINEA Establishment Setup
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
            Setup Your Queue System
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-500 sm:text-base">
            Configure your establishment information, queue stations, and
            operating hours to start managing customer flow smarter.
          </p>
        </div>

        {/* MAIN CARD */}
        <div className="overflow-hidden rounded-[32px] border border-white/30 bg-white/80 shadow-[0_10px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            {/* LEFT */}
            <div className="space-y-8 p-6 sm:p-8 lg:p-10">
              {/* BASIC INFO */}
              <div>
                <h2 className="text-xl font-black">Basic Information</h2>

                <p className="mt-2 text-sm text-gray-500">
                  Setup your establishment profile.
                </p>

                <div className="mt-6 space-y-4">
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />

                    <input
                      placeholder="Establishment Name"
                      className="h-14 w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none transition focus:border-black"
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />

                    <input
                      placeholder="Work Email"
                      className="h-14 w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none transition focus:border-black"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          work_email: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />

                    <input
                      placeholder="Location"
                      className="h-14 w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none transition focus:border-black"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          location: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />

                    <input
                      type="number"
                      placeholder="Queue Capacity"
                      className="h-14 w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none transition focus:border-black"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          queue_capacity: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* WORKING HOURS */}
              <div>
                <div className="flex items-center gap-2">
                  <Clock3 className="size-5" />

                  <h2 className="text-xl font-black">Working Hours</h2>
                </div>

                <div className="mt-5 space-y-3">
                  {form.working_hours.schedule.map((d, index) => (
                    <div
                      key={d.day}
                      className="rounded-2xl border border-gray-200 bg-[#fafafa] p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="w-full font-semibold lg:w-32">
                          {d.day}
                        </div>

                        <select
                          className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none"
                          value={d.isOpen ? "open" : "closed"}
                          onChange={(e) => {
                            const updated = [...form.working_hours.schedule];

                            updated[index].isOpen = e.target.value === "open";

                            setForm({
                              ...form,
                              working_hours: {
                                ...form.working_hours,
                                schedule: updated,
                              },
                            });
                          }}
                        >
                          <option value="open">Open</option>
                          <option value="closed">Closed</option>
                        </select>

                        <div className="flex flex-1 gap-3">
                          <input
                            type="time"
                            disabled={!d.isOpen}
                            value={d.start}
                            className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none disabled:bg-gray-100"
                            onChange={(e) => {
                              const updated = [...form.working_hours.schedule];

                              updated[index].start = e.target.value;

                              setForm({
                                ...form,
                                working_hours: {
                                  ...form.working_hours,
                                  schedule: updated,
                                },
                              });
                            }}
                          />

                          <input
                            type="time"
                            disabled={!d.isOpen}
                            value={d.end}
                            className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none disabled:bg-gray-100"
                            onChange={(e) => {
                              const updated = [...form.working_hours.schedule];

                              updated[index].end = e.target.value;

                              setForm({
                                ...form,
                                working_hours: {
                                  ...form.working_hours,
                                  schedule: updated,
                                },
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="border-t bg-[#fafbfd] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">Queue Stations</h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Add and manage counters.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addStation}
                  className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <Plus className="size-4" />
                  Add
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {form.stations.map((station, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="space-y-3">
                      <input
                        className="h-12 w-full rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-black"
                        value={station.name}
                        onChange={(e) =>
                          updateStation(index, "name", e.target.value)
                        }
                        placeholder="Station Name"
                      />

                      <div className="flex gap-3">
                        <select
                          className="h-12 flex-1 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-black"
                          value={station.service_type}
                          onChange={(e) =>
                            updateStation(
                              index,
                              "service_type",
                              e.target.value as "regular" | "priority",
                            )
                          }
                        >
                          <option value="regular">Regular Service</option>

                          <option value="priority">Priority Service</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => removeStation(index)}
                          className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500 text-white transition hover:bg-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* SUBMIT */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="mt-8 h-14 w-full rounded-2xl bg-black text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Saving Establishment..." : "Complete Setup"}
              </button>

              <p className="mt-4 text-center text-xs leading-relaxed text-gray-400">
                By continuing, your establishment queue system will be created
                and initialized automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
