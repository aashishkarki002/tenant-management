import app from "./app.js";
import "./modules/rents/rentScheduler.js";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { startOverDueRentCron } from "./cron/overDueRent.cron.js";
dotenv.config();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Authorization"],
  },
});
io.on("connection", (socket) => {
  console.log("A user connected");
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.io is running on port ${PORT}`);
  // Start cron jobs after server and io are initialized
  startOverDueRentCron(io);
});
