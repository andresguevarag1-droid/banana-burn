// Poses de Coach Banana (Higgsfield, mismo CDN que las portadas). Se sirven por /_next/image.
const BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_3KlOTMXim7g88SAyF4A03SG6JZ6/";

export const COACH_POSE = {
  flex: `${BASE}hf_20261023_061301_ed14348a-1464-482d-8fee-fbe951fd4d44.png`,
  barra: `${BASE}hf_20261023_061358_9ff0ae8e-4afd-4a93-bb85-4207b5a2c361.png`,
  entrenador: `${BASE}hf_20261023_061409_d0198d87-fa4d-4ff8-aaec-e30ab735a6e0.png`,
  salta: `${BASE}hf_20261023_061411_c121bf5f-06b1-4af8-95a3-2854fcde1109.png`,
} as const;

/** Pose según el tipo de día: barra en fuerza, sacando músculo en volumen, de entrenador en un día ligero. */
export function poseForTag(tag: string): string {
  const k = tag.toLowerCase();
  return k === "fuerza" ? COACH_POSE.barra : k === "volumen" ? COACH_POSE.flex : k === "ligero" ? COACH_POSE.entrenador : COACH_POSE.salta;
}
