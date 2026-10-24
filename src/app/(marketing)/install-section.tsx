// "Instala tu LinkApp" en la landing: qué es, por qué conviene (los recordatorios) y la ayuda según el celular.
import Image from "next/image";
import { Bell, CheckCircle, Lightning, SquaresFour, type PhosphorIcon } from "@/components/icons";
import { InstallHelper } from "@/components/install/install-helper";
import { installQrSvg } from "@/lib/install-qr";

const WHY: [PhosphorIcon, string, string][] = [
  [Bell, "Te recuerda tu entreno", "Avisos a tu hora y de tu coach. En iPhone solo llegan con la app instalada."],
  [Lightning, "Un toque y entras", "El ícono queda en tu pantalla de inicio, como cualquier app."],
  [SquaresFour, "Pantalla completa", "Sin la barra del navegador: más espacio para tus ejercicios."],
  [CheckCircle, "Sin tiendas de apps", "Casi no ocupa espacio y se actualiza sola."],
];

export async function InstallSection() {
  const qr = await installQrSvg();
  return (
    <section id="instalar" aria-labelledby="instalar-t" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:px-6">
      <div className="grid gap-8 rounded-[2.25rem] bg-cream p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div>
          <p className="w-fit rounded-full bg-ink px-3.5 py-1.5 text-sm font-extrabold text-banana">Se instala en 10 segundos</p>
          <h2 id="instalar-t" className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-ink text-balance">Banana Burn es una <span className="whitespace-nowrap">LinkApp<span aria-label="marca registrada" className="relative -top-[0.9em] ml-[0.04em] text-[0.32em] font-bold">®</span>.</span></h2>
          <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-muted text-pretty">Se abre desde el navegador y se instala en tu pantalla de inicio, sin tiendas de apps. Instalada funciona como cualquier app de tu celular.</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {WHY.map(([I, t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="grid place-items-center size-10 shrink-0 rounded-xl bg-banana text-ink"><I weight="duotone" aria-hidden className="size-5" /></span>
                <span><span className="block font-extrabold text-ink">{t}</span><span className="block text-sm text-muted text-pretty">{d}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[1.75rem] bg-white p-5 sm:p-6 shadow-[0_1px_0_var(--color-line)]">
          <div className="mb-4 flex items-center gap-3">
            <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 rounded-xl" />
            <p className="font-extrabold text-ink">Instala Banana Burn</p>
          </div>
          <InstallHelper where="landing" qrSvg={qr} path="/entrar?modo=registro" />
        </div>
      </div>
    </section>
  );
}
