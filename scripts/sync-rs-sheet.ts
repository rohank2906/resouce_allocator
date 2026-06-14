import "dotenv/config";
import { syncFromRsSheet } from "@/lib/services/rs-sync";

async function main() {
  const result = await syncFromRsSheet();
  console.log("RS sheet sync complete");
  console.log(`  Created:           ${result.created}`);
  console.log(`  Attendance updates: ${result.attendanceUpdated}`);
  console.log(`  Project moves:     ${result.projectMoved}`);
  console.log(`  Unchanged:         ${result.unchanged}`);
  console.log(`  Duplicates:        ${result.duplicates}`);
  console.log(`  Skipped:           ${result.skipped}`);
  console.log(`  Errors:            ${result.errors.length}`);
  console.log(`  New projects:      ${result.newProjects.length}`);
  console.log(`  Duration:          ${result.durationMs}ms`);
  if (result.newProjects.length > 0) {
    console.log("\nNew projects created from RS sheet:");
    for (const name of result.newProjects) console.log(`  - ${name}`);
  }
  if (result.errors.length > 0) {
    console.log("\nFirst 10 errors:");
    for (const e of result.errors.slice(0, 10)) {
      console.log(`  Row ${e.row} (${e.email ?? "?"}): ${e.reason}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
