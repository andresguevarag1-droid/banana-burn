"use client";
// Lo visto de Novedades en el cliente: respaldo en este dispositivo (demo o sin 0036, siempre con try/catch), aviso al
// servidor y un evento para que el punto "Nuevo" del menú se apague en el acto.
import { useEffect, useState } from "react";
import { markNewsSeen } from "@/app/actions/novedades";
import { isNewer, isReleaseId } from "@/lib/novedades";

const LS_SEEN = "bb.novedades.vista";
/** Se dispara al marcar algo como visto (el menú escucha). */
export const NEWS_SEEN_EVENT = "bb:novedades-vistas";

export function readLocalSeen(): string | null {
  try { const v = localStorage.getItem(LS_SEEN); return isReleaseId(v) ? v : null; } catch { return null; }
}

/** Marca la versión `id` como vista aquí y, si se guarda en el servidor, también allá. Nunca lanza ni retrocede. */
export function rememberSeen(id: string, persisted: boolean) {
  if (!isReleaseId(id)) return;
  try { if (isNewer(id, readLocalSeen())) localStorage.setItem(LS_SEEN, id); } catch { /* modo privado o almacenamiento bloqueado */ }
  if (persisted) markNewsSeen(id).catch(() => {});
  try { window.dispatchEvent(new CustomEvent(NEWS_SEEN_EVENT, { detail: id })); } catch { /* */ }
}

/** ¿Mostrar el punto "Nuevo"? Parte de lo que calculó el servidor y se corrige con este dispositivo y el evento. */
export function useNewsDot(news: { latestId: string | null; unseen: boolean; persisted: boolean } | null | undefined): boolean {
  const [on, setOn] = useState(Boolean(news?.unseen));
  const latest = news?.latestId ?? null;
  useEffect(() => {
    if (!latest) { setOn(false); return; }
    const local = readLocalSeen();
    if (local && !isNewer(latest, local)) setOn(false);
    else if (!news?.persisted) setOn(local ? isNewer(latest, local) : Boolean(news?.unseen));
    else setOn(Boolean(news?.unseen));
    const h = (e: Event) => { const id = (e as CustomEvent<string>).detail; if (!isNewer(latest, id)) setOn(false); };
    window.addEventListener(NEWS_SEEN_EVENT, h);
    return () => window.removeEventListener(NEWS_SEEN_EVENT, h);
  }, [latest, news?.persisted, news?.unseen]);
  return on;
}
