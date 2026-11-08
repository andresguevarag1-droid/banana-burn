"use client";
import { useEffect } from "react";
import { track } from "@/components/analytics";

/** Una vista de la portada por variante del hero (#285), para comparar registros por anuncio en el embudo. */
export function VariantView({ variant }: { variant: string }) {
  useEffect(() => { track("landing_variant_view", { variant }); }, [variant]);
  return null;
}
