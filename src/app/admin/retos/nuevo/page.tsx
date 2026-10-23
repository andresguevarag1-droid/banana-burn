import { requireSection } from "@/lib/admin-auth";
import { can } from "@/lib/admin-perms";
import { DemoNotice, PageHeader } from "@/components/admin/ui";
import { ChallengeEditor } from "../editor";

export const metadata = { title: "Nuevo reto" };

export default async function NuevoReto({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const v = await requireSection("retos");
  const prog = (await searchParams).tipo === "programa";
  return (
    <div className="space-y-5">
      <PageHeader title={prog ? "Nuevo programa" : "Nuevo reto"} back={{ href: "/admin/retos", label: "Retos" }} desc={prog ? "Se crea como borrador. Publícalo cuando cada fase tenga sus sesiones con ejercicios." : "Se crea como borrador. Publícalo cuando el plan tenga todos los días."} />
      {v.demo && <DemoNotice what="los datos de este reto" />}
      <ChallengeEditor canSell={can(v.role, "challenges.sales")} init={{
        title: "", desc: "", days: 21, verify: "manual", icon: "medal", cover: "banana", difficulty: "media", minutes: 10, grace: 2, xp: 250, badge: "",
        rewardTitle: null, priceUsd: 0, onvoPriceId: null, startMode: "libre", startDate: null, featured: false, comingSoon: false, safetyNote: null, status: "borrador", sort: 500, plan: [],
        kind: prog ? "programa" : "reto", program: null, sessions: [], names: {},
        ...(prog ? { priceUsd: 9.99, minutes: 45, xp: 400, cover: "noche" as const } : {}),
      }} />
    </div>
  );
}
