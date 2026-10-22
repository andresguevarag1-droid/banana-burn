import Image from "next/image";
import { Banana } from "@/components/icons";

/**
 * Marco de teléfono con una captura real de la app.
 * Mientras la imagen carga se ve un fondo crema con la banana de marca (nunca un rectángulo blanco).
 * Sin muesca dibujada: las capturas ya traen su propia barra de estado y una muesca falsa la taparía.
 */
export function Phone({ src, alt, className = "", priority = false, sizes = "(max-width: 640px) 280px, 320px" }: { src: string; alt: string; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <div className={`${/\babsolute\b/.test(className) ? "" : "relative "}rounded-[2.6rem] bg-ink p-2 shadow-lift ${className}`}>
      <div className="relative isolate overflow-hidden rounded-[2.1rem] bg-cream aspect-[390/844]">
        <Banana aria-hidden weight="duotone" className="absolute inset-0 m-auto size-1/4 text-banana-ink/20 -z-10" />
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover object-top" priority={priority} />
      </div>
    </div>
  );
}
