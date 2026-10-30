export const CONFIG = {
  "slug": "R08_bascula",
  "captura": "public/landing/progreso.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "La báscula no lo dice todo",
      "visual": "Mancuernas junto a una báscula sin lectura visible.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Observa también tu fuerza",
      "visual": "Manos sujetan mancuernas, movimiento controlado.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Lleva un registro de tus medidas",
      "visual": "Cinta métrica sobre mesa; sin cuerpo ni cifras.",
      "tipo": "texto"
    },
    {
      "id": "t4",
      "texto": "Abre Progreso",
      "visual": "Captura real de Progreso, completa.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Revisa tu registro con perspectiva",
      "visual": "Acercamiento al registro original sin alterar datos.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t6",
      "texto": "Tu proceso merece seguimiento",
      "visual": "Persona prepara su equipo, sin comparación corporal.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "No sustituye la indicación de tu médico.",
      "visual": "Tarjeta paper con la advertencia sola.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Sigue construyendo tu hábito",
      "visual": "Captura real de Progreso, sin resultados prometidos.",
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
