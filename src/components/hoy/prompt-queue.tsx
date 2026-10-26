// Una sola tarjeta de aviso a la vez en Hoy. Cada aviso va en su propio espacio, en orden de prioridad; el primero que
// tenga algo que mostrar se ve y los demás esperan su turno (se ocultan con CSS: .prompt-queue en globals.css).
// Así Hoy responde primero lo importante (qué entrenar) sin una pila de tarjetas compitiendo por atención.
// Los avisos que no aplican se dibujan vacíos (return null) y no ocupan su turno.
import { Children, type ReactNode } from "react";

export function PromptQueue({ children }: { children: ReactNode }) {
  return (
    <div className="prompt-queue" aria-label="Aviso" role="region">
      {Children.toArray(children).map((c, i) => <div key={i} className="pq-item">{c}</div>)}
    </div>
  );
}
