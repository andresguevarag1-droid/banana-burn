"use client";
// Pide los avisos en un buen momento: con la app instalada (en iPhone es obligatorio) y después del primer entreno o
// desde la segunda vez que abre la app. Antes de eso, la tarjeta de instalar hace el trabajo.
import { useEffect, useState } from "react";
import { EnablePush } from "@/components/notifications/enable-push";
import { track } from "@/components/analytics";
import { pushMomentReady } from "@/lib/install-env";
import { readOpens } from "./install-beacon";
import { useInstall } from "./use-install";

export function PushWhenReady({ trained }: { trained: boolean }) {
  const { env } = useInstall();
  const [opens, setOpens] = useState(0);
  useEffect(() => { setOpens(readOpens()); }, []);
  if (!env || !pushMomentReady(env, { opens, trained })) return null;
  return <EnablePush hideWhenSnoozed onChange={(on) => { if (on) track("push_enabled", { where: "hoy", env }); }} />;
}
