import app from "./app.js";
import http from "http";
import { connectDB } from "./config/db.js";
import { initializeSocket } from "./config/socket.js";
import { initializeWebPush } from "./config/webpush.js";

const PORT = process.env.PORT || 3000;
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("DB URI loaded:", !!(process.env.MONGODB_URI || process.env.MONGO_URI));
console.log("SMTP_HOST loaded:", !!process.env.SMTP_HOST);

const server = http.createServer(app);
initializeSocket(server);
initializeWebPush();

// Wait for MongoDB before accepting requests (avoids "admins.find() buffering timed out")
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Socket.io is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Server failed to start:", err.message);
    process.exit(1);
  });
