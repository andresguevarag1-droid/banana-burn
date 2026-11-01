import { PREMIUM_RETOS_NOTE } from "@/lib/plans";

/** Aclara el acceso antes de pagar sin cambiar las reglas del servidor. */
export function PurchaseNote({ nutrition = false }: { nutrition?: boolean }) {
  return <div className="mt-3 space-y-1 text-xs text-muted">
    <p>{PREMIUM_RETOS_NOTE}</p>
    <p>Tu plan incluye entrenos, progreso y retos gratis. Necesitas un plan activo para usar tu compra.</p>
    {nutrition && <p>Los ajustes y el registro de comida requieren Entreno + Nutrición. <s>Nutrición incluida con esta compra</s>.</p>}
    <p>Precio con IVA incluido. Sin renovación de este pago.</p>
  </div>;
}
