import { Router } from "express";
import { dbAdmin } from "../firebaseAdmin";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      name,
      work_email,
      location,
      queue_capacity,
      working_hours,
      stations = [],
    } = req.body;

    const now = Date.now();

    /**
     * ----------------------------------------
     * Convert stations array → object map
     * ----------------------------------------
     */
    const stationsObject: Record<string, any> = {};

    stations.forEach((s: any, index: number) => {
      const stationId = `station_${index + 1}`;

      stationsObject[stationId] = {
        id: stationId,
        name: s.name || `Station ${index + 1}`,
        service_type: s.service_type || "regular",
        status: "active",

        // computed later, so no avg input dependency
        avg_service_time: null,

        current_session_id: null,
        current_user_id: null,

        last_called_at: null,
        queue_ids: [],
        created_at: now,
      };
    });

    /**
     * ----------------------------------------
     * Create establishment
     * ----------------------------------------
     */
    const estRef = dbAdmin.ref("establishments").push();

    /**
     * ----------------------------------------
     * Create queue (1:1)
     * ----------------------------------------
     */
    const queueRef = dbAdmin.ref("queues").push();

    await queueRef.set({
      id: queueRef.key,
      establishment_id: estRef.key,

      status: "active",

      /**
       * ----------------------------------------
       * SETTINGS (CONFIG ONLY)
       * ----------------------------------------
       */
      settings: {
        average_service_time: 3,
        cutoff_time: null,

        allow_remote_join: true,
        auto_transfer_enabled: true,
        priority_enabled: true,

        max_capacity: queue_capacity,

        crowd_thresholds: {
          low: 0.3,
          moderate: 0.7,
          high: 1.0,
        },
      },

      /**
       * ----------------------------------------
       * STATIONS (DYNAMIC)
       * ----------------------------------------
       */
      stations: stationsObject,

      /**
       * ----------------------------------------
       * QUEUE STATE
       * ----------------------------------------
       */
      queue_state: {
        current_ticket_number: 0,
        serving_ticket_number: null,

        current_serving_user_id: null,

        total_waiting: 0,
        total_serving: 0,
        total_skipped: 0,
        total_completed: 0,
      },

      /**
       * ----------------------------------------
       * USERS (EMPTY INIT)
       * ----------------------------------------
       */
      users: {},

      /**
       * ----------------------------------------
       * ANALYTICS (EMPTY INIT)
       * ----------------------------------------
       */
      analytics: {
        avg_wait_time: 0,
        avg_service_time: 0,

        total_served: 0,
        total_no_show: 0,

        peak_hours: {},
      },

      /**
       * ----------------------------------------
       * LIVE STATE (REALTIME UI)
       * ----------------------------------------
       */
      live_state: {
        crowd_level: "low",
        crowd_score: 0,

        estimated_wait_time_avg: 0,
        last_updated: now,

        active_users_count: 0,
      },

      created_at: now,
      updated_at: now,
    });

    /**
     * ----------------------------------------
     * ESTABLISHMENT RECORD
     * ----------------------------------------
     */
    await estRef.set({
      id: estRef.key,
      admin_id: user.uid,

      name,
      work_email,
      location,

      queue_capacity,
      working_hours,

      queue_id: queueRef.key,

      status: "active",

      created_at: now,
      updated_at: now,
    });

    /**
     * ----------------------------------------
     * USER STATUS UPDATE
     * ----------------------------------------
     */
    await dbAdmin.ref(`users/${user.uid}`).update({
      establishment_completed: true,
    });

    return res.json({
      success: true,
      establishment_id: estRef.key,
      queue_id: queueRef.key,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Failed to create establishment",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const {
      name,
      location,
      work_email,
      queue_capacity,
      working_hours,
      stations,
    } = req.body;

    const estRef = dbAdmin.ref(`establishments/${id}`);
    const estSnap = await estRef.once("value");
    const establishment = estSnap.val();

    if (!establishment) {
      return res.status(404).json({ error: "Establishment not found" });
    }

    // ensure owner
    if (establishment.admin_id !== user.uid) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const now = Date.now();

    /**
     * UPDATE ESTABLISHMENT
     */
    const updates: any = {
      updated_at: now,
    };

    if (name !== undefined) updates.name = name;
    if (location !== undefined) updates.location = location;
    if (work_email !== undefined) updates.work_email = work_email;
    if (queue_capacity !== undefined) updates.queue_capacity = queue_capacity;
    if (working_hours !== undefined) updates.working_hours = working_hours;

    await estRef.update(updates);

    /**
     * SYNC QUEUE (important)
     */
    const queueId = establishment.queue_id;
    if (queueId) {
      const queueRef = dbAdmin.ref(`queues/${queueId}`);

      const queueSnap = await queueRef.once("value");
      const queue = queueSnap.val();

      const queueUpdates: any = {};

      if (queue_capacity !== undefined) {
        queueUpdates["settings/max_capacity"] = queue_capacity;
      }

      /**
       * OPTIONAL: sync stations if provided
       */
      if (stations) {
        const stationMap: Record<string, any> = {};

        stations.forEach((s: any, index: number) => {
          const stationId = s.id || `station_${index + 1}`;

          stationMap[stationId] = {
            id: stationId,
            name: s.name || `Station ${index + 1}`,
            service_type: s.service_type || "regular",
            status: s.status || "active",
            created_at: now,
          };
        });

        queueUpdates["stations"] = stationMap;
      }

      if (Object.keys(queueUpdates).length > 0) {
        await queueRef.update(queueUpdates);
      }
    }

    return res.json({
      success: true,
      message: "Establishment updated successfully",
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Failed to update establishment",
    });
  }
});

export default router;
