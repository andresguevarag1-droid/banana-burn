import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EXPORT_BY_USER, EXPORT_SPECIAL } from "./account-export";

const DIR = join(__dirname, "../../supabase/migrations");

/** Tablas creadas en las migraciones que tienen una columna `user_id`. */
function tablesWithUserId(): string[] {
  const out = new Set<string>();
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql"))) {
    const sql = readFileSync(join(DIR, f), "utf8");
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.([a-z_]+) \(([\s\S]*?)\n\);/g)) {
      if (/^\s*user_id uuid/m.test(m[2])) out.add(m[1]);
    }
  }
  return [...out].sort();
}

describe("exportación de datos (derecho de acceso)", () => {
  it("incluye todas las tablas con user_id de las migraciones", () => {
    const found = tablesWithUserId();
    expect(found.length).toBeGreaterThan(25);
    const covered = new Set<string>([...EXPORT_BY_USER, ...EXPORT_SPECIAL]);
    expect(found.filter((t) => !covered.has(t))).toEqual([]);
  });
  it("no repite tablas", () => expect(new Set(EXPORT_BY_USER).size).toBe(EXPORT_BY_USER.length));
});
