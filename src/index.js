import express from "express";
import http from "http";
import { Server } from "socket.io";
import "dotenv/config";
import cors from "cors";
import job from "./lib/cron.js";

import authRoutes from "./routes/authRoutes.js";
import { connectDB } from "./lib/db.js";
import groupRoutes from "./routes/groupRoutes.js";
import detectedSoundRoutes from "./routes/detectedSoundRoutes.js";


import DetectedSound from './models/DetectedSound.js';


const userSockets = {};
const app = express();
const server = http.createServer(app); // Create a separate HTTP server
const io = new Server(server, {
  cors: {
    origin: "*", // update this if needed
  },
});

io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    console.log(`User ${userId} connected with socket ID ${socket.id}`);
  
    userSockets[userId] = socket.id;
  
    socket.on("disconnect", () => {
      delete userSockets[userId];
      console.log(`User ${userId} disconnected`);
    });
  });

const PORT = process.env.PORT || 3000;
job.start();
app.use(express.json());
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/group", groupRoutes);
app.use("/api/detectedSound", detectedSoundRoutes);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectDB();
});





setInterval(async () => {
  try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const result = await DetectedSound.deleteMany({
          createdAt: { $lt: oneHourAgo }
      });

      console.log(`${result.deletedCount} old detected sounds deleted automatically.`);
  } catch (error) {
      console.error('Error during automatic cleanup of old detected sounds:', error);
  }
}, 60 * 60 * 1000); // Run every hour (60 minutes)
