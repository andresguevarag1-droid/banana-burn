"use client";
// Dibujo del coach (CDN) con respaldo local: si la imagen no carga, se ve la mascota del sitio y nunca un recuadro roto.
import Image from "next/image";
import { useState } from "react";

export function PoseImage({ src, className = "", size = 150 }: { src: string; className?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  return <Image src={broken ? "/brand/mascota-sola.webp" : src} alt="" width={size} height={size} priority onError={() => setBroken(true)} className={className} />;
}
