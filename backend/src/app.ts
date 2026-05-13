import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import establishmentRoutes from "./routes/establishment.routes";
import { verifyToken } from "./middleware/authMiddleware";
import adminQueueRoutes from "./routes/admin.queue.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "LINEA backend running" });
});

app.use("/auth", authRoutes);

app.use("/establishments", verifyToken, establishmentRoutes);

app.use("/admin/queues", verifyToken, adminQueueRoutes);

export default app;
