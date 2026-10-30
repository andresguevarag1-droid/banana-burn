// Cliente de Supabase de solo lectura para el simulacro de cobros (dryRun). Envuelve el cliente de service_role: los
// SELECT pasan; insert, update, upsert, delete, rpc y auth lanzan antes de salir. Si un cambio futuro deja una escritura
// en un camino del simulacro, falla en las pruebas en vez de escribir en producción. Pura (sin "server-only").
import type { SupabaseClient } from "@supabase/supabase-js";

const WRITES = new Set(["insert", "update", "upsert", "delete"]);
const BLOCKED = new Set(["rpc", "auth", "storage", "functions", "channel", "schema"]);

export class ReadOnlyError extends Error {}

const deny = (what: string) => { throw new ReadOnlyError(`simulacro: escritura bloqueada (${what})`); };

export function readOnly(db: SupabaseClient): SupabaseClient {
  return new Proxy(db, {
    get(target, prop, recv) {
      if (prop === "from") {
        return (table: string) => {
          const q = target.from(table);
          return new Proxy(q, {
            get(t, p, r) {
              if (typeof p === "string" && WRITES.has(p)) return () => deny(`${p} ${table}`);
              const v = Reflect.get(t, p, r);
              return typeof v === "function" ? v.bind(t) : v;
            },
          });
        };
      }
      if (typeof prop === "string" && BLOCKED.has(prop)) return deny(prop);
      const v = Reflect.get(target, prop, recv);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}
