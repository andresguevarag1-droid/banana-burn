export const CONFIG = {
  "slug": "A02_ahorro-anual",
  "captura": "public/landing/oferta.webp",
  "escenas": [
    {
      "id": "t1",
      "texto": "¿Cuánto ahorras con el anual?",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Entreno: $9.99 al mes",
      "visual": "Tarjeta tipográfica sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Doce mensualidades: $119.88",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t4",
      "texto": "Entreno anual: $59.99",
      "visual": "Tarjeta tipográfica sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t5",
      "texto": "Ahorras $59.89 frente a doce mensualidades",
      "visual": "Tarjeta tipográfica; entrada de 300 ms, sin texto adicional.",
      "tipo": "texto"
    },
    {
      "id": "t6",
      "texto": "Entreno + Nutrición: ahorras $89.89 al año",
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
      "texto": "Compara doce mensualidades regulares en bananaburn.app/precios",
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
