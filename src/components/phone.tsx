import Image from "next/image";

/** Marco de teléfono con una captura real de la app. */
export function Phone({ src, alt, className = "", priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={`relative rounded-[2.6rem] bg-ink p-2 shadow-lift ${className}`}>
      <div className="relative overflow-hidden rounded-[2.1rem] bg-paper aspect-[390/844]">
        <Image src={src} alt={alt} fill sizes="(max-width: 640px) 280px, 320px" className="object-cover object-top" priority={priority} />
        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-24 rounded-full bg-ink" aria-hidden />
      </div>
    </div>
  );
}
