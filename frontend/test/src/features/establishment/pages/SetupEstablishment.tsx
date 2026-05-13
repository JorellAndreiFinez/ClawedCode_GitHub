import { useState } from "react";
import { createEstablishment } from "@/lib/establishment";
import { useNavigate } from "react-router-dom";

export default function SetupEstablishment() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    work_email: "",
    location: "",
    queue_capacity: 50,

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
    await createEstablishment(form);
    navigate("/admin");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white shadow p-6 rounded-xl space-y-4">
        <h1 className="text-xl font-bold">Setup Your Establishment</h1>

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

        <button
          onClick={handleSubmit}
          className="w-full bg-black text-white p-2 rounded-lg"
        >
          Save Establishment
        </button>
      </div>
    </div>
  );
}
