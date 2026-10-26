import "server-only";
import { headers } from "next/headers";
import { nativeAgentFrom, type AppPlatform, type NativeAgent } from "./platform-ua";

// Plataforma en el servidor (páginas y acciones): con esto el HTML ya llega armado para la app nativa (por ejemplo,
// sin pagos web), sin parpadeo. Leer headers() vuelve dinámica la página: úsalo solo en rutas que ya lo son (/app,
// /entrar, /bienvenida). En el navegador: platform.ts.

export async function requestNativeAgent(): Promise<NativeAgent | null> {
  return nativeAgentFrom((await headers()).get("user-agent"));
}

export async function requestPlatform(): Promise<AppPlatform> {
  return (await requestNativeAgent())?.platform ?? "web";
}

export async function isNativeRequest(): Promise<boolean> {
  return (await requestNativeAgent()) !== null;
}
