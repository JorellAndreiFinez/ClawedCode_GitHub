import { Router } from "express";
import { authAdmin, dbAdmin } from "../firebaseAdmin";

const router = Router();

// REGISTER USER (IMPORTANT)
router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 1. create auth user
    const userRecord = await authAdmin.createUser({
      email,
      password,
      displayName: fullName,
    });

    // 2. store in database
    await dbAdmin.ref(`users/${userRecord.uid}`).set({
      uid: userRecord.uid,
      fullName,
      email,
      role, // "user" | "admin" (owner)
      establishment_completed: role === "admin" ? false : null,
      createdAt: Date.now(),
    });

    return res.json({
      uid: userRecord.uid,
      email,
      role,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Registration failed",
    });
  }
});

// LOGOUT
router.post("/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];

    if (token) {
      try {
        const decoded = await authAdmin.verifyIdToken(token);
        await authAdmin.revokeRefreshTokens(decoded.uid);
      } catch (err) {
        console.log("Token invalid during logout, skipping revoke");
      }
    }

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Logout failed",
    });
  }
});

// verify token (basic middleware-ready endpoint)
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];

    if (!token) return res.status(401).json({ error: "No token" });

    const decoded = await authAdmin.verifyIdToken(token);

    const userSnap = await dbAdmin.ref(`users/${decoded.uid}`).get();

    res.json({
      uid: decoded.uid,
      ...userSnap.val(),
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
