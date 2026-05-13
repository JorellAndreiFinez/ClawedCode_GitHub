import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { getMyEstablishment, updateEstablishment } from "@/lib/establishment";
import { toast } from "sonner";

type Station = {
  id: string;
  name?: string;
  service_type?: string;
  status?: string;
};

type Establishment = {
  id: string;
  name?: string;
  location?: string;
  work_email?: string;
  queue?: {
    stations?: Record<string, Station>;
  };
};

type BasicField = "name" | "location" | "work_email";
type StationField = "name" | "service_type";

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
        const data = (await getMyEstablishment()) as Establishment;

        setEst({
          ...data,
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
        : prev
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
        : prev
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
        : prev
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

      await updateEstablishment(est.id, est);

      toast.success("Updated successfully");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update establishment"));
    } finally {
      setLoading(false);
    }
  };

  const stations = useMemo(
    () => Object.values(est?.queue?.stations ?? {}),
    [est?.queue?.stations]
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

              <div className="space-y-2">
                <FieldLabel>Work email</FieldLabel>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#39b580]" />
                  <input
                    className="h-14 w-full rounded-2xl border border-[#bccabf] bg-white pl-12 pr-4 text-base font-bold text-[#1b1c1c] outline-none transition-colors placeholder:text-[#8a8a8a] focus:border-[#006c47]"
                    value={est.work_email || ""}
                    onChange={(e) =>
                      updateField("work_email", e.target.value)
                    }
                    placeholder="admin@business.com"
                  />
                </div>
              </div>
            </div>
          </section>

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
                              e.target.value
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
