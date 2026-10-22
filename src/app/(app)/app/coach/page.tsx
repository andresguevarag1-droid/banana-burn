import { createClient, getViewer } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { Chat } from "./chat";

export const metadata = { title: "Coach IA" };

export default async function Coach() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  let initial: { role: "user" | "assistant"; content: string }[] = [];
  if (!v.demo) {
    const sb = await createClient();
    const { data } = await sb.from("coach_messages").select("role,content").eq("user_id", v.id).order("id", { ascending: false }).limit(20);
    initial = ((data ?? []) as typeof initial).reverse();
  }
  return <Chat name={a.name} initial={initial} />;
}
