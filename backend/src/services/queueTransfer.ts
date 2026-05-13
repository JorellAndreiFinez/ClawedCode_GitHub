import { dbAdmin } from "../firebaseAdmin";
export async function autoTransferInactiveStations(queue: any) {
  const stations = queue.stations || {};
  const users = queue.users || {};

  const activeStations = Object.values(stations).filter(
    (s: any) => s.status === "active",
  );

  if (!activeStations.length) return;

  for (const [key, user] of Object.entries(users) as any) {
    if (user.status !== "waiting") continue;

    // assign to first active station
    await dbAdmin.ref(`queues/${queue.id}/users/${key}`).update({
      station_id: activeStations[0].id,
    });
  }
}
