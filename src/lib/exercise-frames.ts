// Ilustraciones de técnica (mono Banana Burn) generadas con Higgsfield: pose inicial (A) y final (B).
export const FRAMES_HOST = "https://d8j0ntlcm91z4.cloudfront.net";
const BASE = `${FRAMES_HOST}/user_3KlOTMXim7g88SAyF4A03SG6JZ6/`;
const F: Record<string, [string, string]> = {
  squat: ["hf_20261022_090100_9e7ab3a7-d983-4baf-b343-723e704294ff", "hf_20261022_085725_9f158a44-14ce-4aee-97ff-6031e3da4d45"],
  frontsquat: ["hf_20261022_090059_ac857872-696e-4c53-942e-3b43c0db1d07", "hf_20261022_085726_766d0155-cafe-43d3-b43e-89f07fc63186"],
  bench: ["hf_20261022_090100_1410809b-1119-400a-b8b2-679703b39134", "hf_20261022_090100_50c1cd61-d551-49fa-b1d3-18c947c4a328"],
  incline: ["hf_20261022_085726_8c950f74-f7c1-4122-9ac9-ae9fc4d7c44f", "hf_20261022_090222_6b7a0028-c607-4003-bb05-6d603809a018"],
  ohp: ["hf_20261022_090222_f82bba53-1156-4799-acf3-88ce98312a6d", "hf_20261022_085726_c74bb2e7-8dae-4034-9abd-e8b6cda08d5d"],
  dbpress: ["hf_20261022_090222_a01ec14b-e96e-47e1-87fb-f39d99b9c7bf", "hf_20261022_090221_0a727e08-352e-46cc-8180-9a5caa1ccf8e"],
  deadlift: ["hf_20261022_090256_6903c40e-aacb-4940-a744-a6e953b73e80", "hf_20261022_090257_b16ac3fa-0c49-4897-8a26-7ca9ad422fc7"],
  rdl: ["hf_20261022_090259_af3690ae-5b75-4ac1-8eae-89d9d385498c", "hf_20261022_090257_c2bf3cc2-d70a-4110-9ce8-82fe4531653e"],
  pullup: ["hf_20261022_090336_b8e8f9f8-0e1d-4b33-976b-351b78c2982d", "hf_20261022_090336_6a45f9bb-84ef-41b8-ae1e-6659a35564ca"],
  dips: ["hf_20261022_090336_ce57a49f-c5f0-4d9b-8052-79d063ccfcab", "hf_20261022_090336_a5ab593d-13d4-4c0c-8e10-1e68332eac0f"],
  row: ["hf_20261022_090411_e2b4c42e-ddf1-45a6-9b05-3947f8f24766", "hf_20261022_090411_4b106da9-8cb9-4a05-bf19-e035aec9668d"],
  dbrow: ["hf_20261022_090412_18cfdade-e68c-4c42-8afd-e401e041e246", "hf_20261022_090410_8f919f43-b9cd-46bd-83cc-7b840c826a23"],
  curl: ["hf_20261022_090530_eba1c71b-666a-46e7-bcf3-6bdeb508e750", "hf_20261022_090529_b23c269e-e327-411f-b6f1-c6b5b73e8ebb"],
  facepull: ["hf_20261022_090529_fb6a6533-fa70-4c29-9d82-06f1b110edeb", "hf_20261022_090529_58d4d9de-1348-4c9d-bbbe-61e0939fcb94"],
  pushup: ["hf_20261022_090604_7887914d-f3d5-46d2-ba18-8f20cdfc71ef", "hf_20261022_090604_6b84e0b0-6a13-4bf9-b6b1-d83e22c8a17d"],
  plank: ["hf_20261022_090603_987dd47e-0d3c-49df-a28c-1a33bd594586", "hf_20261022_090603_987dd47e-0d3c-49df-a28c-1a33bd594586"],
  kneeraise: ["hf_20261022_090603_ce9fbc0e-f83d-4fe1-974b-d93cb48cc714", "hf_20261022_090635_5ec4956c-0cf6-4f8a-b2d8-bc5e8197629e"],
  carry: ["hf_20261022_090635_b5a98b80-f404-4531-8dcf-d31b2f6e9c5a", "hf_20261022_090909_0f2bdb5a-da6a-41ac-af59-ee30f02aceb3"],
  lateral: ["hf_20261022_090636_a5bbd15f-1c6e-4877-b81b-92146a921c1f", "hf_20261022_090635_f012b384-c154-4029-b536-c368436a0c5a"],
  squat_bw: ["hf_20261022_151001_86824576-c5ba-481d-9bbd-33d244f1ef0b", "hf_20261022_090707_09c4e7cd-d05a-4c06-a118-d243dfb6d868"],
  jump_bw: ["hf_20261022_090707_b09f3a33-ed73-4385-bfd8-1dfeae742b85", "hf_20261022_090706_886b898c-8b26-4c09-91b6-7ec96cbc5d48"],
  rdl_bw: ["hf_20261022_151002_563ce416-7cd8-4348-88e6-51ebae683ecd", "hf_20261022_090911_d1173b0b-809f-49f8-a36e-cf33cbf355a7"],
  curl_bw: ["hf_20261022_090910_8268a845-fd7b-4150-baab-5abdc5d8e6b3", "hf_20261022_090939_ae651948-45aa-4ac1-a71c-9fabd661c4e9"],
  burpee: ["hf_20261022_090938_4c0397e6-fd86-4ab8-b2ac-63233afba8cb", "hf_20261022_090939_593bf31d-4074-497f-a642-4914ff427eb9"],
  mountain: ["hf_20261022_090938_f5b06231-afe7-447c-9acb-7a3163dd9380", "hf_20261022_091001_2a88e0a1-cfb5-4d8b-b9c7-c44e2212e9cd"],
};

/** URLs de las poses A y B de una animación, o null si no hay ilustración. */
export function framesFor(anim: string): { A: string; B: string } | null {
  const f = F[anim];
  return f ? { A: `${BASE}${f[0]}.png`, B: `${BASE}${f[1]}.png` } : null;
}
