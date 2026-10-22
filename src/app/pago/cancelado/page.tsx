import Link from "next/link";
import { CircleAlert } from "lucide-react";

export const metadata = { title: "Pago no completado" };

export default function Cancelado() {
  return (
    <div className="card p-6 sm:p-8 text-center space-y-5 animate-rise">
      <span className="mx-auto grid place-items-center size-16 rounded-3xl bg-banana-soft text-banana-ink"><CircleAlert className="size-8" aria-hidden /></span>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">No se hizo ningún cobro</h1>
      <p className="text-muted">Tu pago no se completó y tu cuenta sigue igual. Puedes intentarlo de nuevo cuando quieras.</p>
      <ul className="text-left text-[15px] space-y-2 rounded-2xl bg-paper p-4">
        <li>💳 ¿Te rechazaron la tarjeta? Prueba con otra o pregúntale a tu banco si permite compras en línea en dólares.</li>
        <li>🤔 ¿Tienes dudas del plan? Compara Entreno y Entreno + Nutrición en precios.</li>
        <li>✉️ ¿Algo falló? Escríbenos a <a className="underline" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>.</li>
      </ul>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link href="/app/suscripcion" className="btn-primary">Intentar de nuevo</Link>
        <Link href="/precios" className="btn-ghost">Ver planes</Link>
        <Link href="/app" className="btn-ghost">Volver a la app</Link>
      </div>
    </div>
  );
}
