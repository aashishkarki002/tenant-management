/**
 * Jest global setup for all tests
 * Runs before each test file
 */
import dotenv from "dotenv";

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Set test environment
process.env.NODE_ENV = "test";

// Note: testTimeout is configured in jest.config.js instead of here
// because jest.setTimeout is not available in ESM setup files

