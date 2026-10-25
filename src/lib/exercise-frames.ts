// Ilustraciones de técnica del mono Banana Burn (Higgsfield): una hoja 2x2 por ejercicio con 4 fotogramas
// del mismo plano (inicio, 1/3, 2/3, final), leídos de izquierda a derecha y de arriba abajo.
//
// REGLA: una hoja solo se usa para SU movimiento. Cada hoja de aquí fue revisada a mano (ejercicio correcto, rango
// completo, mismo encuadre, sin extremidades de más ni pesas flotando). Si un ejercicio no tiene su hoja, no se
// muestra ninguna animación (la interfaz muestra el respaldo quieto), nunca la de otro movimiento "parecido".
// La lista de qué ejercicio muestra qué hoja está en src/lib/technique-audit.ts y la vigila technique-audit.test.ts.
export const FRAMES_HOST = "https://d8j0ntlcm91z4.cloudfront.net";
const BASE = `${FRAMES_HOST}/user_3KlOTMXim7g88SAyF4A03SG6JZ6/`;
const SHEETS: Record<string, string> = {
  squat: "hf_20261022_154059_936b68e1-61a5-4fb2-b326-b0e5a7d8e38c",
  frontsquat: "hf_20261022_154057_18122b42-60e0-47b2-8660-8b19146e76cc",
  bench: "hf_20261022_154057_0f54f425-28fd-4663-8ed1-35029992aa4b",
  incline: "hf_20261022_154057_81323230-e53a-470a-980f-01832686cddb",
  ohp: "hf_20261022_154240_afdb3d56-86ee-429d-9b64-8d350fdd77de",
  dbpress: "hf_20261022_154240_e9e3a4df-eb1f-499a-9464-33d1f51901c8",
  deadlift: "hf_20261022_154239_079cef7e-e411-43b6-b469-cc97981d22a3",
  rdl: "hf_20261022_154241_bad03623-27e3-4938-94d0-183e338795cc",
  pullup: "hf_20261022_154734_579bfb76-079f-4d93-a3ad-1c5a927e5faa",
  dips: "hf_20261022_154738_86ff6a7a-abbe-434c-971b-45fc33df30dc",
  row: "hf_20261022_154736_67cc4987-22bb-4b95-b305-af0c853be293",
  dbrow: "hf_20261022_154738_e9f7a532-d120-4e3e-9855-c7a23bc1fc0b",
  curl: "hf_20261022_154814_cf8ec176-daaf-4db4-b1e5-06158066edd7",
  facepull: "hf_20261022_154815_9fcb0b1f-6fe2-4d42-a885-106b4cbc58c0",
  // Flexión rehecha (24/10): la de antes subía la cadera en V en los primeros fotogramas.
  pushup: "hf_20261024_074217_03869be3-2a95-492a-83e9-d600bbe3d01e",
  plank: "hf_20261022_154813_ee3c066a-2e6a-4350-a526-796b91e53229",
  kneeraise: "hf_20261022_154852_36577118-5ba1-4819-b402-7c3a526ec02a",
  carry: "hf_20261022_154851_8dc7c8a4-62c7-4e50-bbdb-14dc909b2357",
  lateral: "hf_20261022_154851_7e9fec82-4c44-4714-99d7-2274dd193230",
  squat_bw: "hf_20261022_154851_a47512d9-0037-425b-99ab-04313746da34",
  jump_bw: "hf_20261022_154925_6996c74f-273c-4bde-ab5f-8c813b1650fb",
  /** Bisagra de cadera con peso corporal, dos pies (no es a una pierna: esa es slrdl). */
  rdl_bw: "hf_20261022_154926_bad18ac8-9c30-4938-a2e6-e72f43f80635",
  /** Curl con mancuernas en agarre neutro (martillo); el nombre "_bw" es histórico. */
  curl_bw: "hf_20261022_154925_2df2cca4-7c65-4f5c-ac7e-66378c1e9d85",
  burpee: "hf_20261022_155002_e04e9893-63de-4225-a474-bc67e0e228f3",
  // Escaladores rehechos (24/10): en la de antes las rodillas casi no llegaban al pecho.
  mountain: "hf_20261024_080826_14cf229c-5179-439b-b0d3-1d59425ae2a4",
  // Hojas nuevas (24/10, gpt_image_2_5): un movimiento propio para cada ejercicio que antes mostraba otro.
  lat: "hf_20261024_074216_0576e98d-06d5-48fd-9a0c-2f0abf195e6c",
  goblet: "hf_20261024_074217_bf54bdf3-df50-45c8-8c22-fc3b718bfbad",
  reardelt: "hf_20261024_074340_46d18fb8-8384-4091-917d-3bb0898dfe68",
  lunge: "hf_20261024_074340_229bd2ad-a1b1-47bb-8244-0cd47b5096c4",
  glutebridge: "hf_20261024_074341_8c99212a-1380-4481-9dea-14594d5373d5",
  hipthrust: "hf_20261024_074341_4124236d-57c1-4505-82f9-1a62130da81f",
  bicycle: "hf_20261024_074516_89787a23-b7e1-4f59-b56c-7e6d3d07292c",
  jacks: "hf_20261024_074516_20c3137f-a809-4292-b565-c72a261972b8",
  pikepush: "hf_20261024_074515_f38242c4-304e-4ca7-acee-b2bad359dbeb",
  ytw: "hf_20261024_074516_73e95fad-5f71-4fff-bf3b-8cf15122c34e",
  legraisef: "hf_20261024_074622_c3705fc7-7b62-4c71-8065-08dff328a0fe",
  invrow: "hf_20261024_074622_c63206b9-d4fb-45f4-9ba7-ea0baac1ff46",
  floorpress: "hf_20261024_074622_7cc69fda-6062-4c68-b979-927c61141ee9",
  bulgarian: "hf_20261024_074622_bfd9514a-5e9d-4032-94a5-dcf29e3d511c",
  bearcrawl: "hf_20261024_074726_6545885d-e770-4964-b888-a9a4f7f66d05",
  legraise: "hf_20261024_074726_8c16a3a9-eaf0-4d7e-a588-d46a17b2bef4",
  lateralc: "hf_20261024_074727_f143694f-dda7-4697-b547-78e18b9bd4a9",
  pushupd: "hf_20261024_074726_41b320c9-4651-4cae-87a2-4c6facb4b96c",
  pushupe: "hf_20261024_074911_9db894ce-f8d1-48a9-9928-1bc8763b037a",
  dbrdl: "hf_20261024_074911_9c70bd63-9fe8-462b-a49d-bd8bbd88b69a",
  slrdl: "hf_20261024_074912_2edd8e29-a552-4c22-a0dc-9408187b4dac",
  suitcase: "hf_20261024_074912_b2529cbd-11c8-44f5-972f-1b908c76fcdd",
  planktap: "hf_20261024_075005_a7136403-caa3-4a26-9f86-27901eef4b0a",
  legpress: "hf_20261024_075006_8abfb808-9658-4240-a459-f2ed261a7dc7",
  cablerow: "hf_20261024_075006_1547f804-0779-4b5c-aef1-08a3e69f8101",
  legcurl: "hf_20261024_075005_d75ee728-b1fc-4b20-9810-0c14465be58d",
  /** Rodillas con giro: la IA dibujó el giro hacia un solo lado (válido, alterna en la práctica). */
  twistraise: "hf_20261024_075430_3782479a-ec9f-46ea-bb07-b667bf89f65e",
  laterall: "hf_20261024_075430_8e6f3684-4bd6-4ea0-9578-d09f2088f3f5",
  bandpull: "hf_20261024_075429_8caebf31-13c9-45f7-9be4-18bddbbc9932",
  towelcurl: "hf_20261024_075429_66e69d3c-ab15-487e-97e8-fc90f3bdc750",
  // Ejercicios de la biblioteca que usan los programas (ds:XXXX).
  monsterwalk: "hf_20261024_075952_4f4e3116-a8bf-449a-92e6-80b13be646c5",
  deadbug: "hf_20261024_075952_8d20176f-5b34-43fc-bab8-5b57afd5c280",
  sideplank: "hf_20261024_075952_40ddf102-c4e7-48ee-9482-72428c54a2d0",
  sideabd: "hf_20261024_075952_09456697-e3be-4880-90b6-db6bf5aa800b",
  pushdown: "hf_20261024_080128_785cc065-5648-41f9-853f-83a66057d74c",
  dbrearlunge: "hf_20261024_080129_aae8a765-e5f2-4ab1-b2eb-fdb9a7501c51",
  stepup: "hf_20261024_080128_4db738cf-0652-4917-92dc-bd1d9ca7f65b",
  abductor: "hf_20261024_080128_9566cb1b-db36-4d4c-bc3c-b180a09ede02",
  kickback: "hf_20261024_080305_f9eac379-ed5d-4157-9633-f4859b3722db",
  ohext: "hf_20261024_080307_0ab36081-db02-4f5a-8514-863acb814878",
  preacher: "hf_20261024_080306_e4b25386-d857-4dec-a02a-90ee6dc29c76",
  cableohext: "hf_20261024_080414_5a0f7ddb-9665-4e27-88a2-1cda826a9af0",
  inclinecurl: "hf_20261024_080413_216907f9-7d12-4cc8-b088-143dbacb676f",
  russiantwist: "hf_20261024_080414_ea900c65-4049-42ff-b7ac-8a9699335048",
  revcrunch: "hf_20261024_080414_354123f4-8e21-40fd-af71-d637df66f34c",
  cablecrunch: "hf_20261024_080731_d063d1a2-72e0-4b52-8f09-418c5f1e5d50",
  crunch: "hf_20261024_080732_89ed10e2-64e7-4539-acdf-b35206ebbcfc",
  dbslrdl: "hf_20261024_080732_de3c8419-7027-4a05-856d-6d0c54cda140",
  flutter: "hf_20261024_080825_d412cefe-311e-4628-8988-aeec71806f96",
  scappull: "hf_20261024_080826_95fd6f34-1a31-4d7a-be2c-180c5e698b90",
  bandpullup: "hf_20261024_080825_bf789886-c77c-4ce4-92a0-89e4c8ff823f",
  sideplankabd: "hf_20261024_080915_ee02929f-f3df-44cb-90f0-ff61e519f3ed",
  cablehipext: "hf_20261024_081013_becddf32-55cf-4244-9647-52946b1ad665",
  bridgemarch: "hf_20261024_081013_4f489c67-86af-4599-ad5f-165813876828",
  // Temporadas (25/10, gpt_image_2_5): un movimiento propio para cada ejercicio de las temporadas, revisado cuadro por cuadro.
  // Rehechas tras revisión: cargada colgante (el brazo libre iba al frente; ahora termina en rack), pantorrillas (talones más altos) y giro de columna (rotación visible).
  calfraise: "hf_20261025_061749_b0908cc1-a23b-498b-836b-908e74476f85",
  calfraise_db: "hf_20261025_061749_0f3f5438-aca4-4868-b085-ad58ff4e7597",
  calfseated: "hf_20261025_055752_27aeb5c4-e3fb-48da-87b3-1d0d974655b0",
  calfstretch: "hf_20261025_055356_6c4770d3-8652-4f2f-9e5a-cf433b79728a",
  nordic: "hf_20261025_055612_72e3e549-bd98-4d7a-a347-654f65fae44c",
  slbridge: "hf_20261025_055614_79445b07-f765-43f0-97b7-605a1beca08d",
  pallof: "hf_20261025_060040_be0ad02f-374c-439b-9b5e-354d778ec9ec",
  cabletwist: "hf_20261025_055658_5e288599-4f8b-41c5-9395-736896ee2342",
  sideplankadd: "hf_20261025_055751_38cceb25-63a0-4126-b614-ab080ed0506b",
  extrotcable: "hf_20261025_055657_688b9f41-2043-4acb-b91a-a715a34e0d58",
  extrotdb: "hf_20261025_055657_5843eb6a-3aa6-4001-ae01-60f70508649f",
  wristcurlband: "hf_20261025_055905_df2d7494-27f3-4b15-8b6d-79b198b5c82a",
  wristextband: "hf_20261025_060040_2c0fa309-ee11-452c-987e-002a830960bc",
  laterallunge: "hf_20261025_055904_ba3b9bd4-3216-4095-ac53-006b1a3175e7",
  skater: "hf_20261025_055905_6de78b48-a07d-4414-8e39-ce8361c096ae",
  jumprope: "hf_20261025_055905_6057ab5d-fcf0-4ac5-816c-c8455201d21b",
  mbslam: "hf_20261025_055956_283702bf-b7d6-4a1d-9b29-07021a5a9579",
  kbswing: "hf_20261025_055955_06b992f3-c3d2-4826-a137-454648173818",
  kbclean: "hf_20261025_061707_4bd447ab-1811-499a-bd45-fbdcde9197c1",
  pushpress: "hf_20261025_055955_d72190e5-0171-4f80-814b-19d1ec52a3a3",
  kbthruster: "hf_20261025_060040_cfd03388-92a0-4e48-a930-bd03ad9c2498",
  skierg: "hf_20261025_060040_76fa903a-23ca-4802-9da2-015247d2b618",
  sidestretch: "hf_20261025_060126_f269de46-cdf6-4f97-b7f3-16af672cce39",
  spinestretch: "hf_20261025_060127_00370aa7-07c6-4e4f-b82e-4c530fbb60eb",
  hamstretch: "hf_20261025_060127_b10d0051-0eda-43df-a90d-8b2cb5fb5f40",
  spinetwist: "hf_20261025_061958_9b293a75-29bf-41ea-98da-93ae03ff85b6",
};

/** Hojas 3x3 (9 fotogramas, movimiento más suave). Si un ejercicio está aquí, tiene prioridad sobre la 2x2. */
/**
 * Celdas de cada hoja 3x3 en orden A -> B, revisadas a mano. La IA no dibuja las 9 poses en orden ni con el mismo
 * encuadre, así que solo usamos las que avanzan en una sola dirección y casi siempre de la misma fila (mismo encuadre).
 * Revisión 24/10: sentadilla llega a la profundidad completa (7); dominada sin las celdas 5-8 (las manos se
 * despegan de la barra); rodillas sin la celda 2 (otro encuadre); laterales hasta la altura del hombro (7).
 */
const CELLS9: Record<string, number[]> = {
  squat: [0, 1, 2, 4, 7], bench: [0, 2, 4, 5], incline: [0, 1, 2], ohp: [0, 2, 5], dbpress: [0, 3, 5],
  deadlift: [0, 2, 4, 7], rdl: [0, 2, 4, 7], pullup: [0, 1, 2, 4], dips: [0, 1, 2], row: [3, 4, 5],
  dbrow: [0, 1, 2], curl: [0, 2, 5], facepull: [0, 1, 2], kneeraise: [0, 3, 5], lateral: [0, 1, 2, 5, 7],
  rdl_bw: [0, 3, 4, 7], curl_bw: [0, 2, 5, 7], squat_bw: [0, 1, 2, 4],
};

const SHEETS9: Record<string, string> = {
  squat: "hf_20261022_193500_134951fd-cb17-4d70-b863-8a2bb4b64a42",
  bench: "hf_20261022_193952_63fa76be-2863-45c5-ad81-469f9f437277",
  incline: "hf_20261022_193953_c711e75d-b416-4df1-ba05-b3d0b6b7c5c7",
  ohp: "hf_20261022_193952_327fc2eb-abd9-46b3-8a1c-480f5324bd60",
  dbpress: "hf_20261022_194128_decf710a-a700-45e2-a803-fd8a77f57bf7",
  deadlift: "hf_20261022_194127_c803a65b-1d3d-4c0b-9281-9c4c582c2626",
  rdl: "hf_20261022_194127_a9781e36-cbd7-459b-a092-31188a2b2284",
  pullup: "hf_20261022_194128_a1b33784-ee4e-4e60-9e7b-a53e33238c6b",
  dips: "hf_20261022_194218_12ef17cc-d7c7-4334-b96c-4dff7ba2d78d",
  row: "hf_20261022_194218_281ff0ce-11f1-4d33-a4c4-2e282c279902",
  dbrow: "hf_20261022_194218_14b06534-7d15-456e-ab3d-5a91acadd2ce",
  curl: "hf_20261022_194217_e01d3483-e58d-4b9e-bb75-63a0923e2b0b",
  facepull: "hf_20261022_194256_30b75f90-163b-4256-a47f-321a5958328f",
  kneeraise: "hf_20261022_194257_56f85098-fad3-4cc5-a289-e44627ecd144",
  lateral: "hf_20261022_194255_0a36523b-52c0-49f1-a5a4-05cd11538e20",
  rdl_bw: "hf_20261022_194333_f4e7aebd-7c3d-4fcc-bf7f-56395aad10b6",
  curl_bw: "hf_20261022_194334_6c78815b-3ef2-4ab1-b13b-6da75850edd8",
  squat_bw: "hf_20261022_194400_aa202a71-3406-48c4-834c-a5192740f675",
};

/** Hoja de fotogramas de una animación (URL y lado de la cuadrícula), o null si no hay ilustración. */
export function sheetFor(anim: string): { url: string; grid: 2 | 3; cells?: number[] } | null {
  if (!anim) return null;
  if (SHEETS9[anim]) return { url: `${BASE}${SHEETS9[anim]}.png`, grid: 3, cells: CELLS9[anim] };
  const s = SHEETS[anim];
  return s ? { url: `${BASE}${s}.png`, grid: 2 } : null;
}

/** Todas las animaciones con hoja revisada. */
export const ANIM_KEYS: readonly string[] = Object.keys(SHEETS);

/** Movimientos con técnica animada del mono (para cifras reales en el landing). */
export const TECHNIQUE_COUNT = ANIM_KEYS.length;

export type SheetPhase = [string | number, number, string, "ecc" | "con" | "hold" | "air"];
export type SheetDir = "up" | "down" | "forward" | "back" | "out" | "in" | "none";

/**
 * Fases y dirección del esfuerzo de las hojas que no tienen modelo en motion.ts (las nuevas), o cuyo orden de
 * fotogramas no coincide con el de motion.ts (salto: la hoja va de la media sentadilla al aire).
 * Fotograma "A" = el primero, "B" = el último; un número es la celda (0 a 3) y con `loop` se funden en ciclo.
 */
const up = (bajada: string, abajo: string, sube: string, arriba: string, slow = 3): SheetPhase[] => [["B", slow, bajada, "ecc"], ["B", 0.5, abajo, "hold"], ["A", 1, sube, "con"], ["A", 0.6, arriba, "hold"]];
const pull = (tira: string, pausa: string, vuelve: string, estira: string): SheetPhase[] => [["B", 1, tira, "con"], ["B", 0.7, pausa, "hold"], ["A", 2.5, vuelve, "ecc"], ["A", 0.5, estira, "hold"]];
export const SHEET_MOTION: Record<string, { ph: SheetPhase[]; loop?: boolean; dir: SheetDir }> = {
  jump_bw: { dir: "up", ph: [["B", 0.4, "¡Salta!", "con"], ["B", 0.3, "Estírate en el aire", "air"], ["A", 0.6, "Aterriza suave", "ecc"], ["A", 0.6, "Baja y carga", "hold"]] },
  lat: { dir: "down", ph: pull("Codos a los bolsillos", "Barra al pecho", "Sube en 3 segundos", "Estira arriba") },
  goblet: { dir: "up", ph: up("Baja en 3 segundos", "Codos entre rodillas", "Sube fuerte", "Pecho arriba") },
  reardelt: { dir: "out", ph: pull("Abre los brazos", "Junta escápulas", "Baja lento", "Espalda plana") },
  lunge: { dir: "up", ph: up("Paso largo y baja", "Rodilla cerca del piso", "Empuja con el talón", "Torso alto", 2) },
  glutebridge: { dir: "up", ph: pull("Sube la cadera", "Aprieta glúteo 2 s", "Baja lento", "Costillas abajo") },
  hipthrust: { dir: "up", ph: pull("Empuja con la cadera", "Aprieta glúteo", "Baja lento", "Mentón adentro") },
  bicycle: { loop: true, dir: "none", ph: [[1, 0.6, "Codo a la rodilla", "con"], [2, 0.4, "Al centro", "air"], [3, 0.6, "Cambia de lado", "con"], [0, 0.4, "Al centro", "air"]] },
  jacks: { loop: true, dir: "none", ph: [[1, 0.22, "Abre", "con"], [2, 0.22, "Brazos arriba", "con"], [3, 0.3, "Cierra", "ecc"], [0, 0.16, "Aterriza suave", "hold"]] },
  pikepush: { dir: "up", ph: up("Cabeza al piso en 3 s", "Cadera alta", "Empuja fuerte", "Brazos largos") },
  ytw: { loop: true, dir: "none", ph: [[1, 1.3, "Y: pulgares arriba", "hold"], [2, 1.3, "T: brazos en cruz", "hold"], [3, 1.3, "W: junta escápulas", "hold"], [0, 0.9, "Baja y respira", "ecc"]] },
  legraisef: { dir: "up", ph: pull("Sube las piernas", "Arriba, sin impulso", "Baja en cámara lenta", "Espalda baja pegada") },
  invrow: { dir: "up", ph: pull("Pecho a la barra", "Aprieta escápulas", "Baja en 3 segundos", "Cuerpo en tabla") },
  floorpress: { dir: "up", ph: up("Baja en 3 segundos", "Brazos tocan el piso", "Empuja fuerte", "Escápulas atrás") },
  bulgarian: { dir: "up", ph: up("Baja recto en 3 s", "Rodilla cerca del piso", "Sube con la pierna de adelante", "Torso alto") },
  bearcrawl: { loop: true, dir: "none", ph: [[1, 0.45, "Mano y pie contrario", "con"], [2, 0.35, "Rodillas bajitas", "air"], [3, 0.45, "Cambia de lado", "con"], [0, 0.35, "Espalda plana", "air"]] },
  legraise: { dir: "up", ph: pull("Piernas rectas arriba", "Sin balanceo", "Baja lento", "Hombros activos") },
  lateralc: { dir: "up", ph: pull("Sube con el codo", "Pausa a la altura del hombro", "Baja en 3 segundos", "Torso quieto") },
  pushupd: { dir: "up", ph: up("Baja en 3 segundos", "Codos pegados", "Empuja fuerte", "Cuerpo en tabla") },
  pushupe: { dir: "up", ph: up("Baja en 3 segundos", "Pecho cerca del piso", "Empuja fuerte", "Cuerpo en tabla") },
  dbrdl: { dir: "up", ph: up("Cadera atrás en 3 s", "Estira femorales", "Cadera adelante", "Aprieta glúteo") },
  slrdl: { dir: "up", ph: up("Cadera atrás, pierna atrás", "Cuerpo en T", "Vuelve apretando glúteo", "Cadera cuadrada") },
  suitcase: { loop: true, dir: "none", ph: [[1, 0.55, "Paso firme", "air"], [2, 0.55, "Torso recto", "air"], [3, 0.55, "Hombros nivelados", "air"], [0, 0.55, "Sin inclinarte", "air"]] },
  planktap: { loop: true, dir: "none", ph: [[1, 0.6, "Toca el hombro", "con"], [2, 0.5, "Cadera quieta", "hold"], [3, 0.6, "Otro lado", "con"], [0, 0.5, "Cuerpo en línea", "hold"]] },
  legpress: { dir: "up", ph: up("Baja en 3 segundos", "Espalda pegada", "Empuja con los talones", "Sin bloquear rodillas") },
  cablerow: { dir: "back", ph: pull("Codos atrás", "Aprieta escápulas", "Estira en 3 segundos", "Torso quieto") },
  legcurl: { dir: "up", ph: pull("Talones al glúteo", "Aprieta", "Baja en 3 segundos", "Cadera pegada") },
  twistraise: { dir: "up", ph: pull("Rodillas al hombro", "Gira con el abdomen", "Baja lento", "Sin balanceo") },
  laterall: { dir: "out", ph: pull("Abre los brazos", "Altura del hombro", "Baja en 3 segundos", "Pecho en el banco") },
  bandpull: { dir: "down", ph: pull("Codos a las costillas", "Pecho alto", "Vuelve lento", "Banda tensa") },
  monsterwalk: { loop: true, dir: "none", ph: [[1, 0.5, "Paso al lado", "con"], [2, 0.5, "Rodillas afuera", "air"], [3, 0.5, "Otro paso", "con"], [0, 0.5, "Siempre abajo", "air"]] },
  deadbug: { loop: true, dir: "none", ph: [[1, 1, "Brazo y pierna contrarios", "ecc"], [2, 0.7, "Vuelve al centro", "con"], [3, 1, "Cambia de lado", "ecc"], [0, 0.7, "Espalda baja pegada", "con"]] },
  sideplank: { dir: "up", ph: [["B", 1.2, "Sube la cadera", "con"], ["B", 2.5, "Cuerpo en línea", "hold"], ["A", 1, "Baja controlado", "ecc"], ["A", 0.5, "Codo bajo el hombro", "hold"]] },
  sideabd: { dir: "up", ph: pull("Sube la pierna", "Punta al frente", "Baja lento", "Cadera quieta") },
  pushdown: { dir: "down", ph: pull("Estira los brazos", "Aprieta tríceps", "Sube en 3 segundos", "Codos pegados") },
  dbrearlunge: { dir: "up", ph: up("Paso atrás y baja", "Rodilla cerca del piso", "Empuja con el talón de adelante", "Torso alto", 2) },
  stepup: { dir: "up", ph: [["B", 1.2, "Empuja con el talón", "con"], ["B", 0.5, "Arriba, cadera extendida", "hold"], ["A", 2, "Baja controlado", "ecc"], ["A", 0.5, "Pie entero en el cajón", "hold"]] },
  abductor: { dir: "out", ph: pull("Abre las rodillas", "Aprieta glúteo", "Cierra en 3 segundos", "Espalda pegada") },
  kickback: { dir: "back", ph: pull("Estira hacia atrás", "Aprieta tríceps", "Vuelve lento", "Brazo pegado") },
  ohext: { dir: "up", ph: up("Baja detrás de la cabeza", "Codos al techo", "Estira fuerte", "Costillas abajo") },
  preacher: { dir: "up", ph: pull("Sube sin balanceo", "Aprieta bíceps", "Baja en 3 segundos", "Brazo en el cojín") },
  cableohext: { dir: "forward", ph: pull("Estira al frente", "Aprieta tríceps", "Vuelve lento", "Codos fijos") },
  inclinecurl: { dir: "up", ph: pull("Sube sin mover el codo", "Aprieta bíceps", "Baja en 3 segundos", "Estira abajo") },
  russiantwist: { loop: true, dir: "none", ph: [[1, 0.6, "Gira con el torso", "con"], [2, 0.4, "Al centro", "air"], [3, 0.6, "Al otro lado", "con"], [0, 0.4, "Pecho arriba", "air"]] },
  revcrunch: { dir: "up", ph: pull("Rodillas al pecho", "Despega la cadera", "Baja lento", "Sin impulso") },
  cablecrunch: { dir: "down", ph: pull("Enrolla la columna", "Codos a los muslos", "Sube lento", "Cadera quieta") },
  crunch: { dir: "up", ph: pull("Despega los hombros", "Aprieta abdomen", "Baja lento", "Cuello relajado") },
  dbslrdl: { dir: "up", ph: up("Cadera atrás, pierna atrás", "Cuerpo en T", "Vuelve apretando glúteo", "Cadera cuadrada") },
  flutter: { loop: true, dir: "none", ph: [[1, 0.3, "Tijera corta", "con"], [2, 0.25, "Piernas largas", "air"], [3, 0.3, "Cambia", "con"], [0, 0.25, "Espalda baja pegada", "air"]] },
  scappull: { dir: "up", ph: pull("Baja los hombros", "Pecho arriba", "Suelta lento", "Brazos rectos") },
  bandpullup: { dir: "up", ph: pull("Tira con la espalda", "Barbilla arriba", "Baja en 3 segundos", "Rodilla en la banda") },
  sideplankabd: { dir: "up", ph: pull("Sube la pierna de arriba", "Cadera alta", "Baja lento", "Cuerpo en línea") },
  cablehipext: { dir: "back", ph: pull("Pierna atrás", "Aprieta glúteo", "Vuelve lento", "Torso alto") },
  bridgemarch: { loop: true, dir: "none", ph: [[1, 0.8, "Rodilla arriba", "con"], [2, 0.6, "Cadera alta", "hold"], [3, 0.8, "Otra rodilla", "con"], [0, 0.6, "Sin dejar caer la cadera", "hold"]] },
  towelcurl: { dir: "none", ph: [["B", 1.2, "Tira de la toalla", "con"], ["B", 2.5, "Aguanta con todo", "hold"], ["A", 1, "Suelta y respira", "ecc"]] },
  // Temporadas (25/10)
  calfraise: { dir: "up", ph: pull("Sube en puntas", "Arriba 1 segundo", "Baja en 2 segundos", "Rodillas rectas") },
  calfraise_db: { dir: "up", ph: pull("Sube en puntas", "Arriba 1 segundo", "Baja en 2 segundos", "Brazos sueltos") },
  calfseated: { dir: "up", ph: pull("Talones arriba", "Aprieta 1 segundo", "Baja lento", "Rodillas a 90 grados") },
  calfstretch: { dir: "forward", ph: [["B", 1.2, "Inclínate a la pared", "ecc"], ["B", 3, "Talón de atrás abajo", "hold"], ["A", 1, "Vuelve despacio", "con"], ["A", 0.6, "Pierna de atrás recta", "hold"]] },
  nordic: { dir: "down", ph: [["B", 3, "Baja lo más lento posible", "ecc"], ["B", 0.5, "Atrapa con las manos", "hold"], ["A", 1.2, "Empuja y vuelve arriba", "con"], ["A", 0.6, "Cadera recta", "hold"]] },
  slbridge: { dir: "up", ph: pull("Sube la cadera", "Pelvis nivelada", "Baja lento", "Pierna estirada") },
  pallof: { dir: "forward", ph: pull("Brazos al frente", "Aguanta sin girar", "Vuelve al pecho", "Tronco firme") },
  cabletwist: { dir: "out", ph: pull("Gira desde la cadera", "Brazos largos", "Vuelve controlado", "Pies firmes") },
  sideplankadd: { dir: "up", ph: pull("Sube la pierna de abajo", "Cadera alta", "Baja lento", "Pie arriba en el banco") },
  extrotcable: { dir: "out", ph: pull("Gira hacia afuera", "Codo pegado", "Vuelve en 3 segundos", "Antebrazo como bisagra") },
  extrotdb: { dir: "up", ph: pull("Gira hacia arriba", "Codo a la altura del hombro", "Baja en 3 segundos", "Brazo quieto") },
  wristcurlband: { dir: "up", ph: pull("Sube la muñeca", "Aprieta", "Baja lento", "Antebrazo quieto") },
  wristextband: { dir: "up", ph: pull("Levanta el dorso", "Pausa arriba", "Baja en 4 segundos", "Palma abajo") },
  laterallunge: { dir: "up", ph: up("Paso al lado y siéntate", "Cadera atrás", "Empuja y vuelve", "Pecho alto", 2) },
  skater: { loop: true, dir: "none", ph: [[1, 0.35, "Impulso lateral", "con"], [2, 0.3, "En el aire", "air"], [3, 0.6, "Cae firme", "hold"], [0, 0.6, "Rodilla sobre el pie", "hold"]] },
  jumprope: { loop: true, dir: "none", ph: [[1, 0.15, "Gira con las muñecas", "con"], [2, 0.15, "Salto corto", "air"], [3, 0.15, "Cae en puntas", "ecc"], [0, 0.15, "Codos pegados", "hold"]] },
  mbslam: { dir: "down", ph: [[1, 0.6, "Arriba, todo el cuerpo", "con"], [2, 0.35, "¡Lánzalo al piso!", "con"], [3, 0.6, "Espalda plana", "hold"], [0, 0.8, "Recoge y repite", "ecc"]] },
  kbswing: { loop: true, dir: "forward", ph: [[1, 0.35, "Empuja con la cadera", "con"], [2, 0.4, "Hasta el pecho", "air"], [3, 0.35, "Deja que baje", "ecc"], [0, 0.4, "Cadera atrás", "hold"]] },
  kbclean: { dir: "up", ph: [["B", 0.6, "Cadera y codo arriba", "con"], ["B", 0.8, "Recibe en el pecho", "hold"], ["A", 1, "Baja controlado", "ecc"], ["A", 0.5, "Espalda plana", "hold"]] },
  pushpress: { dir: "up", ph: [[1, 0.3, "Flexión corta", "ecc"], [2, 0.35, "Empuja con las piernas", "con"], [3, 0.7, "Bloquea arriba", "hold"], [0, 1.2, "Baja a los hombros", "ecc"]] },
  kbthruster: { dir: "up", ph: [[1, 1.5, "Sentadilla profunda", "ecc"], [2, 0.5, "Sube fuerte", "con"], [3, 0.6, "Empuja arriba", "hold"], [0, 1, "Baja al pecho", "ecc"]] },
  skierg: { loop: true, dir: "down", ph: [[1, 0.35, "Jala hacia abajo", "con"], [2, 0.35, "Bisagra de cadera", "con"], [3, 0.4, "Manos a la cadera", "hold"], [0, 0.6, "Sube los brazos", "ecc"]] },
  sidestretch: { dir: "up", ph: [["B", 1.5, "Estira el brazo arriba", "ecc"], ["B", 3, "Respira lento", "hold"], ["A", 1.2, "Vuelve despacio", "con"], ["A", 0.8, "Rodillas juntas", "hold"]] },
  spinestretch: { dir: "forward", ph: [[1, 1, "Mentón al pecho", "ecc"], [2, 2, "Redondea la espalda", "hold"], [3, 1.5, "Sube vértebra por vértebra", "con"], [0, 1, "Siéntate alto", "hold"]] },
  hamstretch: { dir: "forward", ph: [["B", 1.5, "Cadera atrás", "ecc"], ["B", 3, "Espalda plana, respira", "hold"], ["A", 1.2, "Vuelve despacio", "con"], ["A", 0.6, "Punta del pie arriba", "hold"]] },
  spinetwist: { loop: true, dir: "none", ph: [[1, 1, "Gira desde la cintura", "ecc"], [2, 1.5, "Espalda alta", "hold"], [3, 1, "Vuelve al centro", "con"], [0, 1, "Cadera quieta", "hold"]] },
};
