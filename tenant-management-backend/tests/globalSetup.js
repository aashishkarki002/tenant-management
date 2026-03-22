/**
 * Jest global setup - runs once before all test suites
 * Sets up MongoDB Memory Server
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  // Start MongoDB Memory Server
  const mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '7.0.0',
    },
    instance: {
      dbName: 'tenant-test',
    },
  });

  const mongoUri = mongoServer.getUri();
  process.env.MONGO_URL = mongoUri;
  
  // Save reference to global for teardown
  global.__MONGOSERVER__ = mongoServer;
  
  console.log('\n🔧 MongoDB Memory Server started:', mongoUri);
}
