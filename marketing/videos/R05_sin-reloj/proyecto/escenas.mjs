export const CONFIG = {
  "slug": "R05_sin-reloj",
  "captura": "public/landing/running-ritmos.webp",
  "escenas": [
    {
      "id": "t1",
      "texto": "Sales a correr sin reloj",
      "visual": "Zapatillas entrando al parque. Gancho desde el cuadro 0.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Lleva tu celular",
      "visual": "Corredor de espaldas, celular sujeto con seguridad.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "El GPS registra tu recorrido",
      "visual": "Detalle del celular antes de empezar; nunca manipularlo corriendo.",
      "tipo": "texto"
    },
    {
      "id": "t4",
      "texto": "Consulta tu ritmo por kilómetro",
      "visual": "Captura real de Running: ritmos, completa.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Revisa tus parciales",
      "visual": "Acercamiento al bloque de parciales de la misma captura.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t6",
      "texto": "Corre a tu propio ritmo",
      "visual": "Zapatillas a ritmo cómodo, sin promesa de velocidad.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Sin comprar otro dispositivo",
      "visual": "Celular junto a las zapatillas; sin reloj en cuadro.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Tu próxima salida empieza aquí",
      "visual": "Captura real de ritmos, sin añadir resultados.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "cierre",
      "texto": "Empieza 7 días gratis en bananaburn.app",
      "visual": "Coach Banana señalando + botón ink + logo oficial.",
      "tipo": "cierre"
    }
  ]
};
export const FPS = 30;
export const versiones = { reel: { duracion: 19, paso: 2 }, anuncio: { duracion: 15, paso: 1.5 } };
export function linea(nombre) {
  const v = versiones[nombre];
  return CONFIG.escenas.map((e, i) => ({ ...e, inicio: i * v.paso, fin: i === 8 ? v.duracion : (i + 1) * v.paso }));
}
