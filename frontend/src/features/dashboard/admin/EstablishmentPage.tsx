import { useEffect, useState } from "react";
import { getMyEstablishment, updateEstablishment } from "@/lib/establishment";
import { toast } from "sonner";

export default function EstablishmentPage() {
  const [loading, setLoading] = useState(false);
  const [est, setEst] = useState<any>(null);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const data = await getMyEstablishment();

        setEst({
          ...data,
          queue: data?.queue ?? {
            stations: {},
          },
        });
      } catch (err: any) {
        toast.error(err.message);
      }
    })();
  }, []);

  // =========================
  // BASIC FIELD UPDATE
  // =========================
  const updateField = (key: string, value: any) => {
    setEst((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  // =========================
  // STATION UPDATE
  // =========================
  const updateStation = (id: string, key: string, value: any) => {
    setEst((prev: any) => ({
      ...prev,
      queue: {
        ...prev.queue,
        stations: {
          ...(prev.queue?.stations ?? {}),
          [id]: {
            ...prev.queue?.stations?.[id],
            [key]: value,
          },
        },
      },
    }));
  };

  // =========================
  // ADD STATION
  // =========================
  const addStation = () => {
    const id = `station_${Date.now()}`;

    setEst((prev: any) => ({
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
    }));
  };

  // =========================
  // REMOVE STATION
  // =========================
  const removeStation = (id: string) => {
    setEst((prev: any) => {
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

  // =========================
  // SAVE
  // =========================
  const save = async () => {
    try {
      setLoading(true);

      await updateEstablishment(est.id, est);

      toast.success("Updated successfully");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // LOADING GUARD
  // =========================
  if (!est) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Establishment Settings</h1>

      {/* BASIC INFO */}
      <div className="space-y-2">
        <input
          className="border p-2 w-full"
          value={est.name || ""}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="Name"
        />

        <input
          className="border p-2 w-full"
          value={est.location || ""}
          onChange={(e) => updateField("location", e.target.value)}
          placeholder="Location"
        />

        <input
          className="border p-2 w-full"
          value={est.work_email || ""}
          onChange={(e) => updateField("work_email", e.target.value)}
          placeholder="Email"
        />
      </div>

      {/* STATIONS */}
      <div className="border p-4 rounded space-y-3">
        <div className="flex justify-between">
          <h2 className="font-semibold">Stations</h2>

          <button
            onClick={addStation}
            className="px-2 py-1 bg-black text-white rounded"
          >
            + Add
          </button>
        </div>

        {Object.values(est.queue?.stations ?? {}).map((s: any) => (
          <div key={s.id} className="grid grid-cols-3 gap-2">
            <input
              className="border p-1"
              value={s.name || ""}
              onChange={(e) => updateStation(s.id, "name", e.target.value)}
            />

            <select
              className="border p-1"
              value={s.service_type || "regular"}
              onChange={(e) =>
                updateStation(s.id, "service_type", e.target.value)
              }
            >
              <option value="regular">Regular</option>
              <option value="priority">Priority</option>
            </select>

            <button
              onClick={() => removeStation(s.id)}
              className="bg-red-500 text-white text-xs rounded"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* SAVE */}
      <button
        onClick={save}
        disabled={loading}
        className="w-full bg-black text-white p-2 rounded"
      >
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
