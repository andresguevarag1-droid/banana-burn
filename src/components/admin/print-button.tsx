"use client";
// Botón para imprimir la página (afiche del condominio). El panel oculta su navegación al imprimir.
import { Printer } from "@/components/icons";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary h-10! gap-1.5 px-4! text-sm!">
      <Printer className="size-4" aria-hidden />{label}
    </button>
  );
}
