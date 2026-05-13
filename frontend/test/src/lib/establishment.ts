import { apiFetch } from "./api";
import { auth } from "./firebase";

export async function createEstablishment(data: any) {
  return new Promise((resolve, reject) => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      unsub();

      try {
        if (!user) return reject(new Error("Not authenticated"));

        const token = await user.getIdToken(true);

        const res = await apiFetch("/establishments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        });

        resolve(res);
      } catch (err) {
        reject(err);
      }
    });
  });
}
