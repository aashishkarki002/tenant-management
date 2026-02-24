// test-socket-client.mjs
import { io } from "socket.io-client";

const ADMIN_ID = "6970b43f562f924f2df0967e";
const socket = io("http://localhost:3000", { withCredentials: true });

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);
  socket.emit("join:admin", ADMIN_ID); // join the room your server targets
  console.log(`👂 Listening on room admin:${ADMIN_ID} ...`);
});

socket.on("new-notification", (data) => {
  console.log("🔔 Notification received:", JSON.stringify(data, null, 2));
  socket.disconnect();
  process.exit(0);
});

socket.on("connect_error", (err) => {
  console.error("❌ Connection failed:", err.message);
  process.exit(1);
});
