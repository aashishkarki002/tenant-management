import io from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"],
});

if (import.meta.env.DEV) {
  socket.on("connect", () => {
    console.log("[socket] connected:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.warn("[socket] connection error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected — reason:", reason);
  });
}
