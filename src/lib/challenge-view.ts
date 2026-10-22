import type { MyChallenge } from "@/lib/challenges-server";
import type { ChallengeView } from "@/components/challenge-card";

const HINT = { workout: "Se marca al terminar tu entreno", steps: "Se marca al llegar a 10.000 pasos", protein: "Se marca al llegar a tu proteína", water: "Se marca con 8 vasos", manual: "" } as const;

export const toView = (m: MyChallenge): ChallengeView => ({
  ucId: m.ucId, c: { id: m.c.id, title: m.c.title, icon: m.c.icon, days: m.c.days, verify: m.c.verify, color: m.c.color, xp: m.c.xp },
  task: m.c.task(m.state.day), day: m.state.day, completed: m.state.completed, todayDone: m.state.todayDone, cells: m.state.cells, autoOk: m.autoOk, hint: HINT[m.c.verify],
});
