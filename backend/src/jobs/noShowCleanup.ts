import { dbAdmin } from "../firebaseAdmin";

const COOLDOWN_MS = 20 * 60 * 1000;

export const cleanupNoShows = async () => {
  const queuesSnap = await dbAdmin.ref("queues").once("value");
  const queues = queuesSnap.val() || {};

  for (const queueId of Object.keys(queues)) {
    const noShows = queues[queueId]?.no_shows || {};

    for (const userId of Object.keys(noShows)) {
      const user = noShows[userId];

      if (user.expires_at && Date.now() > user.expires_at) {
        const queueRef = dbAdmin.ref(`queues/${queueId}`);

        await queueRef.child(`no_shows/${userId}`).update({
          status: "cancelled",
          cancelled_at: Date.now(),
        });

        await queueRef.child(`history/${userId}`).set({
          ...user,
          status: "cancelled",
          service_end_at: Date.now(),
        });

        // update user status
        await queueRef.child(`users/${userId}`).update({
          status: "cancelled",
        });

        // OPTIONAL: reflow queue positions
        const usersSnap = await queueRef.child("users").once("value");
        const users = usersSnap.val() || {};

        const waiting = Object.entries(users)
          .map(([id, u]: any) => ({ id, ...u }))
          .filter((u) => u.status === "waiting")
          .sort((a, b) => (a.position || 0) - (b.position || 0));

        let pos = 1;
        for (const u of waiting) {
          await queueRef.child(`users/${u.id}`).update({
            position: pos++,
          });
        }
      }
    }
  }
};
