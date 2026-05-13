import { dbAdmin } from "../firebaseAdmin";

export async function autoTransferInactiveStations(queue: any) {
  const stations = queue.stations || {};
  const users = queue.users || {};

  const activeStations = Object.values(stations).filter(
    (s: any) => s?.status === "active",
  ) as any[];

  if (!activeStations.length) return;

  const firstStationId = activeStations[0]?.id;
  if (!firstStationId) return;

  for (const [key, user] of Object.entries(users) as [string, any][]) {
    const typedUser = user as any;

    if (typedUser.status !== "waiting") continue;

    await dbAdmin.ref(`queues/${queue.id}/users/${key}`).update({
      station_id: firstStationId,
    });
  }
}
