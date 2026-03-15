import { migrateExistingAccounts } from "./seedAccount.js";

const defaultEntityId = process.argv[2];

if (!defaultEntityId) {
  console.error("Usage: node src/seeds/runMigrateAccounts.js <defaultEntityId>");
  process.exit(1);
}

(async () => {
  try {
    await migrateExistingAccounts(defaultEntityId);
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
})();

