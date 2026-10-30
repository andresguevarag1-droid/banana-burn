export const CONFIG = {
  "slug": "R07_gym-edificio",
  "captura": "public/landing/entreno.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "30 minutos en el gym del edificio",
      "visual": "Mano abre la puerta del gimnasio.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Empieza cerca de casa",
      "visual": "Plano amplio del gimnasio del edificio.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Abre tu entreno de hoy",
      "visual": "Captura real de Entreno, completa.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t4",
      "texto": "Revisa el ejercicio y las repeticiones",
      "visual": "Acercamiento al ejercicio real en la captura.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Prepara el equipo disponible",
      "visual": "Manos tomando una mancuerna ligera.",
      "tipo": "texto"
    },
    {
      "id": "t6",
      "texto": "Haz cada repetición con control",
      "visual": "Residente en banco, técnica revisada por alguien competente.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Registra tu sesión",
      "visual": "Regreso a captura de Entreno, sin simular guardado.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t8",
      "texto": "Haz espacio para volver",
      "visual": "Celular junto al banco, gimnasio tranquilo.",
      "tipo": "texto"
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
