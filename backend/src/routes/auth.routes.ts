import { Router } from "express";
import { authAdmin, dbAdmin } from "../firebaseAdmin";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

// REGISTER USER
router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const userRecord = await authAdmin.createUser({
      email,
      password,
      displayName: fullName,
    });

    await dbAdmin.ref(`users/${userRecord.uid}`).set({
      uid: userRecord.uid,
      fullName,
      email,
      role,
      establishment_completed: role === "admin" ? false : null,
      createdAt: Date.now(),
      updated_at: Date.now(),
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

// GET MY ESTABLISHMENT + QUEUE
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // FIND ESTABLISHMENT
    const snapshot = await dbAdmin
      .ref("establishments")
      .orderByChild("admin_id")
      .equalTo(user.uid)
      .once("value");

    const establishments = snapshot.val();

    if (!establishments) {
      return res.status(404).json({
        error: "No establishment found",
      });
    }

    // GET FIRST ESTABLISHMENT
    const establishment = Object.values(establishments)[0] as any;

    // GET QUEUE
    let queue = null;

    if (establishment.queue_id) {
      const queueSnap = await dbAdmin
        .ref(`queues/${establishment.queue_id}`)
        .once("value");

      queue = queueSnap.val();
    }

    // MERGE RESPONSE
    return res.json({
      ...establishment,
      queue,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Failed to fetch establishment",
    });
  }
});

export default router;
