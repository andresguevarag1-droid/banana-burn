// Coaches de Banana Burn: Coach Banana (por defecto) y Coach Platanita, la coach de los programas de chicas.
// Un programa elige su coach en experience.coach; mientras está activo, ella da la bienvenida, los consejos, responde
// en el chat y aparece haciendo cada ejercicio (ilustraciones de Higgsfield). Seguro para el cliente.
import type { CoachId, ProgramExperience } from "./programs";

const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3KlOTMXim7g88SAyF4A03SG6JZ6/";
const art = (id: string) => `${CDN}${id}_min.webp`;

export type Coach = {
  id: CoachId;
  name: string;
  /** Retrato (cuadrado). */
  avatar: string;
  /** De cuerpo completo saludando (bienvenida). */
  hello: string;
  /** "la" o "el": para frases como "tu coach". */
  she: boolean;
  /** Ella haciendo cada ejercicio (id del motor o "ds:XXXX"). Sin imagen, se usa la animación de técnica. */
  exercise: Record<string, string>;
};

// Ilustraciones de Coach Platanita (gpt_image_2_5 en Higgsfield, con la portada de Banana Girl como referencia).
const PLATANITA_EXERCISE: Record<string, string> = Object.fromEntries(
  ([
    ["ds:3147", "hf_20261023_211803_b59a4eba-7afb-4143-b73e-91a02feebf46"],
    ["ds:1422", "hf_20261023_212000_900dec33-3dde-4e61-8b93-6e773ed5b0ca"],
    ["ds:3561", "hf_20261023_212000_ddf0bf68-f4ea-4261-9c0f-defc3601545f"],
    ["ds:3645", "hf_20261023_212000_2da90456-971b-4140-b17c-38a9dbb8f5cb"],
    ["ds:0276", "hf_20261023_211959_f8101ece-7fce-488d-a201-7e06fe8d144c"],
    ["glutebridge", "hf_20261023_212053_1644aca6-6eac-4148-9ad4-5ab567202600"],
    ["ds:0872", "hf_20261023_212054_ca4f80fa-0a44-4e0e-9473-1edaa768fc60"],
    ["bicycle", "hf_20261023_212054_a7e5e44c-f9f6-4fad-a2f4-a45a325cbe30"],
    ["ds:0459", "hf_20261023_212053_a36c5a75-8f67-4f98-8490-f4ec62def6de"],
    ["ds:1363", "hf_20261023_212329_fb47ae60-1f9f-4f0c-b96b-b084d1cd5f94"],
    ["ds:2329", "hf_20261023_212330_44d39ded-db4c-4c69-80cb-e812d705af0e"],
    ["ds:0710", "hf_20261023_212330_1d68d420-3423-4b2a-b287-65ea28024fca"],
    ["ds:3667", "hf_20261023_212330_65c5cc28-e525-47b7-b16b-8d3312cb0194"],
    ["ds:3433", "hf_20261023_212412_db6aea23-4978-4d8b-9a84-6cb254d5fa23"],
    ["ytw", "hf_20261023_212412_00cb7de3-7b71-4e9a-b8e3-3b6eb3e2e67d"],
    ["plank", "hf_20261023_212412_b6d98259-bb61-4c2f-b894-1daca44ad98c"],
    ["ds:0705", "hf_20261023_212412_f5c55fa0-451e-48c6-b67c-4cbe9dc67851"],
    ["ds:3006", "hf_20261023_212545_a24c506b-4ede-43d9-a4e1-37181a1a8c10"],
    ["ds:1014", "hf_20261023_212544_9bc79d49-91a4-481b-9a75-7083714ef93f"],
    ["ds:1358", "hf_20261023_212544_c5637b30-db0c-459f-9086-d64d9c7c4142"],
  ] as [string, string][]).map(([k, v]) => [k, art(v)]),
);

export const COACHES: Record<CoachId, Coach> = {
  banana: { id: "banana", name: "Coach Banana", avatar: "/brand/mascota-sola.webp", hello: "/brand/mascota-sola.webp", she: false, exercise: {} },
  platanita: {
    id: "platanita", name: "Coach Platanita", she: true,
    avatar: art("hf_20261023_211802_45b7fb8e-c7f8-4f36-9aee-7cf5d126986a"),
    hello: art("hf_20261023_211802_7c4004d7-5208-4ee6-82c7-666fb4e7878a"),
    exercise: PLATANITA_EXERCISE,
  },
};

/** Coach de un programa (o Coach Banana sin programa / sin elección). */
export const coachOf = (x: Pick<ProgramExperience, "coach"> | null | undefined): Coach => COACHES[x?.coach ?? "banana"] ?? COACHES.banana;

/** Ilustración del coach haciendo el ejercicio, si existe. */
export const coachArt = (c: Coach, id: string) => c.exercise[id] ?? null;
