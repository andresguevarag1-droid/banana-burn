"use client";
// Retrato o ilustración de la coach de un programa (Coach Platanita, del CDN). Si la imagen no carga, queda un
// recuadro lila con el mono de la marca (o el respaldo que se pase), nunca la mascota de Coach Banana ni un ícono roto.
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Monkey } from "@/components/icons";

export function CoachPic({ src, alt = "", size, className = "", iconClassName = "size-6", priority = false, sizes }: { src: string; alt?: string; size: number; className?: string; iconClassName?: string; priority?: boolean; sizes?: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (broken === src) return <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={`grid place-items-center bg-[#E2C8FF] text-ink ${className}`}><Monkey weight="duotone" className={iconClassName} /></span>;
  return <Image src={src} alt={alt} width={size} height={size} sizes={sizes ?? `${size}px`} priority={priority} onError={() => setBroken(src)} className={`bg-[#F3E8FF] ${className}`} />;
}

/**
 * Ilustración que llena su caja (`fill`); si no carga, se muestra `fallback` (la animación de técnica, por ejemplo).
 * `wrap`: clases de una caja propia (relativa) para la imagen; sin ella, la imagen llena la caja del padre.
 */
export function CoachArtFill({ src, alt = "", sizes, className = "", fallback, wrap }: { src: string; alt?: string; sizes: string; className?: string; fallback: ReactNode; wrap?: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (broken === src) return <>{fallback}</>;
  const img = <Image src={src} alt={alt} fill sizes={sizes} onError={() => setBroken(src)} className={className} />;
  return wrap ? <div className={`relative ${wrap}`}>{img}</div> : img;
}
