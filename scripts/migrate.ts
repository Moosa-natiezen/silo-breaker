import { neon } from "@neondatabase/serverless";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Applies src/server/db/migrations/*.sql to the configured Neon database.
 * Usage: DATABASE_URL=postgres://... npx tsx scripts/migrate.ts
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set — nothing to migrate.");
    process.exit(1);
  }

  const sql = neon(url);
  const dir = join(process.cwd(), "src", "server", "db", "migrations");
  const migrations = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrations) {
    const statement = readFileSync(join(dir, file), "utf8");
    console.log(`Applying ${file}...`);
    // The HTTP driver runs one statement per call — split the file safely.
    const statements = statement
      .split(";\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    for (const stmt of statements) {
      await sql`${sql.unsafe(stmt + ";")}`;
    }
  }

  console.log(`✓ Applied ${migrations.length} migration(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
