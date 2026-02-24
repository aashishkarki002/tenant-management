export default {
  testEnvironment: "node",
  setupFilesAfterEnv: ["./src/test/setup.js"],
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js", "**/?(*.)+(spec|test).mjs"],
  testPathIgnorePatterns: ["/node_modules/", "/src/test.js"],
  transform: {},
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
