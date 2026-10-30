export const CONFIG = {
  "slug": "R11_dia-inyeccion",
  "captura": "public/landing/entreno.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "Día de inyección: ¿entreno o descanso?",
      "visual": "Tarjeta educativa sin agujas, medicamentos ni cuerpos señalados.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "No hay una respuesta universal",
      "visual": "Tarjeta paper; no dar instrucciones individuales.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "El equipo médico orienta la actividad",
      "visual": "Manos dejando equipo en reposo; sin prescribir actividad.",
      "tipo": "texto"
    },
    {
      "id": "t4",
      "texto": "Conoce el registro de entreno",
      "visual": "Captura real completa de Entreno como ejemplo.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Banana Shield propone modo suave",
      "visual": "Tarjeta de función, sin etiquetar la captura como Shield.",
      "tipo": "texto"
    },
    {
      "id": "t6",
      "texto": "Incluido en Entreno + Nutrición",
      "visual": "Tarjeta de plan; no atribuirlo al plan Entreno.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "No sustituye la indicación de tu médico.",
      "visual": "Advertencia sola en tarjeta paper, grande y legible.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Explora la app sin tarjeta",
      "visual": "Captura real de Entreno como ejemplo, no recomendación.",
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
