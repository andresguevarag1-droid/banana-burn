import type { EndedChallenge, MyChallenge } from "@/lib/challenges-server";
import type { ChallengeView, EndedView } from "@/components/challenge-card";

const hint = (m: Pick<MyChallenge, "c">) => {
  switch (m.c.verify) {
    case "workout": return "Se marca solo al guardar tu entreno";
    case "steps": return `Se marca solo al registrar ${(m.c.stepsGoal ?? 10000).toLocaleString("es-419")} pasos en Hoy`;
    case "protein": return "Se marca solo al llegar a tu proteína";
    case "water": return "Se marca solo con 8 vasos registrados";
    default: return "";
  }
};

export const toView = (m: MyChallenge): ChallengeView => ({
  ucId: m.ucId, c: { id: m.c.id, title: m.c.title, icon: m.c.icon, days: m.c.days, verify: m.c.verify, color: m.c.color, xp: m.c.xp },
  task: m.c.task(m.state.day), day: m.state.day, completed: m.state.completed, todayDone: m.state.todayDone, cells: m.state.cells, autoOk: m.autoOk, hint: hint(m),
  grace: m.state.grace, graceLeft: m.state.graceLeft, need: m.state.need, pendingSync: Boolean(m.pendingSync),
});

export const toEndedView = (e: EndedChallenge): EndedView => ({
  ucId: e.ucId, id: e.c.id, title: e.c.title, icon: e.c.icon, days: e.c.days, outcome: e.outcome, completed: e.completed, canRetry: e.canRetry,
});
