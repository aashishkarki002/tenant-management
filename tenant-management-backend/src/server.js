import app from "./app.js";
import http from "http";
import { initializeSocket } from "./config/socket.js";

// Load dotenv ONLY in local/dev
if (process.env.NODE_ENV !== "production") {
  const dotenv = await import("dotenv");
  dotenv.config();
}

const PORT = process.env.PORT || 3000;
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("MONGO_URI loaded:", !!process.env.MONGO_URI);
console.log("SMTP_HOST loaded:", !!process.env.SMTP_HOST);

const server = http.createServer(app);
initializeSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.io is running on port ${PORT}`);
});
