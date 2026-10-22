import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { Wizard } from "./wizard";

export const metadata = { title: "Bienvenida" };
export const dynamic = "force-dynamic";

export default async function Bienvenida() {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/bienvenida");
  return <Wizard name={v.demo ? "Andrés" : v.name} demo={v.demo} />;
}
