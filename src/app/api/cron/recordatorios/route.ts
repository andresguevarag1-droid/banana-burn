import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/lib/notify-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Vercel Cron (cada hora en Pro; diario en Hobby con NOTIFY_CRON_MODE=daily). Protegido con `Authorization: Bearer CRON_SECRET`. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: true, skipped: "CRON_SECRET no configurado (modo demo)" });
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const stats = await runReminders();
  return NextResponse.json(stats, { status: stats.ok ? 200 : 500 });
}
