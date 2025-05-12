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

const userSockets = new Map();       // userId => Set of socketIds
const socketGroups = new Map();  
const app = express();
const server = http.createServer(app); // Create a separate HTTP server
const io = new Server(server, {
  cors: {
    origin: "*", // update this if needed
  },
});

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  const rawGroups = socket.handshake.query.groups || "";
  const groups = rawGroups.split(",").filter(Boolean); // parse groups from query

  console.log(`User ${userId} connected with socket ${socket.id} to groups [${groups.join(", ")}]`);

  // Track user's sockets
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);

  // Track this socket's group memberships
  socketGroups.set(socket.id, new Set(groups));

  // Join socket to rooms and notify groups
  for (const groupId of groups) {
    socket.join(groupId);
    io.to(groupId).emit("user-online", { userId });
  }
   socket.on('heartbeat', () => {
    console.log(`Heartbeat received from ${userId}`);
   
    // Optionally emit a user-online event here
    if(userSockets.has(userId)){
       io.emit('user-online', { userId });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket ${socket.id} disconnected for user ${userId}`);

    const groups = socketGroups.get(socket.id) || new Set();

    // Remove this socket from the user's set
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) { 
        userSockets.delete(userId);
      }
    }

    // Notify each group if no more sockets exist for this user in that group
    for (const groupId of groups) {
      const stillInGroup = Array.from(userSockets.get(userId) || []).some((sid) => {
        const sGroups = socketGroups.get(sid);
        return sGroups && sGroups.has(groupId);
      });

      if (!stillInGroup) {
        io.to(groupId).emit("user-offline", { userId });
      }
    }

    socketGroups.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
// job.start();
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

export { io,socketGroups,userSockets };