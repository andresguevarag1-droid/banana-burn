import Link from "next/link";
import { OrangeSlice as Apple, BookOpen, CaretDown, CookingPot as ChefHat, Barbell as Dumbbell, Megaphone, Plus, BrandIcon } from "@/components/icons";
import { requireSection } from "@/lib/admin-auth";
import { getAnnouncements, getExercises, getFoods, PAGE_SIZE, type AnnouncementRow, type FoodRow } from "@/lib/admin";
import { can, type Capability } from "@/lib/admin-perms";
import { FOOD_GROUPS } from "@/lib/foods";
import { BODY, DS_ID, EQUIP, es, LIB_COUNT, MUSCLE, searchLibrary } from "@/lib/library";
import { RECIPES } from "@/lib/recipes";
import { ActionForm, ConfirmAction, Submit } from "@/components/admin/action-form";
import { AnnouncementCard } from "@/components/admin/announcement-banner";
import { Badge, DemoNotice, Empty, Field, FilterBar, MetaList, MigrationNotice, Nil, Notice, PageHeader, Pagination, SectionHeading, SubTabs, Table, Td, Th, btnGhost, fmtDate, fmtNum, fw, inputSm, panel, rowAction, rowActionDanger, textareaSm, tr, trHover } from "@/components/admin/ui";
import { deleteAnnouncement, deleteFood, resetExercise, saveAnnouncement, saveExercise, saveFood, seedFoods } from "../actions";

export const metadata = { title: "Contenido" };

const TABS: { key: string; label: string; cap: Capability; icon: typeof Dumbbell }[] = [
  { key: "ejercicios", label: "Ejercicios del motor", cap: "content.exercises", icon: Dumbbell },
  { key: "biblioteca", label: "Biblioteca", cap: "content.exercises", icon: BookOpen },
  { key: "alimentos", label: "Alimentos", cap: "content.foods", icon: Apple },
  { key: "recetas", label: "Recetas", cap: "content.foods", icon: ChefHat },
  { key: "anuncios", label: "Anuncios", cap: "content.announcements", icon: Megaphone },
];
type SP = { tab?: string; q?: string; page?: string; edit?: string; verified?: string; bp?: string; eq?: string; slot?: string };
const LIB_PER = 25;
const ENGINE_IDS = new Set(Object.values(DS_ID));
const SLOT: Record<string, string> = { desayuno: "Desayuno", almuerzo: "Almuerzo", merienda: "Merienda", cena: "Cena" };

const textarea = textareaSm;
/** Fila plegable (ejercicio, reto, anuncio): resumen clicable con flecha, sin animación. */
const summaryRow = "flex cursor-pointer list-none items-center gap-3 rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-banana/50 [&::-webkit-details-marker]:hidden";
/** Contenido del resumen: se envuelve en varias líneas sin arrastrar la flecha, que queda fija a la derecha. */
const summaryInner = "flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1";
const Chevron = () => <CaretDown className="size-4 shrink-0 text-faint group-open:rotate-180" aria-hidden />;
const check = "size-4 accent-[#1B1505]";
/** Valor para <input type="datetime-local"> en hora de Costa Rica. */
const dtLocal = (s: string | null) => (s ? new Date(Date.parse(s) - 6 * 3600e3).toISOString().slice(0, 16) : "");

export default async function Contenido({ searchParams }: { searchParams: Promise<SP> }) {
  const v = await requireSection("contenido");
  const sp = await searchParams;
  const tabs = TABS.filter((t) => can(v.role, t.cap));
  const tab = tabs.find((t) => t.key === sp.tab) ?? tabs[0];

  return (
    <div className="space-y-5">
      <PageHeader title="Contenido" desc={<>Ejercicios, alimentos, recetas y anuncios que ve la app. Los retos se administran en <Link href="/admin/retos" className="font-semibold text-ink underline underline-offset-2">Retos</Link>.</>} />
      {v.demo && <DemoNotice what="el contenido" />}
      <SubTabs label="Tipos de contenido" items={tabs.map((t) => ({ href: `/admin/contenido?tab=${t.key}`, label: t.label, icon: t.icon, current: t.key === tab.key }))} />
      {tab.key === "ejercicios" && <Exercises q={sp.q} />}
      {tab.key === "biblioteca" && <Library sp={sp} />}
      {tab.key === "alimentos" && <Foods sp={sp} />}
      {tab.key === "recetas" && <Recipes sp={sp} />}
      {tab.key === "anuncios" && <Announcements />}
    </div>
  );

  // ─────────── Ejercicios ───────────
  async function Exercises({ q }: { q?: string }) {
    const { items, needsMigration } = await getExercises(v);
    const needle = q?.toLowerCase().trim();
    const list = items.filter((e) => !needle || e.id.includes(needle) || e.base.toLowerCase().includes(needle) || e.muscle.toLowerCase().includes(needle) || e.name?.toLowerCase().includes(needle));
    const groups = [...new Set(list.map((e) => e.muscle))];
    return (
      <section aria-labelledby="t-ej" className="space-y-4">
        <h2 id="t-ej" className="sr-only">Ejercicios</h2>
        {needsMigration && <MigrationNotice />}
        <p className="max-w-prose text-sm text-muted text-pretty">Los {fmtNum(items.length)} ejercicios con los que el motor arma las rutinas.</p>
        <Notice title="Se aplica en la próxima versión">Los cambios se guardan, pero el motor todavía arma las rutinas con su catálogo incluido. Cuando se conecte, un ejercicio deshabilitado se reemplazará por su alternativa.</Notice>
        <FilterBar label="Buscar ejercicios" search submitLabel="Buscar" filtered={!!q} clearHref="/admin/contenido?tab=ejercicios">
          <input type="hidden" name="tab" value="ejercicios" />
          <Field label="Buscar ejercicio" htmlFor="ej-q" className={fw.search}><input id="ej-q" name="q" type="search" defaultValue={q} className={inputSm} placeholder="Nombre, músculo o id" /></Field>
          <MetaList className="self-center sm:pt-5" items={[`Deshabilitados: ${items.filter((e) => !e.enabled).length}`, `Con cambios: ${items.filter((e) => e.name || e.cues.length).length}`]} />
        </FilterBar>
        {groups.map((g) => (
          <div key={g} className={`${panel} divide-y divide-line overflow-hidden`}>
            <h3 className="bg-[#FCFAF3] px-4 py-2.5 text-xs font-semibold text-muted">{g}</h3>
            {list.filter((e) => e.muscle === g).map((e) => (
              <details key={e.id} className="group px-4 py-2.5">
                <summary className={summaryRow}><span className={summaryInner}>
                  <span className="font-semibold text-ink">{e.name ?? e.base}</span>
                  {e.name && <span className="text-xs text-muted">Original: {e.base}</span>}
                  <code className="text-xs text-muted">{e.id}</code>
                  {!e.enabled && <Badge tone="bad">Deshabilitado</Badge>}{e.cues.length > 0 && <Badge tone="info">{e.cues.length} claves</Badge>}
                  </span><Chevron />
                </summary>
                <ActionForm action={saveExercise} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="exercise_id" value={e.id} />
                  <Field label="Nombre visible" htmlFor={`ex-n-${e.id}`} hint="Vacío = nombre original"><input id={`ex-n-${e.id}`} name="name" defaultValue={e.name ?? ""} maxLength={80} placeholder={e.base} className={inputSm} /></Field>
                  <Field label="Claves técnicas (una por línea)" htmlFor={`ex-c-${e.id}`} hint="Máx. 8, se muestran en el reproductor"><textarea id={`ex-c-${e.id}`} name="cues" rows={3} defaultValue={e.cues.join("\n")} className={textarea} /></Field>
                  <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="enabled" defaultChecked={e.enabled} className={check} />Habilitado en rutinas</label>
                  <div className="flex justify-end gap-2 sm:col-span-1"><Submit>Guardar</Submit></div>
                </ActionForm>
                {(e.name || e.cues.length > 0 || !e.enabled) && (
                  <ActionForm action={resetExercise} className="mt-1 flex justify-end">
                    <input type="hidden" name="exercise_id" value={e.id} />
                    <Submit className={rowAction} pendingText="Restaurando…">Restaurar original</Submit>
                  </ActionForm>
                )}
              </details>
            ))}
          </div>
        ))}
        {!list.length && <Empty title="Sin resultados" action={<Link href="/admin/contenido?tab=ejercicios" className={btnGhost}>Ver todos</Link>}>Ningún ejercicio coincide con &quot;{q}&quot;.</Empty>}
      </section>
    );
  }

  // ─────────── Biblioteca (solo lectura) ───────────
  async function Library({ sp }: { sp: SP }) {
    const bp = sp.bp && sp.bp in BODY ? sp.bp : undefined;
    const eq = sp.eq && sp.eq in EQUIP ? sp.eq : undefined;
    const q = sp.q?.slice(0, 60);
    const page = Math.max(1, Number(sp.page) || 1);
    const res = searchLibrary({ q, bp, eq, page, per: LIB_PER });
    const filtered = !!(q || bp || eq);
    return (
      <section aria-labelledby="t-lib" className="space-y-4">
        <h2 id="t-lib" className="sr-only">Biblioteca de ejercicios</h2>
        <p className="max-w-prose text-sm text-muted text-pretty">{fmtNum(LIB_COUNT)} ejercicios disponibles como alternativas al cambiar un ejercicio. Solo lectura.</p>
        <FilterBar label="Buscar en la biblioteca" search submitLabel="Buscar" filtered={filtered} clearHref="/admin/contenido?tab=biblioteca">
          <input type="hidden" name="tab" value="biblioteca" />
          <Field label="Buscar" htmlFor="lib-q" className={fw.search}><input id="lib-q" name="q" type="search" defaultValue={q} placeholder="Nombre en español o inglés, o músculo" className={inputSm} /></Field>
          <Field label="Zona" htmlFor="lib-bp" className={fw.select}><select id="lib-bp" name="bp" defaultValue={bp ?? ""} className={inputSm}><option value="">Todas</option>{Object.entries(BODY).sort((a, b) => a[1].localeCompare(b[1], "es")).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Equipo" htmlFor="lib-eq" className={fw.select}><select id="lib-eq" name="eq" defaultValue={eq ?? ""} className={inputSm}><option value="">Todo</option>{Object.entries(EQUIP).sort((a, b) => a[1].localeCompare(b[1], "es")).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </FilterBar>
        {res.items.length > 0 ? (
          <Table caption={`Biblioteca de ejercicios (${fmtNum(res.total)})`} captionHidden minWidth={820}>
            <thead className="border-b border-line"><tr><Th>Ejercicio</Th><Th>Zona</Th><Th>Equipo</Th><Th>Músculo objetivo</Th><Th>Secundarios</Th><Th>ID</Th></tr></thead>
            <tbody>{res.items.map((e) => (
              <tr key={e.id} className={`${tr} align-top`}>
                <Td>
                  <details className="group">
                    <summary className="cursor-pointer list-none rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-banana/50 [&::-webkit-details-marker]:hidden">
                      <span className="font-semibold text-ink">{e.n}</span>{ENGINE_IDS.has(e.id) && <> <Badge tone="info">En rutinas</Badge></>}
                      <span className="flex items-center gap-1 text-xs text-muted">{e.en}<span className="ml-2 font-semibold text-ink group-open:hidden">Ver pasos</span><span className="ml-2 hidden font-semibold text-ink group-open:inline">Ocultar pasos</span></span>
                    </summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-body max-w-xl">{e.s.map((x, i) => <li key={i}>{x}</li>)}</ol>
                  </details>
                </Td>
                <Td className="whitespace-nowrap">{es(BODY, e.bp)}</Td><Td className="whitespace-nowrap">{es(EQUIP, e.eq)}</Td><Td className="capitalize">{es(MUSCLE, e.t)}</Td>
                <Td className="text-muted text-xs">{e.m2.length ? e.m2.map((m) => es(MUSCLE, m)).join(", ") : <Nil />}</Td>
                <Td><code className="text-xs text-muted">{e.id}</code></Td>
              </tr>))}</tbody>
          </Table>
        ) : <Empty title="Sin resultados" action={<Link href="/admin/contenido?tab=biblioteca" className={btnGhost}>Limpiar filtros</Link>}>Ningún ejercicio de la biblioteca coincide con estos filtros.</Empty>}
        <Pagination page={res.page} total={res.total} pageSize={LIB_PER} basePath="/admin/contenido" params={{ tab: "biblioteca", q, bp, eq }} />
      </section>
    );
  }

  // ─────────── Recetas (solo lectura) ───────────
  async function Recipes({ sp }: { sp: SP }) {
    const slot = sp.slot && sp.slot in SLOT ? sp.slot : undefined;
    const q = sp.q?.slice(0, 60);
    const needle = q ? q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    const fold = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const list = RECIPES.filter((r) => (!slot || r.slot === slot) && (!needle || fold(r.t).includes(needle) || r.tags.some((t) => fold(t).includes(needle)) || r.ing.some((i) => fold(i).includes(needle))));
    const page = Math.max(1, Number(sp.page) || 1);
    const rows = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const filtered = !!(q || slot);
    return (
      <section aria-labelledby="t-rec" className="space-y-4">
        <h2 id="t-rec" className="sr-only">Recetas</h2>
        <p className="max-w-prose text-sm text-muted text-pretty">{fmtNum(RECIPES.length)} recetas que la app usa para armar los menús. Macros por porción. Solo lectura.</p>
        <FilterBar label="Buscar recetas" search filtered={filtered} clearHref="/admin/contenido?tab=recetas">
          <input type="hidden" name="tab" value="recetas" />
          <Field label="Buscar" htmlFor="rc-q" className={fw.search}><input id="rc-q" name="q" type="search" defaultValue={q} placeholder="Nombre, ingrediente o etiqueta" className={inputSm} /></Field>
          <Field label="Momento" htmlFor="rc-s" className={fw.select}><select id="rc-s" name="slot" defaultValue={slot ?? ""} className={inputSm}><option value="">Todos</option>{Object.entries(SLOT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </FilterBar>
        {rows.length > 0 ? (
          <Table caption={`Recetas (${fmtNum(list.length)})`} captionHidden minWidth={860}>
            <thead className="border-b border-line"><tr><Th>Receta</Th><Th>Momento</Th><Th className="text-right">Min</Th><Th className="text-right">Porciones</Th><Th className="text-right">Kcal</Th><Th className="text-right"><abbr title="Proteína (g)">P</abbr></Th><Th className="text-right"><abbr title="Carbohidratos (g)">C</abbr></Th><Th className="text-right"><abbr title="Grasa (g)">G</abbr></Th><Th>Etiquetas</Th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className={`${tr} align-top`}>
                <Td>
                  <details className="group">
                    <summary className="cursor-pointer list-none rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-banana/50 [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-2 font-semibold text-ink"><BrandIcon name={r.icon} className="size-5 shrink-0 text-banana-ink" />{r.t}</span>
                      <span className="block pl-7 text-xs font-semibold text-muted"><span className="group-open:hidden">Ver ingredientes y pasos</span><span className="hidden group-open:inline">Ocultar</span></span>
                    </summary>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2 text-sm text-body max-w-2xl">
                      <div><p className="text-xs font-bold text-ink">Ingredientes</p><ul className="mt-1 list-disc space-y-0.5 pl-5">{r.ing.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                      <div><p className="text-xs font-bold text-ink">Pasos</p><ol className="mt-1 list-decimal space-y-0.5 pl-5">{r.steps.map((x, i) => <li key={i}>{x}</li>)}</ol></div>
                    </div>
                  </details>
                </Td>
                <Td>{SLOT[r.slot]}</Td><Td className="text-right">{r.min}</Td><Td className="text-right">{r.serves}</Td>
                <Td className="text-right">{fmtNum(r.kcal)}</Td><Td className="text-right">{fmtNum(r.p)}</Td><Td className="text-right">{fmtNum(r.c)}</Td><Td className="text-right">{fmtNum(r.f)}</Td>
                <Td><span className="flex flex-wrap gap-1">{r.tags.map((t) => <Badge key={t}>{t}</Badge>)}</span></Td>
              </tr>))}</tbody>
          </Table>
        ) : <Empty title="Sin resultados" action={<Link href="/admin/contenido?tab=recetas" className={btnGhost}>Limpiar filtros</Link>}>Ninguna receta coincide con estos filtros.</Empty>}
        <Pagination page={page} total={list.length} pageSize={PAGE_SIZE} basePath="/admin/contenido" params={{ tab: "recetas", q, slot }} />
      </section>
    );
  }

  // ─────────── Alimentos ───────────
  async function Foods({ sp }: { sp: SP }) {
    const page = Math.max(1, Number(sp.page) || 1);
    const verified = sp.verified === "si" || sp.verified === "no" ? sp.verified : undefined;
    const { rows, total, empty } = await getFoods(v, { q: sp.q?.slice(0, 60), verified, page });
    const editing = sp.edit ? rows.find((r) => String(r.id) === sp.edit) : undefined;
    return (
      <section aria-labelledby="t-al" className="space-y-4">
        <h2 id="t-al" className="sr-only">Alimentos</h2>
        <Notice title="Se aplica en la próxima versión">El registro de comidas todavía usa la base de alimentos incluida en la app. Lo que edites aquí queda guardado para cuando se conecte.</Notice>
        {empty && (
          <div className={`${panel} flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center`}>
            <p className="text-sm text-ink"><b>Aún no hay alimentos guardados.</b> Puedes cargar la base de alimentos de la app como punto de partida.</p>
            <ActionForm action={seedFoods}><Submit pendingText="Cargando…">Cargar base inicial</Submit></ActionForm>
          </div>
        )}
        <details className={`group ${panel} p-4`} open={!!editing}>
          <summary className={`${summaryRow} font-bold text-ink`}><span className={summaryInner}><Plus className="size-4" aria-hidden />{editing ? `Editar: ${editing.name}` : "Nuevo alimento"}</span><Chevron /></summary>
          <FoodForm f={editing} />
          {editing && <Link href="/admin/contenido?tab=alimentos" className={`mt-2 ${rowAction}`}>Cancelar edición</Link>}
        </details>
        <FilterBar label="Filtrar alimentos" search filtered={!!(sp.q || verified)} clearHref="/admin/contenido?tab=alimentos">
          <input type="hidden" name="tab" value="alimentos" />
          <Field label="Buscar" htmlFor="fd-q" className={fw.search}><input id="fd-q" name="q" type="search" defaultValue={sp.q} placeholder="Nombre del alimento" className={inputSm} /></Field>
          <Field label="Verificado" htmlFor="fd-v" className={fw.select}><select id="fd-v" name="verified" defaultValue={verified ?? ""} className={inputSm}><option value="">Todos</option><option value="si">Sí</option><option value="no">No</option></select></Field>
        </FilterBar>
        {rows.length > 0 && <Table caption={`Alimentos (${total})`} captionHidden minWidth={760}>
          <thead className="border-b border-line"><tr><Th>Nombre</Th><Th>Porción</Th><Th className="text-right">Kcal</Th><Th className="text-right"><abbr title="Proteína (g)">P</abbr></Th><Th className="text-right"><abbr title="Carbohidratos (g)">C</abbr></Th><Th className="text-right"><abbr title="Grasa (g)">G</abbr></Th><Th>País</Th><Th>Verificado</Th><Th><span className="sr-only">Acciones</span></Th></tr></thead>
          <tbody>{rows.map((f) => (
            <tr key={String(f.id)} className={trHover}>
              <Td className="font-semibold text-ink">{f.name}</Td><Td className="text-muted whitespace-nowrap">{f.portion ?? <Nil />}</Td>
              <Td className="text-right">{f.kcal ?? <Nil />}</Td><Td className="text-right">{f.protein != null ? fmtNum(f.protein) : <Nil />}</Td><Td className="text-right">{f.carbs != null ? fmtNum(f.carbs) : <Nil />}</Td><Td className="text-right">{f.fat != null ? fmtNum(f.fat) : <Nil />}</Td>
              <Td>{f.country ?? <Nil />}</Td><Td>{f.verified ? <Badge tone="good">Sí</Badge> : <Badge tone="warn">Revisar</Badge>}</Td>
              <Td className="text-right whitespace-nowrap">
                <span className="-my-1 inline-flex gap-1">
                  <Link href={`/admin/contenido?tab=alimentos&edit=${f.id}${page > 1 ? `&page=${page}` : ""}`} className={rowAction} aria-label={`Editar ${f.name}`}>Editar</Link>
                  <ConfirmAction action={deleteFood} danger triggerClassName={rowActionDanger} trigger={<span>Eliminar<span className="sr-only"> {f.name}</span></span>} title={`Eliminar “${f.name}”`} description="Los registros de comidas ya guardados no cambian." hidden={{ id: String(f.id) }} confirmLabel="Eliminar" />
                </span>
              </Td>
            </tr>))}</tbody>
        </Table>}
        {!rows.length && (sp.q || verified ? <Empty title="Sin resultados" action={<Link href="/admin/contenido?tab=alimentos" className={btnGhost}>Limpiar filtros</Link>}>Ningún alimento coincide con estos filtros.</Empty> : <Empty title="Sin alimentos">Crea el primero con &quot;Nuevo alimento&quot;.</Empty>)}
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/contenido" params={{ tab: "alimentos", q: sp.q, verified }} />
      </section>
    );
  }

  // ─────────── Anuncios ───────────
  async function Announcements() {
    const { rows, needsMigration } = await getAnnouncements(v);
    const now = Date.now();
    const state = (a: AnnouncementRow) => !a.active ? ["Inactivo", "muted"] as const : a.ends_at && Date.parse(a.ends_at) <= now ? ["Terminado", "muted"] as const : a.starts_at && Date.parse(a.starts_at) > now ? ["Programado", "info"] as const : ["En vivo", "good"] as const;
    return (
      <section aria-labelledby="t-an" className="space-y-4">
        <h2 id="t-an" className="sr-only">Anuncios</h2>
        {needsMigration && <MigrationNotice />}
        <div className={`${panel} divide-y divide-line`}>
        <details className="group p-4">
          <summary className={`${summaryRow} font-bold text-ink`}><span className={summaryInner}><Plus className="size-4" aria-hidden />Nuevo anuncio</span><Chevron /></summary>
          <AnnouncementForm />
        </details>
        {rows.map((a) => {
          const [l, t] = state(a);
          return (
            <details key={a.id} className="group p-4">
              <summary className={summaryRow}><span className={summaryInner}>
                <span className="font-semibold text-ink">{a.title}</span><Badge tone={t}>{l}</Badge>
                <MetaList items={[`Audiencia: ${AUD[a.audience] ?? a.audience}`, `Del ${fmtDate(a.starts_at)} ${a.ends_at ? `al ${fmtDate(a.ends_at)}` : "sin fecha de fin"}`]} />
                </span><Chevron />
              </summary>
              <div className="mt-4"><p className="mb-1 text-xs font-semibold text-muted">Vista previa</p><AnnouncementCard a={a} /></div>
              <AnnouncementForm a={a} />
              <div className="mt-2 flex justify-end"><ConfirmAction action={deleteAnnouncement} danger trigger="Eliminar anuncio" title={`Eliminar “${a.title}”`} hidden={{ id: a.id }} confirmLabel="Eliminar" /></div>
            </details>
          );
        })}
        {!rows.length && !needsMigration && <Empty boxed={false} title="Sin anuncios">Crea uno con &quot;Nuevo anuncio&quot;.</Empty>}
        </div>
      </section>
    );
  }
}

const AUD: Record<string, string> = { todos: "Todos", free: "Plan gratis", pago: "Planes de pago", staff: "Solo staff" };

function FoodForm({ f }: { f?: FoodRow }) {
  const k = f ? `e${f.id}` : "new";
  return (
    <ActionForm action={saveFood} resetOnSuccess={!f} className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4">
      {f && <input type="hidden" name="id" value={String(f.id)} />}
      <Field label="Nombre" htmlFor={`fd-n-${k}`} className="col-span-2"><input id={`fd-n-${k}`} name="name" required minLength={2} maxLength={80} defaultValue={f?.name} className={inputSm} /></Field>
      <Field label="Porción" htmlFor={`fd-p-${k}`}><input id={`fd-p-${k}`} name="portion" maxLength={40} defaultValue={f?.portion ?? ""} placeholder="1 taza" className={inputSm} /></Field>
      <Field label="Grupo" htmlFor={`fd-g-${k}`}><select id={`fd-g-${k}`} name="grp" defaultValue={f?.grp ?? "tica"} className={inputSm}>{FOOD_GROUPS.map(([g, l]) => <option key={g} value={g}>{l}</option>)}</select></Field>
      <Field label="Kcal" htmlFor={`fd-k-${k}`}><input id={`fd-k-${k}`} name="kcal" type="number" required min={0} max={5000} step={1} defaultValue={f?.kcal ?? ""} className={inputSm} /></Field>
      <Field label="Proteína (g)" htmlFor={`fd-pr-${k}`}><input id={`fd-pr-${k}`} name="protein" type="number" min={0} max={500} step="0.1" defaultValue={f?.protein ?? ""} className={inputSm} /></Field>
      <Field label="Carbohidratos (g)" htmlFor={`fd-c-${k}`}><input id={`fd-c-${k}`} name="carbs" type="number" min={0} max={500} step="0.1" defaultValue={f?.carbs ?? ""} className={inputSm} /></Field>
      <Field label="Grasa (g)" htmlFor={`fd-f-${k}`}><input id={`fd-f-${k}`} name="fat" type="number" min={0} max={500} step="0.1" defaultValue={f?.fat ?? ""} className={inputSm} /></Field>
      <Field label="País" htmlFor={`fd-co-${k}`} hint="Código ISO de 2 letras"><input id={`fd-co-${k}`} name="country" maxLength={2} defaultValue={f?.country ?? "CR"} className={`${inputSm} uppercase`} /></Field>
      <label className="flex items-center gap-2 text-sm text-ink self-center"><input type="checkbox" name="verified" defaultChecked={f?.verified ?? false} className={check} />Macros verificados</label>
      <div className="col-span-2 flex items-end justify-end"><Submit>{f ? "Guardar cambios" : "Crear alimento"}</Submit></div>
    </ActionForm>
  );
}

function AnnouncementForm({ a }: { a?: AnnouncementRow }) {
  const k = a?.id ?? "new";
  return (
    <ActionForm action={saveAnnouncement} resetOnSuccess={!a} className="mt-4 grid gap-3 md:grid-cols-4">
      {a && <input type="hidden" name="id" value={a.id} />}
      <Field label="Título" htmlFor={`an-t-${k}`} className="md:col-span-2"><input id={`an-t-${k}`} name="title" required minLength={3} maxLength={90} defaultValue={a?.title} className={inputSm} /></Field>
      <Field label="Audiencia" htmlFor={`an-a-${k}`}><select id={`an-a-${k}`} name="audience" defaultValue={a?.audience ?? "todos"} className={inputSm}>{Object.entries(AUD).map(([x, l]) => <option key={x} value={x}>{l}</option>)}</select></Field>
      <Field label="Color" htmlFor={`an-c-${k}`}><select id={`an-c-${k}`} name="tone" defaultValue={a?.tone ?? "banana"} className={inputSm}><option value="banana">Banana</option><option value="ember">Naranja</option><option value="sky">Azul</option><option value="peel">Verde</option></select></Field>
      <Field label="Texto" htmlFor={`an-b-${k}`} className="md:col-span-4"><textarea id={`an-b-${k}`} name="body" rows={2} maxLength={400} defaultValue={a?.body ?? ""} className={textarea} /></Field>
      <Field label="Texto del botón" htmlFor={`an-cl-${k}`}><input id={`an-cl-${k}`} name="cta_label" maxLength={30} defaultValue={a?.cta_label ?? ""} className={inputSm} /></Field>
      <Field label="Enlace del botón" htmlFor={`an-ch-${k}`} hint="/ruta o https://"><input id={`an-ch-${k}`} name="cta_href" maxLength={200} defaultValue={a?.cta_href ?? ""} className={inputSm} /></Field>
      <Field label="Inicio" htmlFor={`an-s-${k}`} hint="Hora de Costa Rica"><input id={`an-s-${k}`} name="starts_at" type="datetime-local" defaultValue={dtLocal(a?.starts_at ?? null)} className={inputSm} /></Field>
      <Field label="Fin" htmlFor={`an-e-${k}`}><input id={`an-e-${k}`} name="ends_at" type="datetime-local" defaultValue={dtLocal(a?.ends_at ?? null)} className={inputSm} /></Field>
      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="active" defaultChecked={a?.active ?? true} className={check} />Activo</label>
      <div className="md:col-span-3 flex justify-end"><Submit>{a ? "Guardar anuncio" : "Crear anuncio"}</Submit></div>
    </ActionForm>
  );
}
