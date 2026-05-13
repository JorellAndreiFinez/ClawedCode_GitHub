import { dbAdmin } from "../firebaseAdmin";

export async function cleanupCooldowns() {
  const snap = await dbAdmin.ref("queues").once("value");
  const queues = snap.val() || {};
  const now = Date.now();

  for (const [qid, queue] of Object.entries(queues) as any) {
    const noShows = queue.no_shows || {};

    for (const [uid, user] of Object.entries(noShows) as any) {
      if (user.expires_at <= now) {
        await dbAdmin.ref(`queues/${qid}/no_shows/${uid}`).update({
          status: "cancelled",
        });
      }
    }
  }
}
