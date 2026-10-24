import { Bell, CheckCircle, Lightning, SquaresFour, type PhosphorIcon } from "@/components/icons";
import { InstallHelper } from "@/components/install/install-helper";
import { installQrSvg } from "@/lib/install-qr";

export const metadata = { title: "Instala tu LinkApp" };

const WHY: [PhosphorIcon, string, string][] = [
  [Bell, "Recordatorios de tu entreno", "Te avisamos a tu hora para que no se te pase el día. En iPhone los avisos solo llegan con la app instalada."],
  [Lightning, "Entras con un toque", "Sin buscar la página ni escribir nada: el ícono queda en tu pantalla, como cualquier app."],
  [SquaresFour, "Pantalla completa", "Sin la barra del navegador: más espacio para ver tus ejercicios mientras entrenas."],
  [CheckCircle, "Sin tiendas de apps", "No ocupa casi espacio y se actualiza sola. Siempre tienes la versión nueva."],
];

export default async function Instalar() {
  const qr = await installQrSvg();
  return (
    <div className="space-y-5 animate-enter max-w-2xl">
      <header>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Instala tu LinkApp</h1>
        <p className="mt-1 max-w-[60ch] text-muted">Banana Burn es una LinkApp: una app que se abre desde el navegador y se instala en tu pantalla de inicio en 10 segundos, sin tiendas de apps.</p>
      </header>
      <section className="card p-5"><InstallHelper where="perfil" qrSvg={qr} /></section>
      <ul className="grid gap-3 sm:grid-cols-2">
        {WHY.map(([I, t, d]) => (
          <li key={t} className="card p-4">
            <span className="grid place-items-center size-10 rounded-xl bg-banana-soft text-banana-ink"><I weight="duotone" className="size-5" /></span>
            <p className="mt-2 font-extrabold text-ink">{t}</p>
            <p className="text-sm text-muted">{d}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
