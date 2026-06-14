import { syncEmployeesFromGoogleSheet } from "../lib/services/sheets-sync";

async function main() {
  console.log("Starting Google Sheets sync...");
  try {
    const result = await syncEmployeesFromGoogleSheet();
    console.log(`Sync complete: ${result.imported} imported, ${result.updated} updated`);
    if (result.duplicates > 0) {
      console.log(`Duplicates skipped: ${result.duplicates}`);
    }
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.length}`);
      for (const err of result.errors) {
        console.log(`  row ${err.row} (${err.email ?? "-"}): ${err.reason}`);
      }
    }
    process.exit(0);
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

main();
