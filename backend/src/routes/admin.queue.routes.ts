import { Router } from "express";
import { dbAdmin } from "../firebaseAdmin";
import { verifyToken } from "../middleware/authMiddleware";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

const COOLDOWN_MS = 20 * 60 * 1000;

/**
 * =====================================================
 * GET NEXT USER (FIFO SAFE + PAUSE AWARE)
 * =====================================================
 */
router.post("/:queueId/:stationId/next", verifyToken, async (req, res) => {
  try {
    const { queueId, stationId } = req.params;

    const queueRef = dbAdmin.ref(`queues/${queueId}`);
    const snap = await queueRef.once("value");
    const queue = snap.val();

    if (!queue) return res.status(404).json({ error: "Queue not found" });

    if (queue?.stations?.[stationId]?.status === "paused") {
      return res.status(400).json({ error: "Station is paused" });
    }

    const users = queue.users || {};

    const waiting = Object.entries(users)
      .map(([id, u]: any) => ({ id, ...u }))
      .filter((u) => u.status === "waiting")
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    if (!waiting.length) {
      return res.json({ success: false, message: "No waiting users" });
    }

    const nextUser = waiting[0];

    await queueRef.child(`users/${nextUser.id}`).update({
      status: "called",
      station_id: stationId,
      service_start_at: Date.now(),
    });

    await queueRef.child(`stations/${stationId}/queue_state`).update({
      current_serving_user_id: nextUser.id,
      serving_ticket_number: nextUser.ticket_number,
    });

    return res.json({ success: true, nextUser });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =====================================================
 * SKIP (NO DUPLICATION, NO REBUILD, ONLY POSITION SHIFT)
 * =====================================================
 */
router.post("/:queueId/:stationId/skip", verifyToken, async (req, res) => {
  try {
    const { queueId, stationId } = req.params;

    const queueRef = dbAdmin.ref(`queues/${queueId}`);
    const snap = await queueRef.once("value");
    const queue = snap.val();

    if (!queue) {
      return res.status(404).json({ error: "Queue not found" });
    }

    const currentUserId =
      queue?.stations?.[stationId]?.queue_state?.current_serving_user_id;

    if (!currentUserId) {
      return res.status(400).json({ error: "No active user" });
    }

    const users = queue.users || {};

    /**
     * STEP 1: CLEAR STATION ONLY
     */
    await queueRef.child(`stations/${stationId}/queue_state`).update({
      current_serving_user_id: null,
      serving_ticket_number: null,
    });

    /**
     * STEP 2: FIND MAX POSITION (SAFE)
     */
    const maxPosition = Math.max(
      ...Object.values(users)
        .filter((u: any) => u.status === "waiting")
        .map((u: any) => u.position || 0),
      0,
    );

    /**
     * STEP 3: MOVE USER TO BACK
     * ONLY ONE USER UPDATED (NO DUPES POSSIBLE)
     */
    await queueRef.child(`users/${currentUserId}`).update({
      status: "waiting",
      station_id: null,
      position: maxPosition + 1,
    });

    return res.json({
      success: true,
      message: "User moved to back of queue",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =====================================================
 * NO SHOW (DOES NOT AFFECT FIFO)
 * =====================================================
 */
router.post("/:queueId/:stationId/no-show", verifyToken, async (req, res) => {
  try {
    const { queueId, stationId } = req.params;

    const queueRef = dbAdmin.ref(`queues/${queueId}`);
    const snap = await queueRef.once("value");
    const queue = snap.val();

    if (!queue) return res.status(404).json({ error: "Queue not found" });

    const currentUserId =
      queue?.stations?.[stationId]?.queue_state?.current_serving_user_id;

    if (!currentUserId) {
      return res.status(400).json({ error: "No active user" });
    }

    const user = queue.users?.[currentUserId];

    const expires_at = Date.now() + COOLDOWN_MS;

    // 1. clear station
    await queueRef.child(`stations/${stationId}/queue_state`).update({
      current_serving_user_id: null,
      serving_ticket_number: null,
    });

    // 2. move to no_shows
    await queueRef.child(`no_shows/${currentUserId}`).set({
      ...user,
      status: "noshow",
      station_id: stationId,
      expires_at,
      moved_at: Date.now(),
    });

    // 3. REMOVE from users (IMPORTANT)
    await queueRef.child(`users/${currentUserId}`).remove();

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post(
  "/:queueId/no-show/:userId/return",
  verifyToken,
  async (req, res) => {
    try {
      const { queueId, userId } = req.params;

      const queueRef = dbAdmin.ref(`queues/${queueId}`);

      const snap = await queueRef.once("value");
      const queue = snap.val();

      if (!queue) {
        return res.status(404).json({ error: "Queue not found" });
      }

      const noShowSnap = await queueRef
        .child(`no_shows/${userId}`)
        .once("value");
      const noShowUser = noShowSnap.val();

      if (!noShowUser) {
        return res.status(404).json({
          error: "User not found in no-show list",
        });
      }

      const users = queue.users || {};

      // ✅ find last waiting position
      const waitingUsers = Object.entries(users)
        .map(([id, u]: any) => ({ id, ...u }))
        .filter((u) => u.status === "waiting")
        .sort((a, b) => (a.position || 0) - (b.position || 0));

      const maxPosition = waitingUsers.length
        ? waitingUsers[waitingUsers.length - 1].position || 0
        : 0;

      const newPosition = maxPosition + 1;

      // =====================================================
      // 1. restore user back to queue
      // =====================================================
      await queueRef.child(`users/${userId}`).set({
        ...noShowUser,
        status: "waiting",
        station_id: null,
        position: newPosition,
        returned_from_no_show: true,
        restored_at: Date.now(),
      });

      // =====================================================
      // 2. remove from no_shows
      // =====================================================
      await queueRef.child(`no_shows/${userId}`).remove();

      return res.json({
        success: true,
        message: "User returned to queue successfully",
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message,
      });
    }
  },
);

/**
 * =====================================================
 * PAUSE STATION (FIXED)
 * =====================================================
 */
router.post("/:queueId/:stationId/pause", verifyToken, async (req, res) => {
  try {
    const { queueId, stationId } = req.params;

    const queueRef = dbAdmin.ref(`queues/${queueId}`);
    const snap = await queueRef.once("value");
    const queue = snap.val();

    if (!queue) {
      return res.status(404).json({ error: "Queue not found" });
    }

    const stations = queue.stations || {};
    const users = queue.users || {};

    const currentUserId =
      stations?.[stationId]?.queue_state?.current_serving_user_id;

    // 1. mark station as paused
    await queueRef.child(`stations/${stationId}`).update({
      status: "paused",
    });

    // 2. no active user → done
    if (!currentUserId) {
      return res.json({
        success: true,
        message: "Station paused (no active user to transfer)",
      });
    }

    const user = users[currentUserId];

    // 3. find another available active station
    const targetStation = Object.values(stations).find((s: any) => {
      return (
        s.id !== stationId &&
        s.status === "active" &&
        !s.queue_state?.current_serving_user_id
      );
    }) as any;

    /**
     * =====================================================
     * CASE 1: TRANSFER USER TO ANOTHER STATION
     * =====================================================
     */
    if (targetStation) {
      await queueRef.child(`users/${currentUserId}`).update({
        station_id: targetStation.id,
        status: "called",
      });

      await queueRef.child(`stations/${targetStation.id}/queue_state`).update({
        current_serving_user_id: currentUserId,
        serving_ticket_number: user.ticket_number,
      });

      await queueRef.child(`stations/${stationId}/queue_state`).update({
        current_serving_user_id: null,
        serving_ticket_number: null,
      });

      return res.json({
        success: true,
        message: "User transferred to another active station",
        transferredTo: targetStation.id,
        userId: currentUserId,
      });
    }

    /**
     * =====================================================
     * CASE 2: NO AVAILABLE STATION → PROPER REQUEUE (FIFO FIXED)
     * =====================================================
     */

    // mark user back to waiting (NO position hack)
    await queueRef.child(`users/${currentUserId}`).update({
      status: "waiting",
      station_id: null,
      service_start_at: null,
    });

    // clear station
    await queueRef.child(`stations/${stationId}/queue_state`).update({
      current_serving_user_id: null,
      serving_ticket_number: null,
    });

    // rebuild FIFO order safely
    const updatedSnap = await queueRef.child("users").once("value");
    const updatedUsers = updatedSnap.val() || {};

    const waiting = Object.entries(updatedUsers)
      .map(([id, u]: any) => ({ id, ...u }))
      .filter((u) => u.status === "waiting")
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    // move paused user to FRONT of queue
    const reordered = [
      waiting.find((u) => u.id === currentUserId),
      ...waiting.filter((u) => u.id !== currentUserId),
    ].filter(Boolean);

    let pos = 1;
    for (const u of reordered) {
      await queueRef.child(`users/${u.id}`).update({
        position: pos++,
      });
    }

    return res.json({
      success: true,
      message:
        "No available station — user returned to queue (reinserted FIFO front)",
      userId: currentUserId,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =====================================================
 * RESUME STATION (FIXED)
 * =====================================================
 */
/**
 * =====================================================
 * RESUME STATION (FIXED)
 * =====================================================
 */
router.post("/:queueId/:stationId/resume", verifyToken, async (req, res) => {
  try {
    const { queueId, stationId } = req.params;

    const queueRef = dbAdmin.ref(`queues/${queueId}`);
    const stationRef = queueRef.child(`stations/${stationId}`);

    const snap = await stationRef.once("value");
    const station = snap.val();

    if (!station) {
      return res.status(404).json({ error: "Station not found" });
    }

    // 1. Reactivate station ONLY
    await stationRef.update({
      status: "active",
    });

    // 2. IMPORTANT: DO NOT auto-assign user
    // clear any stale serving pointer just in case
    await stationRef.child("queue_state").update({
      current_serving_user_id: null,
      serving_ticket_number: null,
    });

    return res.json({
      success: true,
      message: "Station resumed (no auto-serve triggered)",
      station: {
        ...station,
        status: "active",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =====================================================
 * QR SCAN VERIFY → CONFIRM SERVING
 * =====================================================
 * scannedUserId must match next queued user
 */
router.post(
  "/:queueId/:stationId/verify-scan",
  verifyToken,
  async (req, res) => {
    try {
      const { queueId, stationId } = req.params;
      const { scannedUserId } = req.body;

      const queueRef = dbAdmin.ref(`queues/${queueId}`);
      const snap = await queueRef.once("value");
      const queue = snap.val();

      if (!queue) return res.status(404).json({ error: "Queue not found" });

      const users = queue.users || {};

      // find scanned user directly
      const scannedUser = users[scannedUserId];

      if (!scannedUser) {
        return res.status(404).json({
          error: "User not found in queue",
        });
      }

      if (scannedUser.status !== "called") {
        return res.status(400).json({
          error: "User must be called first (press NEXT)",
        });
      }

      // OPTIONAL: ensure correct station flow (if needed)
      if (scannedUser.station_id && scannedUser.station_id !== stationId) {
        return res.status(400).json({
          error: "User assigned to different station",
        });
      }

      await queueRef.child(`users/${scannedUserId}`).update({
        status: "serving",
        station_id: stationId,
        service_start_at: Date.now(),
      });

      await queueRef.child(`stations/${stationId}/queue_state`).update({
        current_serving_user_id: scannedUserId,
        serving_ticket_number: scannedUser.ticket_number,
      });

      return res.json({
        success: true,
        message: "User verified and now serving",
        user: {
          id: scannedUserId,
          ...scannedUser,
          status: "serving",
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
);

router.post("/:queueId/:stationId/finish", verifyToken, async (req, res) => {
  try {
    const { queueId, stationId } = req.params;

    const queueRef = dbAdmin.ref(`queues/${queueId}`);
    const snap = await queueRef.once("value");
    const queue = snap.val();

    if (!queue) {
      return res.status(404).json({ error: "Queue not found" });
    }

    const currentUserId =
      queue?.stations?.[stationId]?.queue_state?.current_serving_user_id;

    if (!currentUserId) {
      return res.status(400).json({ error: "No active user" });
    }

    const now = Date.now();

    // =====================================================
    // 1. FETCH USER SAFELY
    // =====================================================
    const userSnap = await queueRef
      .child(`users/${currentUserId}`)
      .once("value");
    const user = userSnap.val();

    if (!user) {
      return res.status(404).json({ error: "User not found in queue" });
    }

    const serviceTimeMs = user?.service_start_at
      ? now - user.service_start_at
      : 0;

    const serviceTimeMin = serviceTimeMs / 60000;

    // =====================================================
    // 2. REMOVE FROM LIVE QUEUE
    // =====================================================
    await queueRef.child(`users/${currentUserId}`).remove();

    // =====================================================
    // 3. CLEAR STATION
    // =====================================================
    await queueRef.child(`stations/${stationId}/queue_state`).update({
      current_serving_user_id: null,
      serving_ticket_number: null,
    });

    // =====================================================
    // 4. WRITE TO HISTORY (FOR AUDIT + ANALYTICS DRILLDOWN)
    // =====================================================
    await queueRef.child(`history/${currentUserId}`).set({
      ...user,
      status: "completed",
      service_end_at: now,
      service_end_at_iso: new Date(now).toISOString(),
      service_duration_ms: serviceTimeMs,
      station_id: null,
    });

    // =====================================================
    // 5. UPDATE ANALYTICS (SAFE AGGREGATION)
    // =====================================================
    const analyticsRef = queueRef.child("analytics");
    const analyticsSnap = await analyticsRef.once("value");
    const analytics = analyticsSnap.val() || {};

    const prevTotal = analytics.total_served || 0;
    const prevAvg = analytics.avg_service_time || 0;

    const newTotal = prevTotal + 1;

    const newAvg =
      newTotal === 1
        ? serviceTimeMin
        : (prevAvg * prevTotal + serviceTimeMin) / newTotal;

    await analyticsRef.update({
      total_served: newTotal,
      avg_service_time: newAvg,
    });

    // =====================================================
    // 6. OPTIONAL: LIVE STATE UPDATE (RECOMMENDED)
    // =====================================================
    await queueRef.child("queue_state").update({
      total_completed: (queue.queue_state?.total_completed || 0) + 1,
      total_serving: Math.max((queue.queue_state?.total_serving || 1) - 1, 0),
    });

    return res.json({
      success: true,
      message: "User completed successfully",
      service_time_ms: serviceTimeMs,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =====================================================
 * REORDER LIVE QUEUE
 * =====================================================
 */
router.post("/:queueId/reorder", verifyToken, async (req, res) => {
  try {
    const { queueId } = req.params;
    const { orderedUserIds } = req.body;

    if (!Array.isArray(orderedUserIds)) {
      return res.status(400).json({
        error: "orderedUserIds must be an array",
      });
    }

    const queueRef = dbAdmin.ref(`queues/${queueId}`);

    const snap = await queueRef.child("users").once("value");
    const users = snap.val() || {};

    /**
     * ONLY REORDER WAITING USERS
     */
    const waitingUsers = Object.entries(users)
      .map(([id, u]: any) => ({
        id,
        ...u,
      }))
      .filter((u) => u.status === "waiting");

    /**
     * VALIDATE IDS
     */
    const waitingIds = waitingUsers.map((u) => u.id);

    const invalidIds = orderedUserIds.filter(
      (id: string) => !waitingIds.includes(id),
    );

    if (invalidIds.length) {
      return res.status(400).json({
        error: "Invalid waiting user ids",
        invalidIds,
      });
    }

    /**
     * UPDATE POSITIONS
     */
    let position = 1;

    for (const userId of orderedUserIds) {
      await queueRef.child(`users/${userId}`).update({
        position: position++,
      });
    }

    return res.json({
      success: true,
      message: "Queue reordered successfully",
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message,
    });
  }
});

router.get("/me", requireAdmin, async (req, res) => {
  try {
    const user = (req as any).user;

    // 1. find establishment
    const estSnap = await dbAdmin
      .ref("establishments")
      .orderByChild("admin_id")
      .equalTo(user.uid)
      .once("value");

    const establishments = estSnap.val();

    if (!establishments) {
      return res.status(404).json({
        error: "Establishment not found",
      });
    }

    const establishment = Object.values(establishments)[0] as any;

    // 2. get queue
    const queueId = establishment.queue_id;

    const queueSnap = await dbAdmin.ref(`queues/${queueId}`).once("value");

    const queue = queueSnap.val();

    return res.json({
      establishment,
      queue,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message,
    });
  }
});

export default router;
