import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { getIntake, getSeason, getSeasonsView } from "@/lib/seasons-server";
import { SPORTS, longDate, parseSeasonSlug, seasonStatus } from "@/lib/seasons";
import { IntakeWizard } from "@/components/temporadas/intake-wizard";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const m = parseSeasonSlug((await params).slug);
  return { title: m ? `Arma tu semana: ${SPORTS[m.sport].name}` : "Cuestionario" };
}

export default async function Cuestionario({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = parseSeasonSlug(slug);
  if (!m) notFound();
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=/app/temporadas/${slug}/cuestionario`);
  const [s, view, intake] = await Promise.all([getSeason(v.demo, slug), getSeasonsView(v), getIntake(v, slug)]);
  if (!s) notFound();
  if (!view.owned.has(slug) && !v.demo) redirect(`/app/temporadas/${slug}`);
  return <IntakeWizard slug={slug} sport={m.sport} initial={intake?.answers ?? null} started={seasonStatus(s, view.today) !== "preventa"} startsLabel={longDate(s.startsOn)} />;
}
