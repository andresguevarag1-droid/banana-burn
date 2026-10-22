import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

/** Páginas públicas de Banana Burn. Al agregar una página de marketing, súmala aquí. */
const PUBLIC_PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/precios", priority: 0.9, changeFrequency: "monthly" },
  { path: "/glp1", priority: 0.9, changeFrequency: "monthly" },
  { path: "/terminos", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacidad", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PAGES.map(({ path, priority, changeFrequency }) => ({ url: `${SITE_URL}${path === "/" ? "" : path}`, lastModified, changeFrequency, priority }));
}
