"use client";
import { ErrorState } from "@/components/error-state";

// Un fallo aquí nunca cobra dos veces: el cobro lo confirma ONVO y el webhook. Reintentar solo vuelve a cargar la pantalla.
export default function PagoError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState error={error} reset={reset} homeHref="/app/suscripcion" homeLabel="Ver mi suscripción" full area="pago" />;
}
