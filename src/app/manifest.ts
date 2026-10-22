import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Banana Burn: Tu entrenador con IA",
    short_name: "Banana Burn",
    description: "Tu rutina de gym de hoy, tu comida y tu progreso, con un coach IA en español. Hecho en Costa Rica para toda Latinoamérica.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF8E3",
    theme_color: "#FFF8E3",
    lang: "es-419",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Entreno de hoy", url: "/app/entreno" },
      { name: "Registrar comida", url: "/app/nutricion" },
    ],
  };
}
