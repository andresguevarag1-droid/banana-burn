import type { Metadata } from "next";
import { Landing, homeMetadata } from "./home";

// Pública e igual para todos: ISR (la CDN la sirve y se regenera cada hora; nada depende de la persona).
export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return homeMetadata();
}

export default function Home() {
  return <Landing />;
}
