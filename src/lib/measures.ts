import { createClient, type Viewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";

export type Measure = { d: string; waist: number | null; neck: number | null; chest: number | null; arm: number | null; thigh: number | null; hip: number | null };
export type Photo = { id: string; d: string; pose: string; url: string | null };

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export async function getMeasures(v: Viewer): Promise<Measure[]> {
  if (v.demo) {
    const t = crToday().iso;
    return [-21, -14, -7, 0].map((o, i) => ({ d: addDays(t, o), waist: 99.6 - i * 0.7, neck: 40.3 - i * 0.1, chest: 107.4 - i * 0.3, arm: 37 + (i % 2) * 0.2, thigh: 61.4 - i * 0.3, hip: null }));
  }
  const sb = await createClient();
  const { data } = await sb.from("measurements").select("day,waist,neck,chest,arm,thigh,hip").eq("user_id", v.id).order("day");
  return (data ?? []).map((r) => ({ d: r.day as string, waist: num(r.waist), neck: num(r.neck), chest: num(r.chest), arm: num(r.arm), thigh: num(r.thigh), hip: num(r.hip) }));
}
const num = (x: unknown) => (x == null ? null : Number(x));

export async function getPhotos(v: Viewer): Promise<Photo[]> {
  if (v.demo) return [];
  const sb = await createClient();
  const { data } = await sb.from("progress_photos").select("id,day,pose,path").eq("user_id", v.id).order("day", { ascending: false }).limit(60);
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: signed } = await sb.storage.from("progreso").createSignedUrls(rows.map((r) => r.path as string), 60 * 30);
  return rows.map((r, i) => ({ id: String(r.id), d: r.day as string, pose: r.pose as string, url: signed?.[i]?.signedUrl ?? null }));
}
