import http from "http";

async function main() {
  const { default: app } = await import("./app.js");
  const { connectDB } = await import("./config/db.js");
  const { initializeSocket } = await import("./config/socket.js");
  const { initializeWebPush } = await import("./config/webpush.js");
  const { scheduleGeneratorCheckCron } = await import(
    "./cron/service/generator.cron.js"
  );

  const PORT = process.env.PORT || 3000;
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("PORT:", process.env.PORT);
  console.log("DB URI loaded:", !!(process.env.MONGODB_URI || process.env.MONGO_URI));
  console.log("SMTP_HOST loaded:", !!process.env.SMTP_HOST);

  const server = http.createServer(app);
  initializeSocket(server);
  initializeWebPush();

  await connectDB();
  scheduleGeneratorCheckCron();
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.io is running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("❌ Server failed to start:", err.message);
  process.exit(1);
});
