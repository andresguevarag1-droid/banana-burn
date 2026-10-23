import { describe, expect, it } from "vitest";
import { publicEnvProblems } from "./public-env";

const jwt = (role: string) => `x.${Buffer.from(JSON.stringify({ role, iss: "supabase" })).toString("base64url")}.y`;

describe("publicEnvProblems (llaves secretas en variables NEXT_PUBLIC_)", () => {
  it("configuración correcta: sin problemas", () => {
    expect(publicEnvProblems({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"), SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"), NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY: "onvo_live_publishable_key_abc", NEXT_PUBLIC_VAPID_PUBLIC_KEY: "BPub" })).toEqual([]);
    expect(publicEnvProblems({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abc" })).toEqual([]);
  });
  it("detecta la service_role en la llave pública de Supabase (JWT o formato nuevo)", () => {
    expect(publicEnvProblems({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("service_role") })).toHaveLength(1);
    expect(publicEnvProblems({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abc" })).toHaveLength(1);
  });
  it("detecta la llave secreta de ONVO en la publicable", () => {
    expect(publicEnvProblems({ NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY: "onvo_live_secret_key_abc" })).toHaveLength(1);
  });
  it("detecta nombres sospechosos y valores copiados de secretos", () => {
    expect(publicEnvProblems({ NEXT_PUBLIC_CRON_SECRET: "abc" })[0]).toMatch(/NEXT_PUBLIC_CRON_SECRET/);
    const p = publicEnvProblems({ ANTHROPIC_API_KEY: "sk-ant-123456789", NEXT_PUBLIC_COACH_KEY: "sk-ant-123456789" });
    expect(p).toHaveLength(1);
    expect(p[0]).not.toMatch(/sk-ant/); // nunca imprime el valor
  });
});
