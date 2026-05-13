import { Router } from "express";
import { dbAdmin } from "../firebaseAdmin";
import { verifyToken } from "../middleware/authMiddleware";

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
      status: "serving",
      station_id: stationId,
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

    const expires_at = Date.now() + NO_SHOW_MS;

    // 1. clear station
    await queueRef.child(`stations/${stationId}/queue_state`).update({
      current_serving_user_id: null,
      serving_ticket_number: null,
    });

    // 2. move to no_shows table
    await queueRef.child(`no_shows/${currentUserId}`).set({
      ...user,
      status: "no_show",
      station_id: stationId,
      position: null,
      expires_at,
      moved_at: Date.now(),
    });

    // 3. remove from users
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

      if (!queue) return res.status(404).json({ error: "Queue not found" });

      const noShowUser = queue.no_shows?.[userId];

      if (!noShowUser) {
        return res
          .status(404)
          .json({ error: "User not found in no-show list" });
      }

      const users = queue.users || {};

      // find last position
      const maxPosition =
        Math.max(
          ...Object.values(users)
            .filter((u: any) => u.status === "waiting")
            .map((u: any) => u.position || 0),
        ) || 0;

      // 1. move back to users
      await queueRef.child(`users/${userId}`).set({
        ...noShowUser,
        status: "waiting",
        station_id: null,
        position: maxPosition + 1,
        returned_from_no_show: true,
      });

      // 2. remove from no_show table
      await queueRef.child(`no_shows/${userId}`).remove();

      return res.json({
        success: true,
        message: "User returned to queue",
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
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

    const ref = dbAdmin.ref(`queues/${queueId}/stations/${stationId}`);

    await ref.update({ status: "paused" });

    const snap = await ref.once("value");

    return res.json({
      success: true,
      station: snap.val(),
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
router.post("/:queueId/:stationId/resume", verifyToken, async (req, res) => {
  try {
    const { queueId, stationId } = req.params;

    const ref = dbAdmin.ref(`queues/${queueId}/stations/${stationId}`);

    await ref.update({ status: "active" });

    const snap = await ref.once("value");

    return res.json({
      success: true,
      station: snap.val(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
