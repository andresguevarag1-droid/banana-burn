import Link from "next/link";
import { CreditCard, Envelope, Info, Question } from "@/components/icons";

export const metadata = { title: "Pago no completado" };

export default function Cancelado() {
  return (
    <div className="card p-6 sm:p-8 text-center space-y-5 animate-rise">
      <span className="mx-auto grid place-items-center size-16 rounded-3xl bg-cream text-muted"><Info weight="duotone" className="size-8" /></span>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink text-balance">No se hizo ningún cobro</h1>
      <p className="text-muted">Tu pago no se completó y tu cuenta sigue igual. Puedes intentarlo de nuevo cuando quieras.</p>
      <ul className="text-left text-[15px] space-y-3 border-y border-line py-5 text-pretty">
        <li className="flex items-start gap-3"><CreditCard weight="duotone" className="size-5 shrink-0 mt-0.5 text-banana-ink" /><span>¿Te rechazaron la tarjeta? Prueba con otra o pregúntale a tu banco si permite compras en línea en dólares.</span></li>
        <li className="flex items-start gap-3"><Question weight="duotone" className="size-5 shrink-0 mt-0.5 text-banana-ink" /><span>¿Tienes dudas del plan? Compara Entreno y Entreno + Nutrición en <Link href="/precios" className="tap font-semibold text-ink underline underline-offset-2">precios</Link>.</span></li>
        <li className="flex items-start gap-3"><Envelope weight="duotone" className="size-5 shrink-0 mt-0.5 text-banana-ink" /><span>¿Algo falló? Escríbenos a <a className="tap font-semibold text-ink underline underline-offset-2" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>.</span></li>
      </ul>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link href="/app/suscripcion" className="btn-primary">Intentar de nuevo</Link>
        <Link href="/precios" className="btn-ghost">Ver planes</Link>
      </div>
      <Link href="/app" className="tap inline-block text-sm font-semibold text-muted underline underline-offset-2 transition-colors duration-150 hover:text-ink">Volver a la app</Link>
    </div>
  );
}
