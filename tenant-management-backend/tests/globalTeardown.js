/**
 * Jest global teardown - runs once after all test suites
 * Stops MongoDB Memory Server
 */
export default async function globalTeardown() {
  if (global.__MONGOSERVER__) {
    await global.__MONGOSERVER__.stop();
    console.log('\n✅ MongoDB Memory Server stopped');
  }
}
