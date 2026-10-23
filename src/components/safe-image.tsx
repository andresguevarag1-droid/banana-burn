"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/** next/image con respaldo local: si la imagen remota no carga, muestra a Coach Banana de la marca. */
export function SafeImage({ fallback = "/brand/mascota-sola.webp", src, alt, className = "", fallbackClassName, ...rest }: ImageProps & { fallback?: string; fallbackClassName?: string }) {
  const [broken, setBroken] = useState(false);
  return <Image {...rest} alt={alt} src={broken ? fallback : src} className={broken && fallbackClassName ? fallbackClassName : className} onError={() => setBroken(true)} />;
}

/**
 * Un fotograma quieto de una hoja de técnica (2x2 o 3x3): recorta su celda. Sin animación (rápido y respeta
 * "reducir movimiento"); si la hoja no carga, Coach Banana quieto.
 */
export function SheetFrame({ src, grid, cell, sizes }: { src: string; grid: 2 | 3; cell: number; sizes: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <Image src="/brand/mascota-sola.webp" alt="" fill sizes="160px" className="object-contain p-2" />;
  const col = cell % grid, row = Math.floor(cell / grid), cx = ((col + 0.5) / grid) * 100, cy = ((row + 0.5) / grid) * 100;
  return (
    // Las celdas de la hoja son cuadradas: se recorta un cuadrado centrado del alto de la caja, así una ficha más ancha
    // que alta (4:3) muestra el fotograma completo, sin cortar cabeza ni pies y sin asomar el fotograma vecino.
    <div className="absolute inset-y-0 left-1/2 aspect-square h-full max-w-full -translate-x-1/2 overflow-hidden bg-banana">
      <div className="absolute" style={{ width: `${grid * 100}%`, height: `${grid * 100}%`, left: `${-100 * col}%`, top: `${-100 * row}%`, transform: `scale(${grid === 3 ? 1.05 : 1.035})`, transformOrigin: `${cx}% ${cy}%` }}>
        <Image src={src} alt="" fill sizes={sizes} onError={() => setBroken(true)} draggable={false} className="object-cover select-none" />
      </div>
    </div>
  );
}
