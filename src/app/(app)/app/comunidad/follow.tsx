"use client";
import { useState, useTransition } from "react";
import { setFollow } from "@/app/actions/community";

export function FollowButton({ userId, initial = false }: { userId: string; initial?: boolean }) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  return (
    <button onClick={() => { const n = !on; setOn(n); start(() => { setFollow(userId, n); }); }} className={`tap pressable h-9 px-4 rounded-full text-sm font-bold ${on ? "bg-cream text-ink border border-line" : "bg-ink text-white"}`} aria-pressed={on}>
      {on ? "Siguiendo" : "Seguir"}
    </button>
  );
}
