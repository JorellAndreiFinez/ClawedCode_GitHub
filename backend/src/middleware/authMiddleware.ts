import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../firebaseAdmin";

export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = await authAdmin.verifyIdToken(token);

    req.body.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
