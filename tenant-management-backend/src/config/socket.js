import { Server } from "socket.io";

let io = null;

export const initializeSocket = (server) => {
  if (io) return io; // already initialized

  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      exposedHeaders: ["Authorization"],
    },
  });

  io.on("connection", (socket) => {
    console.log("[socket] client connected:", socket.id);

    socket.on("join:admin", (adminId) => {
      if (!adminId) return;
      const room = `admin:${adminId}`;
      socket.join(room);
      console.log(`[socket] ${socket.id} joined room ${room}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(
        `[socket] client disconnected: ${socket.id} — reason: ${reason}`,
      );
    });
  });

  return io;
};

// Use this in your controllers/services instead of calling getIO() manually.
// Example: emitNotification(userId, savedNotification)
export const emitNotification = (userId, notification) => {
  if (!io) {
    console.warn(
      "[socket] emitNotification called before socket was initialized",
    );
    return;
  }
  io.to(`admin:${userId}`).emit("new-notification", { notification });
};

export const getIO = () => {
  if (!io)
    throw new Error(
      "[socket] Socket.io has not been initialized. Call initializeSocket(server) first.",
    );
  return io;
};
