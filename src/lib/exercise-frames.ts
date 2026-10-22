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

/** URL de la hoja de fotogramas de una animación, o null si no hay ilustración. */
export function sheetFor(anim: string): string | null {
  const s = SHEETS[anim];
  return s ? `${BASE}${s}.png` : null;
}
