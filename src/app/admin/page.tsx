import { getViewer } from "@/lib/supabase/server";
import { adminStats } from "@/lib/admin";

export default async function AdminHome() {
  const v = (await getViewer())!;
  const s = await adminStats(v);
  const conv = s.users ? Math.round((s.pro / s.users) * 100) : 0;
  const act = s.users ? Math.round((s.onboarded / s.users) * 100) : 0;
  const KPIS = [
    { l: "Usuarios", v: s.users, h: "registrados" },
    { l: "Pro", v: s.pro, h: `${conv} % conversión` },
    { l: "Activación", v: `${act} %`, h: "completaron perfil" },
    { l: "Entrenos 7 d", v: s.workouts7, h: "sesiones registradas" },
    { l: "Pesajes 7 d", v: s.weights7, h: "check-ins" },
  ];
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Resumen</h1>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {KPIS.map((k) => (
          <div key={k.l} className="card p-5"><p className="text-sm font-semibold text-muted">{k.l}</p><p className="mt-2 text-3xl font-extrabold text-ink tabular-nums">{k.v}</p><p className="text-xs text-faint">{k.h}</p></div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          ["programas", "🏋️ Programas y ejercicios", "Editar plantillas, rotaciones y animaciones sin desplegar código."],
          ["alimentos", "🫘 Base de alimentos", "Comidas de Costa Rica y LATAM con macros verificados."],
          ["pagos", "💳 Pagos ONVO", "Suscripciones, SINPE Móvil, reembolsos y webhooks."],
          ["auditoria", "📜 Auditoría", "Cada acción de staff queda registrada (quién, qué, cuándo)."],
        ].map(([id, t, d]) => (
          <section id={id} key={id} className="card p-5 scroll-mt-8"><div className="flex justify-between"><h2 className="font-bold text-ink">{t}</h2><span className="chip bg-banana-soft text-banana-ink">Fase 2</span></div><p className="mt-1 text-sm text-muted">{d}</p></section>
        ))}
      </div>
    </div>
  );
}
