export const CONFIG = {
  "slug": "A01_un-ano-un-pago",
  "captura": "public/landing/oferta.webp",
  "escenas": [
    {
      "id": "t1",
      "texto": "Un año. Un solo pago.",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Entreno: $59.99 al año",
      "visual": "Tarjeta tipográfica sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Oferta mensual: primer mes con tarjeta",
      "visual": "Captura real de Mi plan: promoción mensual, no precio anual. Sin alterar cifras.",
      "tipo": "telefono",
      "etiqueta": "Mensual"
    },
    {
      "id": "t4",
      "texto": "Sin pagar mes a mes",
      "visual": "Tarjeta tipográfica sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t5",
      "texto": "Entreno + Nutrición: $89.99 al año",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t6",
      "texto": "Un solo pago por doce meses",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Incluye una temporada deportiva por año pagado",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
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
