// Ilustraciones de técnica del mono Banana Burn (Higgsfield): una hoja 2x2 por ejercicio con 4 fotogramas
// del mismo plano (inicio, 1/3, 2/3, final), leídos de izquierda a derecha y de arriba abajo.
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
  pushup: "hf_20261022_154813_c5007306-578e-4042-a85f-66bd035f577c",
  plank: "hf_20261022_154813_ee3c066a-2e6a-4350-a526-796b91e53229",
  kneeraise: "hf_20261022_154852_36577118-5ba1-4819-b402-7c3a526ec02a",
  carry: "hf_20261022_154851_8dc7c8a4-62c7-4e50-bbdb-14dc909b2357",
  lateral: "hf_20261022_154851_7e9fec82-4c44-4714-99d7-2274dd193230",
  squat_bw: "hf_20261022_154851_a47512d9-0037-425b-99ab-04313746da34",
  jump_bw: "hf_20261022_154925_6996c74f-273c-4bde-ab5f-8c813b1650fb",
  rdl_bw: "hf_20261022_154926_bad18ac8-9c30-4938-a2e6-e72f43f80635",
  curl_bw: "hf_20261022_154925_2df2cca4-7c65-4f5c-ac7e-66378c1e9d85",
  burpee: "hf_20261022_155002_e04e9893-63de-4225-a474-bc67e0e228f3",
  mountain: "hf_20261022_155001_46157424-f6d3-44fe-a9df-d0a5cdb273b7",
};

/** Hojas 3x3 (9 fotogramas, movimiento más suave). Si un ejercicio está aquí, tiene prioridad sobre la 2x2. */
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
export function sheetFor(anim: string): { url: string; grid: 2 | 3 } | null {
  if (SHEETS9[anim]) return { url: `${BASE}${SHEETS9[anim]}.png`, grid: 3 };
  const s = SHEETS[anim];
  return s ? { url: `${BASE}${s}.png`, grid: 2 } : null;
}

/** Movimientos con técnica animada del mono (para cifras reales en el landing). */
export const TECHNIQUE_COUNT = Object.keys(SHEETS).length;
