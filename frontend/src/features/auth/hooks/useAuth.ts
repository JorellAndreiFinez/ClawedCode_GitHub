import { useEffect, useState } from "react";
import { listenAuth } from "@/lib/auth";
import { ref, get } from "firebase/database";
import { db } from "@/lib/firebase";
import type { User } from "firebase/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenAuth(async (u) => {
      setUser(u);

      if (u) {
        const snap = await get(ref(db, `users/${u.uid}`));

        if (snap.exists()) {
          setProfile(snap.val());
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  return {
    user,
    profile,
    loading,
  };
}
