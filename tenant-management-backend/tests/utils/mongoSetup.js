/**
 * MongoDB setup for integration/smoke tests
 * Import this in test files that need database access
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

export async function setupMongoDB() {
  if (!process.env.MONGO_URL) {
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '7.0.0',
      },
      instance: {
        dbName: 'tenant-test',
      },
    });
    process.env.MONGO_URL = mongoServer.getUri();
  }
  return process.env.MONGO_URL;
}

export async function teardownMongoDB() {
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}
