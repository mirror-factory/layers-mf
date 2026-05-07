import { readdirSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const byVersion = new Map<string, string[]>();

for (const file of migrationFiles) {
  const version = file.split("_", 1)[0];
  const files = byVersion.get(version) ?? [];
  files.push(file);
  byVersion.set(version, files);
}

const duplicates = [...byVersion.entries()].filter(([, files]) => files.length > 1);

if (duplicates.length > 0) {
  console.error("Duplicate Supabase migration versions found:");
  for (const [version, files] of duplicates) {
    console.error(`\n${version}`);
    for (const file of files) console.error(`  - ${file}`);
  }
  process.exit(1);
}

console.log(`Supabase migration versions are unique (${migrationFiles.length} migrations).`);
