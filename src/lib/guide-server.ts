// Estado de la guía de la app guardado en el perfil (0031). Solo servidor.
import "server-only";
import { cache } from "react";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { isTipKey, type TipKey } from "@/lib/guide";

export type GuideState = {
  /** Última versión de la guía que vio (null = nunca). */
  seenVersion: number | null;
  /** Consejos de la primera vez ya cerrados. */
  tips: TipKey[];
  /** ¿Se guarda en el servidor? En demo, o sin la migración 0031, el cliente recuerda en este dispositivo (localStorage). */
  persisted: boolean;
};

const LOCAL_ONLY: GuideState = { seenVersion: null, tips: [], persisted: false };

/** Una lectura por request. Sin la columna (0031 sin correr) o con error: el cliente usa su respaldo local. */
export const getGuideState = cache(async (v: Viewer): Promise<GuideState> => {
  if (v.demo) return LOCAL_ONLY;
  const sb = await createClient();
  const { data, error } = await sb.from("profiles").select("guide_version,guide_tips").eq("id", v.id).maybeSingle();
  if (error || !data) return LOCAL_ONLY;
  const ver = Number(data.guide_version);
  return { seenVersion: Number.isFinite(ver) && ver > 0 ? ver : null, tips: ((data.guide_tips as unknown[] | null) ?? []).filter(isTipKey), persisted: true };
});
