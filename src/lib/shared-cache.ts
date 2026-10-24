// Lecturas que son iguales para todas las personas, guardadas entre peticiones (Data Cache de Next) con etiquetas.
// Solo contenido público del catálogo y anuncios: nunca datos de una persona. El panel invalida la etiqueta al editar
// (revalidateTag) y, por si algo se edita directo en Supabase, cada lectura vence sola en pocos minutos.
import "server-only";
import { unstable_cache } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";

/** Etiquetas: el panel las invalida al guardar. */
export const TAGS = { catalog: "catalogo-retos", announcements: "anuncios" } as const;

/** Columnas de la tienda con programas (mismas que STORE_COLS_24 de challenges-server.ts, que importa de aquí). */
export const STORE_COLS = "slug,title,description,days,rules,status,price_usd,difficulty,minutes,cover,icon,verify,grace,xp,steps_goal,badge,reward_title,start_mode,start_date,featured,coming_soon,safety_note,sort";
export const STORE_COLS_24 = `${STORE_COLS},kind,program`;

/**
 * Retos y programas publicados (lo mismo que la RLS deja ver a quien no es staff). Lanza si la base falla: un error no
 * queda guardado y quien llama usa la lectura de siempre. Sin service_role: null (sin caché).
 */
export const publishedCatalogRows = unstable_cache(
  async (): Promise<Record<string, unknown>[] | null> => {
    const db = adminClient();
    if (!db) return null;
    const { data, error } = await db.from("challenges_catalog").select(STORE_COLS_24).eq("status", "publicado").order("sort").order("created_at");
    if (error) throw Object.assign(new Error("catalogo"), { code: error.code });
    return (data ?? []) as unknown as Record<string, unknown>[];
  },
  ["catalogo-publicado-v1"],
  { tags: [TAGS.catalog], revalidate: 300 },
);

export type AnnouncementRow = { id: string; title: string; body: string | null; tone: string; cta_label: string | null; cta_href: string | null; audience: string; active: boolean; starts_at: string | null; ends_at: string | null };

/** Anuncios activos (máx. 20, más recientes primero). La vigencia y la audiencia se filtran al mostrarlos. */
export const activeAnnouncements = unstable_cache(
  async (): Promise<AnnouncementRow[] | null> => {
    const db = adminClient();
    if (!db) return null;
    const { data, error } = await db.from("announcements").select("id,title,body,tone,cta_label,cta_href,audience,active,starts_at,ends_at")
      .eq("active", true).order("created_at", { ascending: false }).limit(20);
    if (error) throw Object.assign(new Error("anuncios"), { code: error.code });
    return (data ?? []) as AnnouncementRow[];
  },
  ["anuncios-activos-v1"],
  { tags: [TAGS.announcements], revalidate: 120 },
);
