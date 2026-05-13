import { ref, get } from "firebase/database";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { apiFetch } from "./api";

import { auth, db } from "./firebase";

export type Role = "user" | "admin";

export async function register(
  fullName: string,
  email: string,
  password: string,
  role: Role,
) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName,
      email,
      password,
      role,
    }),
  });
}
export async function login(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  const snapshot = await get(ref(db, `users/${cred.user.uid}`));

  if (!snapshot.exists()) {
    throw new Error("User profile not found in database");
  }

  return {
    user: cred.user,
    profile: snapshot.val(),
  };
}

// LOGOUT
export async function logout() {
  const user = auth.currentUser;

  if (user) {
    const token = await user.getIdToken();

    // backend logout
    await apiFetch("/auth/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  // firebase client logout
  return signOut(auth);
}

// GET ROLE
export async function getUserRole(uid: string) {
  const snapshot = await get(ref(db, `users/${uid}`));
  return snapshot.exists() ? snapshot.val().role : null;
}

// LISTENER
export function listenAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
