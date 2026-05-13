import { useState } from "react";
import { createEstablishment } from "@/lib/establishment";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Station = {
  name: string;
  service_type: "regular" | "priority";
};

export default function SetupEstablishment() {
  const navigate = useNavigate();
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

      navigate("/admin", {
        replace: true,
        state: { establishmentCreated: true },
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to create establishment");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // STATIONS HANDLERS
  // -----------------------

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
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white shadow p-6 rounded-xl space-y-4">
        <h1 className="text-xl font-bold">Setup Your Establishment</h1>

        {/* BASIC INFO */}
        <input
          placeholder="Establishment Name"
          className="w-full border p-2"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          placeholder="Work Email"
          className="w-full border p-2"
          onChange={(e) => setForm({ ...form, work_email: e.target.value })}
        />

        <input
          placeholder="Location"
          className="w-full border p-2"
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />

        <input
          type="number"
          placeholder="Queue Capacity"
          className="w-full border p-2"
          onChange={(e) =>
            setForm({ ...form, queue_capacity: Number(e.target.value) })
          }
        />

        {/* WORKING HOURS */}
        <div className="space-y-2 border p-3 rounded-lg">
          <h2 className="font-semibold text-sm">Working Hours</h2>

          {form.working_hours.schedule.map((d, index) => (
            <div key={d.day} className="grid grid-cols-4 gap-2 items-center">
              <div className="text-sm font-medium">{d.day}</div>

              <select
                className="border p-1 text-sm"
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

              <input
                type="time"
                className="border p-1 text-sm"
                disabled={!d.isOpen}
                value={d.start}
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
                className="border p-1 text-sm"
                disabled={!d.isOpen}
                value={d.end}
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
          ))}
        </div>

        {/* STATIONS */}
        <div className="border p-3 rounded-lg space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-sm">Queue Stations</h2>

            <button
              type="button"
              onClick={addStation}
              className="text-sm px-2 py-1 bg-black text-white rounded"
            >
              + Add
            </button>
          </div>

          {form.stations.map((station, index) => (
            <div key={index} className="grid grid-cols-3 gap-2 items-center">
              <input
                className="border p-1 text-sm"
                value={station.name}
                onChange={(e) => updateStation(index, "name", e.target.value)}
                placeholder="Station Name"
              />

              <select
                className="border p-1 text-sm"
                value={station.service_type}
                onChange={(e) =>
                  updateStation(
                    index,
                    "service_type",
                    e.target.value as "regular" | "priority",
                  )
                }
              >
                <option value="regular">Regular</option>
                <option value="priority">Priority</option>
              </select>

              <button
                type="button"
                onClick={() => removeStation(index)}
                className="text-xs bg-red-500 text-white px-2 py-1 rounded"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* SUBMIT */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-black text-white p-2 rounded-lg"
        >
          {loading ? "Saving..." : "Save Establishment"}
        </button>
      </div>
    </div>
  );
}
