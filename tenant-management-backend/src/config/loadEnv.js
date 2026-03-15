/**
 * Load .env via dotenv when available.
 * If the dotenv package is not installed (e.g. missing node_modules on server),
 * we do not throw so the app can still start when env vars are set externally.
 */
try {
  const dotenv = await import("dotenv");
  dotenv.default.config();
} catch (e) {
  console.warn("[loadEnv] dotenv not loaded:", e.message);
}
