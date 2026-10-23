// Portadas ilustradas de los retos y programas: Coach Banana en la escena de cada reto (Higgsfield, 0028).
// Se sirven optimizadas por /_next/image (next.config.ts permite este CDN). Un reto sin portada usa la composición CSS.
const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3KlOTMXim7g88SAyF4A03SG6JZ6/";
const art = (id: string) => `${CDN}${id}_min.webp`;

export const CHALLENGE_ART: Record<string, string> = {
  // Programas Premium
  "reconstruccion-8-semanas": art("hf_20261023_173127_296cd6f0-484a-40a3-b8f0-0c850bd04500"),
  "gluteos-30": art("hf_20261023_173126_564b8f01-8d8c-45f5-99c5-72e3dfdd6469"),
  "abdomen-marcado": art("hf_20261023_173052_ba5f517c-4bb3-460b-bc02-0cd541f9559d"),
  "brazos-definidos": art("hf_20261023_173126_1516ee48-9b82-47b6-8d03-00005c80e4df"),
  "banana-girl": art("hf_20261023_173126_b3b4dbbf-f973-4104-b4c3-bf1b79b2cbb5"),
  "dominadas-desde-cero": art("hf_20261023_173153_8398b29a-131c-4fda-9248-cb2aeddde375"),
  "pierde-3kg-6-semanas": art("hf_20261023_173154_f80d7a16-b4b2-415e-a016-98729e55030e"),
  // Retos de hábitos
  "banana-30": art("hf_20261023_173154_dc12a21c-2928-42d9-87ac-b3118ae384e8"),
  "flexiones-30": art("hf_20261023_173053_14403f02-7b01-4f3b-8928-ab2e45d49ea3"),
  "plancha-30": art("hf_20261023_173153_7fd14fbc-4510-4be3-b02b-7448b0b8a501"),
  "pasos-30": art("hf_20261023_173053_531d9b78-b5ff-4a7a-98ea-4de379012cb7"),
  "proteina-21": art("hf_20261023_173052_73c8b3b1-3c05-4786-b24b-ec303ce0649f"),
  "agua-21": art("hf_20261023_173219_c430d71e-7e5a-4538-8269-0094e44e18c4"),
  "pasos-14": art("hf_20261023_173220_44ff7d2f-035c-4270-9867-115bb3940b61"),
  "sin-azucar-7": art("hf_20261023_173220_3e39354d-7648-476f-8ae3-238fba098f60"),
  "movilidad-14": art("hf_20261023_173220_a81492a5-0c7c-4f73-a7de-3680e600081d"),
  "sprint-verano-28": art("hf_20261023_173241_c2fec2a8-de2d-4dd2-a67b-aee27ee0a74f"),
};

export const artFor = (id: string | null | undefined) => (id ? CHALLENGE_ART[id] ?? null : null);

/** Coach Banana en cada etapa de su vida, una por nivel (1-based): bebé, niño pequeño, niño, adolescente, adulto, gorila, rey y King Kong. */
export const LEVEL_ART = [
  "hf_20261023_174922_dea3eb35-e693-4059-b8e2-0a1673419851",
  "hf_20261023_174921_847d5a8a-063a-44c0-a6a4-fcd3283528f7",
  "hf_20261023_174922_ee4f17a3-181b-435d-aca3-0bebec998634",
  "hf_20261023_174921_434d454f-8f8e-491d-9e59-474d64e6af07",
  "hf_20261023_174954_3d94b49b-ec51-4855-8a26-68dec8df2d33",
  "hf_20261023_174955_822ea4ad-eb15-4480-bf34-ab405c483186",
  "hf_20261023_174954_3a846b35-886d-4027-a3c5-084da1db517f",
  "hf_20261023_174955_f82b5904-b7d2-4f1b-94ab-2a8f45ccad6c",
].map(art);
export const levelArt = (idx: number) => LEVEL_ART[Math.max(0, Math.min(LEVEL_ART.length - 1, idx - 1))];
