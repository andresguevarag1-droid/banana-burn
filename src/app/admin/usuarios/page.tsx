import { getViewer } from "@/lib/supabase/server";
import { adminUsers } from "@/lib/admin";

export const metadata = { title: "Usuarios" };

const ROLE_STYLE: Record<string, string> = { superadmin: "bg-ink text-white", admin: "bg-ink/80 text-white", coach: "bg-sky/15 text-sky", support: "bg-sky/15 text-sky", pro: "bg-banana text-ink", free: "bg-line text-muted" };

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const v = (await getViewer())!;
  const users = await adminUsers(v, q);
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Usuarios</h1>
        <form><input name="q" defaultValue={q} placeholder="Buscar por nombre…" className="input h-11 sm:w-72" /></form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted border-b border-line">
            <tr><th className="p-4">Nombre</th><th className="p-4">Rol</th><th className="p-4">Plan</th><th className="p-4">Perfil</th><th className="p-4">Alta</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0 hover:bg-paper/60">
                <td className="p-4 font-semibold text-ink">{u.full_name || "—"}</td>
                <td className="p-4"><span className={`chip h-6 ${ROLE_STYLE[u.role] ?? ""}`}>{u.role}</span></td>
                <td className="p-4 text-ink">{u.plan}</td>
                <td className="p-4">{u.onboarded ? "✅" : "⏳"}</td>
                <td className="p-4 text-muted tabular-nums">{new Date(u.created_at).toLocaleDateString("es-CR")}</td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={5} className="p-8 text-center text-muted">Sin resultados</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-faint">Los cambios de rol se hacen solo por admin y quedan en auditoría (Fase 2). Por RLS, el staff ve perfiles pero no puede modificar datos de salud.</p>
    </div>
  );
}
