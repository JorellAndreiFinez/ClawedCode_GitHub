import { ref, push, set } from "firebase/database";
import { db } from "./firebase";

// Join queue
export async function joinQueue(stationId: string, user: any) {
  const queueRef = ref(db, `queues/${stationId}/users`);

  const newUserRef = push(queueRef);

  await set(newUserRef, {
    userId: user.id,
    name: user.name,
    status: "waiting",
    timestamp: Date.now(),
  });
}
