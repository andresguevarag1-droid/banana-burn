// Primer contacto (#283): captura de utm/fbclid, no pisar la cookie, valores acotados y la tabla signup_attribution (0069).
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";
import {
  FIRST_TOUCH_COOKIE, attributionArgs, cleanFirstTouch, decodeFirstTouch, encodeFirstTouch, firstTouchCookie, firstTouchFrom, readCookie,
} from "@/lib/first-touch";

const NOW = new Date("2026-11-07T18:00:00Z");
const META = "https://bananaburn.app/precios?utm_source=meta&utm_medium=paid&utm_campaign=Primer%20entreno&utm_content=Video%2012%20min&fbclid=IwAR0abc";

describe("captura en la primera visita", () => {
  it("guarda los utm, fbclid, el path y la fecha", () => {
    expect(firstTouchFrom(new URL(META), NOW)).toEqual({
      utm_source: "meta", utm_medium: "paid", utm_campaign: "Primer entreno", utm_content: "Video 12 min", fbclid: "IwAR0abc",
      landing: "/precios", first_seen_at: NOW.toISOString(),
    });
  });

  it("sin utm ni fbclid no hay primer contacto (un ?ref= solo tampoco)", () => {
    expect(firstTouchFrom(new URL("https://bananaburn.app/glp1"), NOW)).toBeNull();
    expect(firstTouchFrom(new URL("https://bananaburn.app/?ref=ana-1234&utm_source="), NOW)).toBeNull();
    expect(firstTouchFrom(new URL("https://bananaburn.app/c/torres?fbclid=x"), NOW)).toMatchObject({ fbclid: "x", landing: "/c/torres" });
  });

  it("acota cada valor a 200 caracteres y descarta lo que no es texto", () => {
    const t = firstTouchFrom(new URL(`https://bananaburn.app/?utm_campaign=${"a".repeat(500)}&utm_content=%00x`), NOW)!;
    expect(t.utm_campaign).toHaveLength(200);
    expect(t.utm_content).toBeUndefined();
    expect(cleanFirstTouch({ utm_source: 7, utm_medium: ["x"], fbclid: { a: 1 }, utm_campaign: "ok", landing: "https://otro.com", first_seen_at: NOW.toISOString() }, NOW))
      .toEqual({ utm_campaign: "ok", landing: null, first_seen_at: NOW.toISOString() });
    expect(cleanFirstTouch({ utm_source: 7, first_seen_at: NOW.toISOString() }, NOW)).toBeNull();
    expect(cleanFirstTouch("x", NOW)).toBeNull();
  });

  it("descarta una fecha vencida (más de 30 días) o en el futuro", () => {
    expect(cleanFirstTouch({ utm_source: "meta", first_seen_at: "2026-10-01T00:00:00Z" }, NOW)).toBeNull();
    expect(cleanFirstTouch({ utm_source: "meta", first_seen_at: "2026-12-01T00:00:00Z" }, NOW)).toBeNull();
    expect(cleanFirstTouch({ utm_source: "meta", first_seen_at: "x" }, NOW)).toBeNull();
  });
});

describe("cookie de primer contacto", () => {
  it("dura 30 días, es SameSite=Lax y se puede leer de vuelta", () => {
    const c = firstTouchCookie(new URL(META), "", NOW)!;
    expect(c).toMatch(new RegExp(`^${FIRST_TOUCH_COOKIE}=`));
    expect(c).toContain("Max-Age=2592000");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Secure");
    expect(c).not.toMatch(/HttpOnly/i);
    const value = c.split(";")[0].slice(FIRST_TOUCH_COOKIE.length + 1);
    expect(decodeFirstTouch(readCookie(`otra=1; ${FIRST_TOUCH_COOKIE}=${value}; x=2`, FIRST_TOUCH_COOKIE), NOW)).toMatchObject({ utm_content: "Video 12 min", landing: "/precios" });
  });

  it("no se pisa si ya existe una válida", () => {
    const first = firstTouchCookie(new URL(META), "", NOW)!.split(";")[0];
    expect(firstTouchCookie(new URL("https://bananaburn.app/?utm_source=google"), `a=b; ${first}`, NOW)).toBeNull();
  });

  it("una cookie rota o vencida sí se reemplaza", () => {
    expect(firstTouchCookie(new URL(META), `${FIRST_TOUCH_COOKIE}=%7Bmal`, NOW)).not.toBeNull();
    const old = encodeFirstTouch({ utm_source: "meta", landing: "/", first_seen_at: "2026-09-01T00:00:00Z" })!;
    expect(firstTouchCookie(new URL(META), `${FIRST_TOUCH_COOKIE}=${old}`, NOW)).not.toBeNull();
  });

  it("sin utm ni fbclid no escribe nada", () => {
    expect(firstTouchCookie(new URL("https://bananaburn.app/precios"), "", NOW)).toBeNull();
  });

  it("si no cabe en una cookie no la escribe", () => {
    const big = "%E2%82%AC".repeat(200); // "€" codificado ocupa 9 caracteres
    const url = new URL(`https://bananaburn.app/?utm_source=${big}&utm_medium=${big}&utm_campaign=${big}&utm_content=${big}&utm_term=${big}&fbclid=${big}`);
    expect(firstTouchCookie(url, "", NOW)).toBeNull();
  });
});

describe("0069_atribucion_registro.sql", () => {
  it("se aplica dos veces, guarda una sola vez, solo cuentas nuevas, y la persona no la lee", async () => {
    const pg = new PGlite({ extensions: { pgcrypto } });
    await pg.exec(readFileSync("supabase/tests/stub.sql", "utf8"));
    await pg.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
    const sql = readFileSync("supabase/migrations/0069_atribucion_registro.sql", "utf8");
    await pg.exec(sql);
    await pg.exec(sql);
    const nuevo = "00000000-0000-4000-8000-000000000001", viejo = "00000000-0000-4000-8000-000000000002";
    await pg.exec(`insert into auth.users (id, created_at) values ('${nuevo}', now()), ('${viejo}', now() - interval '5 days')`);
    const save = async (user: string, t: Parameters<typeof attributionArgs>[1]) => {
      const a = attributionArgs(user, t);
      const { rows } = await pg.query<{ r: string }>("select public.signup_attribution_save($1, $2, $3, $4, $5, $6, $7, $8, $9) as r",
        [a.p_user, a.p_source, a.p_medium, a.p_campaign, a.p_content, a.p_term, a.p_fbclid, a.p_landing, a.p_first_seen]);
      return rows[0].r;
    };
    const t = firstTouchFrom(new URL(META), new Date())!;
    expect(await save(nuevo, t)).toBe("guardada");
    expect(await save(nuevo, { ...t, utm_campaign: "otra" })).toBe("ya_guardada");
    expect(await save(viejo, t)).toBe("cuenta_existente");
    const { rows } = await pg.query<{ utm_campaign: string; landing: string }>("select utm_campaign, landing from public.signup_attribution");
    expect(rows).toEqual([{ utm_campaign: "Primer entreno", landing: "/precios" }]);

    // La persona (authenticated, sin rol de staff) no ve su fila ni puede escribir.
    await pg.exec(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"${nuevo}","role":"authenticated"}', false)`);
    expect((await pg.query("select * from public.signup_attribution")).rows).toHaveLength(0);
    await expect(pg.exec(`insert into public.signup_attribution (user_id) values ('${nuevo}')`)).rejects.toThrow();
    await expect(pg.query("select public.signup_attribution_save($1, 'x', null, null, null, null, null, null, null)", [nuevo])).rejects.toThrow();
    await pg.exec("reset role");
    const { rows: rls } = await pg.query<{ rls: boolean }>("select relrowsecurity as rls from pg_class where relname = 'signup_attribution'");
    expect(rls[0].rls).toBe(true);
    await pg.close();
  });
});
