import { Request, Response, NextFunction } from "express";
import { dbAdmin } from "../firebaseAdmin";

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as any).user;

    const snap = await dbAdmin.ref(`users/${user.uid}`).once("value");
    const profile = snap.val();

    if (profile?.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    (req as any).profile = profile;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Unauthorized admin access" });
  }
}
