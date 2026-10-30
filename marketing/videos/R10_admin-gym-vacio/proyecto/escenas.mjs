export const CONFIG = {
  "slug": "R10_admin-gym-vacio",
  "captura": "public/landing/hoy2.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "Administrador: el gym del condominio está vacío",
      "visual": "Plano propio de gimnasio vacío, sin atribuirlo a un cliente real.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Ofrece un plan para empezar",
      "visual": "Detalle de equipo disponible en el gimnasio.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Rutinas con el equipo disponible",
      "visual": "Captura real completa de Hoy.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t4",
      "texto": "Costa Rica: condominios aliados",
      "visual": "Tarjeta que delimita el alcance territorial y el convenio.",
      "tipo": "texto"
    },
    {
      "id": "t5",
      "texto": "Primer mes gratis para residentes",
      "visual": "Oferta condicionada por la tarjeta anterior; todos los residentes.",
      "tipo": "texto"
    },
    {
      "id": "t6",
      "texto": "La administración nunca paga",
      "visual": "Tarjeta sin prometer acceso a un panel.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Después, cada residente decide y paga",
      "visual": "Plano propio de equipo, sin simular testimonios.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Prueba general: siete días gratis",
      "visual": "Se distingue el cierre general del beneficio por convenio.",
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
