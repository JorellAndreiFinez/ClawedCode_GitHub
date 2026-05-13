import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  Plus,
  Save,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import { getMyEstablishment, updateEstablishment } from "@/lib/establishment";
import { toast } from "sonner";

type Station = {
  id: string;
  name?: string;
  service_type?: string;
  status?: string;
};

type WorkingDay = {
  enabled: boolean;
  open: string;
  close: string;
};

type Establishment = {
  id: string;
  name?: string;
  location?: string;
  work_email?: string;
  queue_capacity?: number;
  working_hours?: Record<string, WorkingDay>;
  queue?: {
    stations?: Record<string, Station>;
  };
};

type BasicField = "name" | "location" | "work_email";
type StationField = "name" | "service_type";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-sm font-extrabold uppercase tracking-wide text-[#6d7a71]">
      {children}
    </label>
  );
}

export default function EstablishmentPage() {
  const [loading, setLoading] = useState(false);
  const [est, setEst] = useState<Establishment | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = (await getMyEstablishment()) as any;

        const workingHoursMap: Record<string, WorkingDay> = {};

        const schedule = data?.working_hours?.schedule ?? [];

        schedule.forEach((d: any) => {
          workingHoursMap[d.day.toLowerCase()] = {
            enabled: d.isOpen,
            open: d.start,
            close: d.end,
          };
        });

        setEst({
          ...data,
          queue_capacity: data.queue_capacity || 0,
          working_hours: workingHoursMap,
          queue: {
            ...data.queue,
            stations: data.queue?.stations ?? {},
          },
        });
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to load establishment"));
      }
    })();
  }, []);

  const updateField = (key: BasicField, value: string) => {
    setEst((prev) =>
      prev
        ? {
            ...prev,
            [key]: value,
          }
        : prev,
    );
  };

  const updateNumberField = (key: "queue_capacity", value: string) => {
    setEst((prev) =>
      prev
        ? {
            ...prev,
            [key]: Number(value),
          }
        : prev,
    );
  };

  const updateWorkingHours = (
    day: string,
    field: keyof WorkingDay,
    value: string | boolean,
  ) => {
    setEst((prev) =>
      prev
        ? {
            ...prev,
            working_hours: {
              ...(prev.working_hours || {}),
              [day]: {
                ...(prev.working_hours?.[day] || {}),
                [field]: value,
              },
            },
          }
        : prev,
    );
  };

  const updateStation = (id: string, key: StationField, value: string) => {
    setEst((prev) =>
      prev
        ? {
            ...prev,
            queue: {
              ...prev.queue,
              stations: {
                ...(prev.queue?.stations ?? {}),
                [id]: {
                  ...(prev.queue?.stations?.[id] ?? { id }),
                  [key]: value,
                },
              },
            },
          }
        : prev,
    );
  };

  const addStation = () => {
    const id = `station_${Date.now()}`;

    setEst((prev) =>
      prev
        ? {
            ...prev,
            queue: {
              ...prev.queue,
              stations: {
                ...(prev.queue?.stations ?? {}),
                [id]: {
                  id,
                  name: "",
                  service_type: "regular",
                  status: "active",
                },
              },
            },
          }
        : prev,
    );
  };

  const removeStation = (id: string) => {
    setEst((prev) => {
      if (!prev) return prev;

      const stations = { ...(prev.queue?.stations ?? {}) };
      delete stations[id];

      return {
        ...prev,
        queue: {
          ...prev.queue,
          stations,
        },
      };
    });
  };

  const save = async () => {
    if (!est) return;

    try {
      setLoading(true);
      const schedule = Object.entries(est.working_hours || {}).map(
        ([day, value]: any) => ({
          day: day.charAt(0).toUpperCase() + day.slice(1),
          isOpen: value.enabled,
          start: value.open,
          end: value.close,
        }),
      );

      const payload = {
        ...est,
        working_hours: {
          schedule,
          timezone: est.working_hours?.timezone || "Asia/Manila",
        },
      };
      await updateEstablishment(est.id, payload);

      toast.success("Updated successfully");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update establishment"));
    } finally {
      setLoading(false);
    }
  };

  const stations = useMemo(
    () => Object.values(est?.queue?.stations ?? {}),
    [est?.queue?.stations],
  );

  if (!est) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="rounded-2xl border border-[#e3e2e2] bg-white p-8 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
          <p className="text-lg font-extrabold">Loading settings...</p>
          <p className="mt-2 text-sm font-medium text-[#6d7a71]">
            Pulling latest business profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-7xl px-6 py-12 md:py-14">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-xl font-bold text-[#8a8a8a]">Settings</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
              Establishment Settings
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-6 text-[#6d7a71]">
              Keep business details and service stations ready for customer
              queues.
            </p>
          </div>

          <button
            onClick={save}
            disabled={loading}
            className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-2xl bg-[#39b580] px-7 text-base font-extrabold text-white transition-colors hover:bg-[#006c47] disabled:cursor-not-allowed disabled:bg-[#8a8a8a]"
          >
            <Save className="size-5" />
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* LEFT */}
          <section className="rounded-2xl border border-[#d9d9d9] bg-white p-7 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-full bg-[#e3e2e2] text-[#8a8a8a]">
                <Building2 className="size-6" />
              </span>
              <div>
                <h2 className="text-2xl font-extrabold">Business Profile</h2>
                <p className="mt-1 text-sm font-medium text-[#6d7a71]">
                  Public details shown across customer queue pages.
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              {/* NAME */}
              <div className="space-y-2">
                <FieldLabel>Establishment name</FieldLabel>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#39b580]" />

                  <input
                    className="h-14 w-full rounded-2xl border border-[#bccabf] bg-white pl-12 pr-4 text-base font-bold text-[#1b1c1c] outline-none transition-colors placeholder:text-[#8a8a8a] focus:border-[#006c47]"
                    value={est.name || ""}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Business name"
                  />
                </div>
              </div>

              {/* LOCATION */}
              <div className="space-y-2">
                <FieldLabel>Location</FieldLabel>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#39b580]" />

                  <input
                    className="h-14 w-full rounded-2xl border border-[#bccabf] bg-white pl-12 pr-4 text-base font-bold text-[#1b1c1c] outline-none transition-colors placeholder:text-[#8a8a8a] focus:border-[#006c47]"
                    value={est.location || ""}
                    onChange={(e) => updateField("location", e.target.value)}
                    placeholder="Branch address"
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div className="space-y-2">
                <FieldLabel>Work email</FieldLabel>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#39b580]" />

                  <input
                    className="h-14 w-full rounded-2xl border border-[#bccabf] bg-white pl-12 pr-4 text-base font-bold text-[#1b1c1c] outline-none transition-colors placeholder:text-[#8a8a8a] focus:border-[#006c47]"
                    value={est.work_email || ""}
                    onChange={(e) => updateField("work_email", e.target.value)}
                    placeholder="admin@business.com"
                  />
                </div>
              </div>

              {/* QUEUE CAPACITY */}
              <div className="space-y-2">
                <FieldLabel>Queue capacity</FieldLabel>

                <div className="relative">
                  <Users className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#39b580]" />

                  <input
                    type="number"
                    min={0}
                    className="h-14 w-full rounded-2xl border border-[#bccabf] bg-white pl-12 pr-4 text-base font-bold text-[#1b1c1c] outline-none transition-colors placeholder:text-[#8a8a8a] focus:border-[#006c47]"
                    value={est.queue_capacity || 0}
                    onChange={(e) =>
                      updateNumberField("queue_capacity", e.target.value)
                    }
                    placeholder="Maximum queue capacity"
                  />
                </div>
              </div>

              {/* WORKING HOURS */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-[#e3e2e2] text-[#8a8a8a]">
                    <Clock3 className="size-5" />
                  </span>

                  <div>
                    <h3 className="text-lg font-extrabold">Working Hours</h3>

                    <p className="text-sm font-medium text-[#6d7a71]">
                      Configure opening days and operating schedule.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {DAYS.map((day) => {
                    const schedule = est.working_hours?.[day];

                    return (
                      <div
                        key={day}
                        className="rounded-2xl border border-[#e3e2e2] bg-[#fbf9f9] p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={schedule?.enabled ?? false}
                              onChange={(e) => {
                                updateWorkingHours(
                                  day,
                                  "enabled",
                                  e.target.checked,
                                );
                              }}
                              className="size-5 accent-[#39b580]"
                            />

                            <p className="text-sm font-extrabold capitalize text-[#1b1c1c]">
                              {day}
                            </p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              type="time"
                              value={schedule?.open || "08:00"}
                              onChange={(e) =>
                                updateWorkingHours(day, "open", e.target.value)
                              }
                              disabled={!schedule?.enabled}
                              className="h-12 rounded-xl border border-[#bccabf] bg-white px-4 text-sm font-bold text-[#1b1c1c] outline-none transition-colors focus:border-[#006c47] disabled:cursor-not-allowed disabled:bg-[#ececec]"
                            />

                            <input
                              type="time"
                              value={schedule?.close || "17:00"}
                              onChange={(e) =>
                                updateWorkingHours(day, "close", e.target.value)
                              }
                              disabled={!schedule?.enabled}
                              className="h-12 rounded-xl border border-[#bccabf] bg-white px-4 text-sm font-bold text-[#1b1c1c] outline-none transition-colors focus:border-[#006c47] disabled:cursor-not-allowed disabled:bg-[#ececec]"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <section className="rounded-2xl border border-[#d9d9d9] bg-white p-7 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div className="flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-full bg-[#e3e2e2] text-[#8a8a8a]">
                  <Settings2 className="size-6" />
                </span>

                <div>
                  <h2 className="text-2xl font-extrabold">Queue Stations</h2>

                  <p className="mt-1 text-sm font-medium text-[#6d7a71]">
                    {stations.length} active setup
                    {stations.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={addStation}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-black px-5 text-sm font-extrabold text-white transition-colors hover:bg-[#25262a]"
              >
                <Plus className="size-5" />
                Add Station
              </button>
            </div>

            <div className="mt-8 space-y-4">
              {stations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#bccabf] bg-[#fbf9f9] p-8 text-center">
                  <p className="text-lg font-extrabold">No stations yet</p>

                  <p className="mt-2 text-sm font-medium text-[#6d7a71]">
                    Add at least one counter before opening queues.
                  </p>
                </div>
              ) : (
                stations.map((station, index) => (
                  <article
                    key={station.id}
                    className="rounded-2xl border border-[#e3e2e2] bg-[#fbf9f9] p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-xs font-extrabold uppercase text-[#6d7a71]">
                          Station {index + 1}
                        </p>

                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#39b580] bg-[#83f9be]/35 px-3 py-1 text-xs font-extrabold text-[#006c47]">
                          <CheckCircle2 className="size-4" />
                          {station.status || "active"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeStation(station.id)}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#ffb5a0] bg-white px-4 text-sm font-extrabold text-[#ba1a1a] transition-colors hover:bg-[#ffdad6]"
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </button>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-[1fr_220px]">
                      <div className="space-y-2">
                        <FieldLabel>Station name</FieldLabel>

                        <input
                          className="h-14 w-full rounded-2xl border border-[#bccabf] bg-white px-4 text-base font-bold text-[#1b1c1c] outline-none transition-colors placeholder:text-[#8a8a8a] focus:border-[#006c47]"
                          value={station.name || ""}
                          onChange={(e) =>
                            updateStation(station.id, "name", e.target.value)
                          }
                          placeholder="Counter name"
                        />
                      </div>

                      <div className="space-y-2">
                        <FieldLabel>Service type</FieldLabel>

                        <select
                          className="h-14 w-full rounded-2xl border border-[#bccabf] bg-white px-4 text-base font-bold text-[#1b1c1c] outline-none transition-colors focus:border-[#006c47]"
                          value={station.service_type || "regular"}
                          onChange={(e) =>
                            updateStation(
                              station.id,
                              "service_type",
                              e.target.value,
                            )
                          }
                        >
                          <option value="regular">Regular</option>
                          <option value="priority">Priority</option>
                        </select>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="mt-8 rounded-2xl border border-[#d9d9d9] bg-[#f4f7f6] p-5 sm:hidden">
          <button
            onClick={save}
            disabled={loading}
            className="inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-[#39b580] px-7 text-base font-extrabold text-white transition-colors hover:bg-[#006c47] disabled:cursor-not-allowed disabled:bg-[#8a8a8a]"
          >
            <Save className="size-5" />
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>
    </div>
  );
}
