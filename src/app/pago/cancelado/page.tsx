import Link from "next/link";
import { CreditCard, Envelope, Question, WarningCircle } from "@/components/icons";

export const metadata = { title: "Pago no completado" };

export default function Cancelado() {
  return (
    <div className="card p-6 sm:p-8 text-center space-y-5 animate-rise">
      <span className="mx-auto grid place-items-center size-16 rounded-3xl bg-banana-soft text-banana-ink"><WarningCircle weight="duotone" className="size-8" /></span>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">No se hizo ningún cobro</h1>
      <p className="text-muted">Tu pago no se completó y tu cuenta sigue igual. Puedes intentarlo de nuevo cuando quieras.</p>
      <ul className="text-left text-[15px] space-y-2 rounded-2xl bg-paper p-4">
        <li className="flex items-start gap-3"><CreditCard weight="duotone" className="size-5 shrink-0 mt-0.5 text-banana-ink" /><span>¿Te rechazaron la tarjeta? Prueba con otra o pregúntale a tu banco si permite compras en línea en dólares.</span></li>
        <li className="flex items-start gap-3"><Question weight="duotone" className="size-5 shrink-0 mt-0.5 text-banana-ink" /><span>¿Tienes dudas del plan? Compara Entreno y Entreno + Nutrición en precios.</span></li>
        <li className="flex items-start gap-3"><Envelope weight="duotone" className="size-5 shrink-0 mt-0.5 text-banana-ink" /><span>¿Algo falló? Escríbenos a <a className="underline" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>.</span></li>
      </ul>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link href="/app/suscripcion" className="btn-primary">Intentar de nuevo</Link>
        <Link href="/precios" className="btn-ghost">Ver planes</Link>
        <Link href="/app" className="btn-ghost">Volver a la app</Link>
      </div>
    </div>
  );
}
