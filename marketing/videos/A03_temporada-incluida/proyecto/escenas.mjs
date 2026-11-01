export const CONFIG = {
  "slug": "A03_temporada-incluida",
  "captura": "public/landing/oferta.webp",
  "escenas": [
    {
      "id": "t1",
      "texto": "Tu anual incluye una temporada",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Una temporada deportiva por cada año pagado",
      "visual": "Tarjeta tipográfica sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Entreno: $59.99 al año",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t4",
      "texto": "Entreno + Nutrición: $89.99 al año",
      "visual": "Tarjeta tipográfica sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t5",
      "texto": "Un año de plan, una temporada incluida",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t6",
      "texto": "Los retos Premium se compran aparte",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Oferta mensual: primer mes con tarjeta",
      "visual": "Captura real de Mi plan: promoción mensual, no precio anual. Sin alterar cifras.",
      "tipo": "telefono",
      "etiqueta": "Mensual"
    },
    {
      "id": "t8",
      "texto": "Compara planes en bananaburn.app/precios",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "cierre",
      "texto": "Empieza 7 días gratis en bananaburn.app",
      "visual": "Coach Banana señalando oficial, botón ink y logo.",
      "tipo": "cierre"
    }
  ]
};
export const FPS = 30;
export const versiones = { reel: { duracion: 19, paso: 2 }, anuncio: { duracion: 15, paso: 1.5 } };
export function linea(nombre) {
 const v = versiones[nombre];
 return CONFIG.escenas.map((e,i) => ({...e,inicio:i*v.paso,fin:i===8?v.duracion:(i+1)*v.paso}));
}
