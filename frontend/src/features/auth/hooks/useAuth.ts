import { useEffect, useState } from "react";
import { listenAuth, getUserRole } from "@/lib/auth";
import type { User } from "firebase/auth";
import type { Role } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenAuth(async (u) => {
      setUser(u);

      if (u) {
        const r = await getUserRole(u.uid);
        setRole(r as Role);
      } else {
        setRole(null);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { user, role, loading };
}
