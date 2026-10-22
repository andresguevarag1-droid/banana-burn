import { Sparkles } from "lucide-react";

export const metadata = { title: "Coach IA" };

export default function Coach() {
  return (
    <div className="min-h-[60vh] grid place-items-center text-center animate-rise">
      <div className="max-w-md">
        <span className="mx-auto grid place-items-center size-16 rounded-3xl bg-banana"><Sparkles className="size-8 text-ink" /></span>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">Tu coach IA llega pronto</h1>
        <p className="mt-3 text-muted">Pregúntale lo que sea: “¿puedo cambiar sentadilla por prensa?”, “¿qué ceno si me quedan 40 g de proteína?”. Lee tus datos y ajusta tu plan. Disponible en Pro.</p>
      </div>
    </div>
  );
}
