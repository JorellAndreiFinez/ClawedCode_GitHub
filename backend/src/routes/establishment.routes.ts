import { Router } from "express";
import { dbAdmin } from "../firebaseAdmin";

const router = Router();

// CREATE ESTABLISHMENT
router.post("/", async (req, res) => {
  try {
    const user = req.body.user;

    const { name, work_email, location, queue_capacity, working_hours } =
      req.body;

    const ref = dbAdmin.ref("establishments").push();

    await ref.set({
      id: ref.key,
      admin_id: user.uid,
      name,
      work_email,
      location,
      queue_capacity,
      service_time: 3,
      status: "active",
      working_hours,
      queue_settings: {
        allow_remote_join: true,
        priority_enabled: true,
        qr_required: true,
      },
      analytics: {
        total_customers: 0,
        avg_wait_time: 0,
      },
      createdAt: Date.now(),
    });

    // mark admin as completed
    await dbAdmin.ref(`users/${user.uid}`).update({
      establishment_completed: true,
    });

    res.json({ success: true, id: ref.key });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
