import { describe, expect, it } from "vitest";
import { generateKeyPairSync, verify } from "node:crypto";
import { apnsBody, apnsConfigFrom, apnsTokenDead, fcmMessage, fcmTokenDead, jwt, serviceAccountFrom } from "./push-native";

const P = { title: "Hoy te toca Pierna", body: "40 minutos. Tú puedes.", url: "/app/entreno", tag: "recordatorio" };

describe("configuración", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  const sa = { project_id: "banana-burn", client_email: "push@banana-burn.iam.gserviceaccount.com", private_key: privateKey };
  it("cuenta de servicio en JSON, en base64 o con \\n escapados", () => {
    expect(serviceAccountFrom(JSON.stringify(sa))?.project_id).toBe("banana-burn");
    expect(serviceAccountFrom(Buffer.from(JSON.stringify(sa)).toString("base64"))?.client_email).toBe(sa.client_email);
    expect(serviceAccountFrom(JSON.stringify({ ...sa, private_key: privateKey.replace(/\n/g, "\\n") }))?.private_key).toBe(privateKey);
  });
  it("sin cuenta o incompleta: nada", () => {
    expect(serviceAccountFrom(undefined)).toBeNull();
    expect(serviceAccountFrom("{}")).toBeNull();
    expect(serviceAccountFrom("no es json")).toBeNull();
  });
  it("APNs: llave, equipo y modo", () => {
    const key = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";
    expect(apnsConfigFrom({ APNS_KEY_ID: "ABCDE12345", APNS_TEAM_ID: "TEAM123456", APNS_PRIVATE_KEY: key })).toMatchObject({ mode: "production" });
    expect(apnsConfigFrom({ APNS_KEY_ID: "ABCDE12345", APPLE_TEAM_ID: "TEAM123456", APNS_PRIVATE_KEY: key, APNS_ENV: "auto" })?.mode).toBe("auto");
    expect(apnsConfigFrom({ APNS_KEY_ID: "corta", APNS_TEAM_ID: "TEAM123456", APNS_PRIVATE_KEY: key })).toBeNull();
    expect(apnsConfigFrom({})).toBeNull();
  });
});

describe("mensajes", () => {
  it("FCM: canal de avisos, la llama y la ruta en data", () => {
    const m = fcmMessage("tok", P).message;
    expect(m.token).toBe("tok");
    expect(m.notification).toEqual({ title: P.title, body: P.body });
    expect(m.data).toEqual({ url: "/app/entreno", tag: "recordatorio" });
    expect(m.android.notification).toMatchObject({ channel_id: "avisos", icon: "ic_stat_bananaburn" });
  });
  it("APNs: alerta con sonido y la ruta", () => {
    expect(apnsBody(P)).toEqual({ aps: { alert: { title: P.title, body: P.body }, sound: "default", "thread-id": "recordatorio" }, url: "/app/entreno" });
  });
  it("tokens muertos se reconocen; los errores pasajeros no", () => {
    expect(fcmTokenDead(404, "")).toBe(true);
    expect(fcmTokenDead(400, '{"error":{"status":"INVALID_ARGUMENT"}}')).toBe(true);
    expect(fcmTokenDead(503, "")).toBe(false);
    expect(apnsTokenDead(410, "Unregistered")).toBe(true);
    expect(apnsTokenDead(400, "BadDeviceToken")).toBe(true);
    expect(apnsTokenDead(429, "TooManyRequests")).toBe(false);
  });
});

describe("firmas JWT", () => {
  const parts = (t: string) => t.split(".");
  it("RS256 (Google) verifica con la llave pública", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const t = jwt({ alg: "RS256", typ: "JWT" }, { iss: "a" }, privateKey.export({ type: "pkcs8", format: "pem" }).toString(), "RS256");
    const [h, c, s] = parts(t);
    expect(verify("sha256", Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });
  it("ES256 (Apple) en formato JOSE de 64 bytes, verifica con la llave pública", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const t = jwt({ alg: "ES256", kid: "ABCDE12345" }, { iss: "TEAM123456", iat: 1 }, privateKey.export({ type: "pkcs8", format: "pem" }).toString(), "ES256");
    const [h, c, s] = parts(t);
    const sig = Buffer.from(s, "base64url");
    expect(sig.length).toBe(64);
    expect(verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, sig)).toBe(true);
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: "ABCDE12345" });
  });
});
